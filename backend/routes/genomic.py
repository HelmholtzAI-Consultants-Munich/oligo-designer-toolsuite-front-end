"""
Genomic endpoints for region generation and processing.

Cascaded endpoints (under `/api/genomic/cascaded/`) are designed to be used as intermediate steps in pipeline workflows:
they generate genomic regions and pass the locations of created files/directories to downstream processes.
Other endpoints are standalone: they run the full pipeline and return the output directly to the user.
"""

import os
import subprocess
import time
from http import HTTPStatus
from pathlib import Path

import yaml
from flask import Blueprint, abort, current_app, jsonify, request

from backend.extensions import mongo
from backend.genomic_databases import EnsemblGenomicDataBase, NCBIGenomicDataBase
from backend.routes.route_helpers import (
    get_user_context_with_directory,
    require_terms_acceptance_for_current_context,
)
from backend.utilities.converters import to_bool, to_int
from backend.utilities.pipeline import generate_single_region_forms, get_form_cache_key
from backend.utilities.typed_values import serialize_path, timestamp_for_display, utc_now

genomic_bp = Blueprint("genomic", __name__)


def _validate_genomic_form_data(form_data: dict, allowed_sources: list[str] | None = None) -> None:
    """
    Validate genomic form data structure and required fields.

    Args:
        form_data: The form data dictionary to validate
        allowed_sources: List of allowed source values. Defaults to ["NCBI", "Ensembl"]

    Raises:
        400: If validation fails
    """
    if allowed_sources is None:
        allowed_sources = ["NCBI", "Ensembl"]

    if not form_data:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: form data is required")
    if "source" not in form_data:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: source is required")
    if form_data["source"] not in allowed_sources:
        abort(
            HTTPStatus.BAD_REQUEST,
            description=f"Invalid input: source must be one of {', '.join(repr(s) for s in allowed_sources)}",
        )
    if "genomic_regions" not in form_data:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: genomic_regions is required")
    if form_data["source"] == "Custom" and "file_regions" not in form_data:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: file_regions is required for Custom source")


@genomic_bp.route("/api/genomic/dropdown", methods=["GET"])
def genomic_dropdown_dict():
    dropdown_options = None
    for i in range(3):
        dropdown_options = mongo.db.cache.find_one({"_id": 1})

        if dropdown_options is not None:
            break

        time.sleep(5)

    if dropdown_options is None:
        abort(HTTPStatus.NOT_FOUND, description="Could not read dropdown options from database")

    return jsonify(dropdown_options["data"]), 200


@genomic_bp.route("/api/genomic/releases/<taxon>/<species>", methods=["GET"])
def genomic_get_releases(taxon: str, species: str):
    dirs = NCBIGenomicDataBase().fetch_annotations_releases(taxon, species)

    if dirs is None:
        abort(
            HTTPStatus.NOT_FOUND,
            description=f'Could not fetch releases for taxon: "{taxon}" and species: "{species}"',
        )

    return jsonify(dirs), 200


@genomic_bp.route("/api/genomic/cascaded/custom", methods=["POST"])
def genomic_cascaded_custom():
    """
    Cascaded endpoint: Generate genomic regions using a two-level caching mechanism for downstream pipeline steps.

    :input:
        :param formdata: Dictionary of region extraction parameters and Ensembl or NCBI source info.
        :type formdata: dict

    :output:
        :returns: JSON with status, message, and annotation file paths (for .fna files).
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Prepare user/session-specific working directory.
        3. Insert new MongoDB run document.
        4. First-level cache check: look for already built region FASTAs under cache/cached_genomic_*.
        5. If cache miss, perform second-level cache: fetch or reuse raw .gtf.gz and .fna.gz from NCBI or Ensembl, verify MD5, decompress, and reuse.
        6. Build a custom YAML config pointing to the cached decompressed files.
        7. Run genomic region generator in "custom" mode.
        8. Collect output region FASTAs.
        9. Update MongoDB status and return result.
    """
    require_terms_acceptance_for_current_context()

    # Handle authentication/session to determine user directory
    user_id, session_id, user_dir = get_user_context_with_directory()

    form_data = request.json
    _validate_genomic_form_data(form_data, allowed_sources=["NCBI", "Ensembl", "Custom"])

    timestamp = utc_now()
    genomic_type = form_data["source"]
    run_output_path = (
        user_dir / f"output_genomic_{genomic_type}_{timestamp_for_display(timestamp, separator='_')}"
    )

    run_doc = {
        "session_id": session_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "output_path": serialize_path(run_output_path),
        "status": "started",
        "pipeline": "Genomic Region Generator",
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    run_id = run_result.inserted_id

    single_region_forms = generate_single_region_forms(form_data)

    if not single_region_forms:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: no valid genomic regions specified")

    all_fna_files: list[Path] = []
    cached_skips = []
    cache_dir = Path(current_app.root_path) / "cache"

    for single_form in single_region_forms:
        cache_key = get_form_cache_key(single_form)
        output_path = cache_dir / f"cached_genomic_{cache_key}"
        output_gen = output_path / "annotation"

        # ---------------------------------------------
        # First-line cache: region FASTAs already built?
        # ---------------------------------------------
        if output_gen.exists() and any(fname.endswith(".fna") for fname in os.listdir(output_gen)):
            for fname in os.listdir(output_gen):
                if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                    all_fna_files.append(output_gen / fname)
            cached_skips.append(cache_key)
            continue

        # ---------------------------------------------
        # Determine which upstream (NCBI or Ensembl) we are caching from, then always run in custom mode
        # ---------------------------------------------
        cache_dir.mkdir(parents=True, exist_ok=True)
        source_params = single_form.get("source_params", {})
        source_val = single_form.get("source", "").lower()

        if source_val == "ensembl":
            # Ensembl second-line cache
            species = source_params.get("species")
            ann_rel = source_params.get("annotation_release")
            if not species or ann_rel is None:
                abort(
                    HTTPStatus.BAD_REQUEST,
                    description="Custom genomic (Ensembl) requires 'species' and 'annotation_release' in source_params.",
                )
            cache_info = EnsemblGenomicDataBase(cache_dir=cache_dir).prepare_cached_assets(species, ann_rel)
            genome_assembly = cache_info["genome_assembly"]
            resolved_rel = cache_info["annotation_release"]
            annotation_file = cache_info["annotation_file"]
            sequence_file = cache_info["sequence_file"]
            files_source = "Ensembl"
        else:
            # Default to NCBI second-line cache
            taxon = source_params.get("taxon", "H_sapiens")
            species = source_params.get("species")
            ann_rel = source_params.get("annotation_release")
            if not species or ann_rel is None:
                abort(
                    HTTPStatus.BAD_REQUEST,
                    description="Custom genomic (NCBI) requires 'species' and 'annotation_release' in source_params.",
                )
            cache_info = NCBIGenomicDataBase(cache_dir=cache_dir).prepare_cached_assets(
                taxon, species, ann_rel
            )
            genome_assembly = cache_info["genome_assembly"]
            resolved_rel = cache_info["annotation_release"]
            annotation_file = cache_info["annotation_file"]
            sequence_file = cache_info["sequence_file"]
            files_source = "NCBI"

        # Build custom config pointing to cached decompressed files (BASIC PARAMETERS spec)
        config_path = cache_dir / f"config_genomic_{cache_key}.yaml"
        config_genomic = {
            "dir_output": str(output_path),
            "source": "custom",
            "source_params": {
                "file_annotation": annotation_file,  # required: GTF
                "file_sequence": sequence_file,  # required: FASTA
                "files_source": files_source,  # optional: original source
                "species": species,  # optional
                "annotation_release": to_int(resolved_rel) if str(resolved_rel).isdigit() else resolved_rel,
                "genome_assembly": genome_assembly,  # optional
            },
            "genomic_regions": {key: to_bool(val) for key, val in single_form["genomic_regions"].items()},
            "exon_exon_junction_block_size": to_int(single_form["exon_exon_junction_block_size"]),
        }

        with open(config_path, "w") as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        result = subprocess.run(
            ["genomic_region_generator", "-c", str(config_path)], capture_output=True, text=True
        )
        status = "completed" if result.returncode == 0 else "error"

        if result.returncode != 0:
            current_app.logger.error(f"Custom pipeline failed: {result.stderr}")
            abort(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                description="The pipeline failed to execute. Please check your input and try again.",
            )

        # Collect output .fna files (ignore raw genome)
        if output_gen.exists():
            for fname in os.listdir(output_gen):
                if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                    all_fna_files.append(output_gen / fname)

        # Update run status in MongoDB and clean temp config
        mongo.db.runs.update_one({"_id": run_id}, {"$set": {"status": status}})
        if config_path.exists():
            config_path.unlink()

    return jsonify(
        {
            "status": "success",
            "message": f"Genomic processing completed successfully. {len(cached_skips)} used from cache.",
            "output": [str(path) for path in all_fna_files],
            "cached": cached_skips,
        }
    ), HTTPStatus.OK
