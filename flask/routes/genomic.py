"""
Genomic endpoints for region generation and processing.

Cascaded endpoints (under `/api/genomic/cascaded/`) are designed to be used as intermediate steps in pipeline workflows:
they generate genomic regions and pass the locations of created files/directories to downstream processes.
Other endpoints are standalone: they run the full pipeline and return the output directly to the user.
"""

import os
import subprocess
from datetime import datetime

import yaml
from extensions import mongo
from flask_login import current_user
from helpers import generate_single_region_forms, get_form_cache_key, to_bool, to_int

from flask import Blueprint, current_app, jsonify, request, session

from .cache_helpers import _prepare_ncbi_cached_assets, _prepare_ensembl_cached_assets
from .error_handlers import create_user_error_response

genomic_bp = Blueprint("genomic", __name__)


def _validate_genomic_form_data(form_data: dict, allowed_sources: list[str] | None = None) -> None:
    """
    Validate genomic form data structure and required fields.

    Args:
        form_data: The form data dictionary to validate
        allowed_sources: List of allowed source values. Defaults to ["NCBI", "Ensembl"]

    Raises:
        ValueError: If validation fails
    """
    if allowed_sources is None:
        allowed_sources = ["NCBI", "Ensembl"]

    if not form_data:
        raise ValueError("Invalid input: form data is required")
    if "source" not in form_data:
        raise ValueError("Invalid input: source is required")
    if form_data["source"] not in allowed_sources:
        raise ValueError(
            f"Invalid input: source must be one of {', '.join(repr(s) for s in allowed_sources)}"
        )
    if "genomic_regions" not in form_data:
        raise ValueError("Invalid input: genomic_regions is required")
    if form_data["source"] == "Custom" and "file_regions" not in form_data:
        raise ValueError("Invalid input: file_regions is required for Custom source")


def _handle_genomic_error(exception: Exception) -> tuple:
    """
    Handle errors in genomic endpoints with consistent error response format.

    Args:
        exception: The exception that was raised

    Returns:
        Tuple of (jsonify response, HTTP status code)
    """
    error_response, status_code = create_user_error_response(exception, "submission")
    error_data = error_response.get_json()
    return jsonify(
        {
            "status": "error",
            "message": "We couldn't process your genomic data. Please check your input and try again.",
            "error": error_data.get("error", "Something went wrong. Please try again."),
        }
    ), status_code


@genomic_bp.route("/api/genomic/cascaded/ncbi", methods=["POST"])
def genomic_cascaded_ncbi():
    """
    Cascaded endpoint: Generate genomic regions from NCBI for downstream pipeline steps.

    :input:
        :param formdata: Dictionary of region extraction parameters and NCBI source info.
        :type formdata: dict

    :output:
        :returns: JSON with status, message, and annotation file paths (for .fna files).
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Set up user/session-specific working directory.
        3. Insert new MongoDB run document.
        4. Build YAML config for NCBI region extraction.
        5. Run genomic region generator. Used cached files if available
        6. Gather annotation output file paths for downstream steps.
        7. Update MongoDB status and return result.
    """
    try:
        # Handle authentication/session to determine user directory
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.config["USERDATA_PATH"], user_id)
            config_path = os.path.join(user_dir, "config_genomic_ensemble.yaml")
            session_id = None
        else:
            user_id = None
            session_id = session.get("session_id")
            if not session_id:
                return jsonify({"error": "Anonymous session ID not found"}), 403
            user_dir = os.path.join(current_app.config["USERDATA_PATH"], "anon", session_id)
            config_path = os.path.join(user_dir, "config.yaml")
        config_genomic = {}

        # Parse JSON data from the request
        form_data = request.json
        _validate_genomic_form_data(form_data)

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        output_path = os.path.join(user_dir, f"output_genomic_ncbi_{timestamp}")
        output_gen = output_path + "/annotation"

        # Insert run document in MongoDB
        run_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": output_path,
            "status": "started",
            "pipeline": "Genomic Region Generator",
        }
        run_result = mongo.db.runs.insert_one(run_doc)
        run_id = run_result.inserted_id
        single_region_forms = generate_single_region_forms(
            form_data
        )  # creates a list of forms with only one region set to true

        if not single_region_forms:
            raise ValueError("Invalid input: no valid genomic regions specified")

        all_fna_files = []
        cached_skips = []
        cache_dir = os.path.join(current_app.root_path, "cache")
        for (
            single_form
        ) in single_region_forms:  # iterates over the list of forms with only one region set to true
            cache_key = get_form_cache_key(single_form)
            output_path = os.path.join(cache_dir, f"cached_genomic_{cache_key}")
            output_gen = os.path.join(output_path, "annotation")

            # Check if cached output already exists
            if os.path.exists(output_gen) and any(fname.endswith(".fna") for fname in os.listdir(output_gen)):
                # Cached hit, reuse
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))
                cached_skips.append(cache_key)
                continue

            # Not cached — generate YAML and run pipeline
            # Ensure cache directory exists
            os.makedirs(cache_dir, exist_ok=True)
            config_path = os.path.join(cache_dir, f"config_genomic_{cache_key}.yaml")
            config_genomic = {
                "dir_output": output_path,
                "source": single_form["source"],
                "source_params": {
                    "taxon": single_form["source_params"]["taxon"],
                    "species": single_form["source_params"]["species"],
                    "annotation_release": to_int(single_form["source_params"]["annotation_release"]),
                },
                "genomic_regions": {key: to_bool(val) for key, val in single_form["genomic_regions"].items()},
                "exon_exon_junction_block_size": to_int(single_form["exon_exon_junction_block_size"]),
            }

            with open(config_path, "w") as yaml_file:
                yaml.dump(config_genomic, yaml_file)

            result = subprocess.run(
                ["genomic_region_generator", "-c", config_path], capture_output=True, text=True
            )
            status = "completed" if result.returncode == 0 else "error"

            if result.returncode != 0:
                raise RuntimeError(f"Pipeline failed: {result.stderr}")

            # Collect output .fna files (ignore GCF/GCA)
            if os.path.exists(output_gen):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))

            # Update run status in MongoDB
            mongo.db.runs.update_one({"_id": run_id}, {"$set": {"status": status}})
            if os.path.exists(config_path):
                os.remove(config_path)

            if result.returncode != 0:
                return jsonify(
                    {
                        "status": "error",
                        "message": "An error occurred during genomic processing.",
                        "error": result.stderr,
                    }
                ), 500

        return jsonify(
            {
                "status": "success",
                "message": f"Genomic processing completed successfully. {len(cached_skips)} used from cache.",
                "output": all_fna_files,
                "cached": cached_skips,
            }
        ), 200
    except Exception as e:
        return _handle_genomic_error(e)


@genomic_bp.route("/api/genomic/cascaded/ensembl", methods=["POST"])
def genomic_cascaded_ensemble():
    """
    Cascaded endpoint: Generate genomic regions from Ensembl for downstream pipeline steps.

    :input:
        :param formdata: Dictionary of region extraction parameters and Ensembl source info.
        :type formdata: dict

    :output:
        :returns: JSON with status, message, and annotation file paths (for .fna files).
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Set up user/session-specific working directory.
        3. Insert new MongoDB run document.
        4. Build YAML config for Ensembl region extraction.
        5. Run genomic region generator. Used cached files if available
        6. Gather annotation output file paths for downstream steps.
        7. Update MongoDB status and return result.
    """
    try:
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.config["USERDATA_PATH"], user_id)
            session_id = None
        else:
            user_id = None
            session_id = session.get("session_id")
            if not session_id:
                return jsonify({"error": "Anonymous session ID not found"}), 403
            user_dir = os.path.join(current_app.config["USERDATA_PATH"], "anon", session_id)

        form_data = request.json
        _validate_genomic_form_data(form_data)

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        run_output_path = os.path.join(user_dir, f"output_genomic_ensemble_{timestamp}")

        run_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": run_output_path,
            "status": "started",
            "pipeline": "Genomic Region Generator",
        }
        run_result = mongo.db.runs.insert_one(run_doc)
        run_id = run_result.inserted_id

        single_region_forms = generate_single_region_forms(form_data)

        if not single_region_forms:
            raise ValueError("Invalid input: no valid genomic regions specified")

        all_fna_files = []
        cached_skips = []
        cache_dir = os.path.join(current_app.root_path, "cache")

        for single_form in single_region_forms:
            cache_key = get_form_cache_key(single_form)
            output_path = os.path.join(cache_dir, f"cached_genomic_{cache_key}")
            output_gen = os.path.join(output_path, "annotation")

            if os.path.exists(output_gen) and any(fname.endswith(".fna") for fname in os.listdir(output_gen)):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))
                cached_skips.append(cache_key)
                continue

            # Ensure cache directory exists
            os.makedirs(cache_dir, exist_ok=True)
            config_path = os.path.join(cache_dir, f"config_genomic_{cache_key}.yaml")
            config_genomic = {
                "dir_output": output_path,
                "source": single_form["source"],
                "source_params": {
                    "species": single_form["source_params"]["species"],
                    "annotation_release": to_int(single_form["source_params"]["annotation_release"]),
                },
                "genomic_regions": {key: to_bool(val) for key, val in single_form["genomic_regions"].items()},
                "exon_exon_junction_block_size": to_int(single_form["exon_exon_junction_block_size"]),
            }

            with open(config_path, "w") as yaml_file:
                yaml.dump(config_genomic, yaml_file)

            result = subprocess.run(
                ["genomic_region_generator", "-c", config_path], capture_output=True, text=True
            )
            status = "completed" if result.returncode == 0 else "error"

            if result.returncode != 0:
                raise RuntimeError(f"Pipeline failed: {result.stderr}")

            if os.path.exists(output_gen):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))

            mongo.db.runs.update_one({"_id": run_id}, {"$set": {"status": status}})
            if os.path.exists(config_path):
                os.remove(config_path)

        return jsonify(
            {
                "status": "success",
                "message": f"Genomic processing completed successfully. {len(cached_skips)} used from cache.",
                "output": all_fna_files,
                "cached": cached_skips,
            }
        ), 200

    except Exception as e:
        return _handle_genomic_error(e)


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
    try:
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.config["USERDATA_PATH"], user_id)
            session_id = None
        else:
            user_id = None
            session_id = session.get("session_id")
            if not session_id:
                return jsonify({"error": "Anonymous session ID not found"}), 403
            user_dir = os.path.join(current_app.config["USERDATA_PATH"], "anon", session_id)

        form_data = request.json
        _validate_genomic_form_data(form_data, allowed_sources=["NCBI", "Ensembl", "Custom"])

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        genomic_type = form_data["source"]
        run_output_path = os.path.join(user_dir, f"output_genomic_{genomic_type}_{timestamp}")

        run_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": run_output_path,
            "status": "started",
            "pipeline": "Genomic Region Generator",
        }
        run_result = mongo.db.runs.insert_one(run_doc)
        run_id = run_result.inserted_id

        single_region_forms = generate_single_region_forms(form_data)

        if not single_region_forms:
            raise ValueError("Invalid input: no valid genomic regions specified")

        all_fna_files = []
        cached_skips = []
        cache_dir = os.path.join(current_app.root_path, "cache")

        for single_form in single_region_forms:
            cache_key = get_form_cache_key(single_form)
            output_path = os.path.join(cache_dir, f"cached_genomic_{cache_key}")
            output_gen = os.path.join(output_path, "annotation")

            # ---------------------------------------------
            # First-line cache: region FASTAs already built?
            # ---------------------------------------------
            if os.path.exists(output_gen) and any(fname.endswith(".fna") for fname in os.listdir(output_gen)):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))
                cached_skips.append(cache_key)
                continue

            # ---------------------------------------------
            # Determine which upstream (NCBI or Ensembl) we are caching from, then always run in custom mode
            # ---------------------------------------------
            os.makedirs(cache_dir, exist_ok=True)
            source_params = single_form.get("source_params", {})
            source_val = single_form.get("source", "").lower()

            if source_val == "ensembl":
                # Ensembl second-line cache
                species = source_params.get("species")
                ann_rel = source_params.get("annotation_release")
                if not species or ann_rel is None:
                    raise RuntimeError(
                        "Custom genomic (Ensembl) requires 'species' and 'annotation_release' in source_params."
                    )
                cache_info = _prepare_ensembl_cached_assets(cache_dir, species, ann_rel)
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
                    raise RuntimeError(
                        "Custom genomic (NCBI) requires 'species' and 'annotation_release' in source_params."
                    )
                cache_info = _prepare_ncbi_cached_assets(cache_dir, taxon, species, ann_rel)
                genome_assembly = cache_info["genome_assembly"]
                resolved_rel = cache_info["annotation_release"]
                annotation_file = cache_info["annotation_file"]
                sequence_file = cache_info["sequence_file"]
                files_source = "NCBI"

            # Build custom config pointing to cached decompressed files (BASIC PARAMETERS spec)
            config_path = os.path.join(cache_dir, f"config_genomic_{cache_key}.yaml")
            config_genomic = {
                "dir_output": output_path,
                "source": "custom",
                "source_params": {
                    "file_annotation": annotation_file,  # required: GTF
                    "file_sequence": sequence_file,  # required: FASTA
                    "files_source": files_source,  # optional: original source
                    "species": species,  # optional
                    "annotation_release": to_int(resolved_rel)
                    if str(resolved_rel).isdigit()
                    else resolved_rel,
                    "genome_assembly": genome_assembly,  # optional
                },
                "genomic_regions": {key: to_bool(val) for key, val in single_form["genomic_regions"].items()},
                "exon_exon_junction_block_size": to_int(single_form["exon_exon_junction_block_size"]),
            }

            with open(config_path, "w") as yaml_file:
                yaml.dump(config_genomic, yaml_file)

            result = subprocess.run(
                ["genomic_region_generator", "-c", config_path], capture_output=True, text=True
            )
            status = "completed" if result.returncode == 0 else "error"

            if result.returncode != 0:
                raise RuntimeError(f"Pipeline failed: {result.stderr}")

            # Collect output .fna files (ignore raw genome)
            if os.path.exists(output_gen):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))

            # Update run status in MongoDB and clean temp config
            mongo.db.runs.update_one({"_id": run_id}, {"$set": {"status": status}})
            if os.path.exists(config_path):
                os.remove(config_path)

        return jsonify(
            {
                "status": "success",
                "message": f"Genomic processing completed successfully. {len(cached_skips)} used from cache.",
                "output": all_fna_files,
                "cached": cached_skips,
            }
        ), 200

    except Exception as e:
        return _handle_genomic_error(e)
