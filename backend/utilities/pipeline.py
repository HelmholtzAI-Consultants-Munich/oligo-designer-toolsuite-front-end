import copy
import hashlib
import json
import logging
import shutil
from http import HTTPStatus

from bson import ObjectId
from flask import abort

from backend.config import CeleryConfig
from backend.extensions import mongo
from backend.utilities.typed_values import deserialize_path, path_for_display

logger = logging.getLogger(__name__)


def get_form_cache_key(form: dict) -> str:
    relevant_part = {
        "source": form.get("source"),
        "source_params": form.get("source_params"),
        "genomic_regions": form.get("genomic_regions"),
    }
    serialized = json.dumps(relevant_part, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


def generate_single_region_forms(form: dict) -> list[dict]:
    """
    Generate separate forms where each form has only one genomic region set to "true",
    and all others set to "false".

    :param form: Original form dictionary with possibly multiple "true" genomic regions
    :return: List of form dictionaries, each with only one "true" genomic region
    """
    true_regions = [key for key, val in form.get("genomic_regions", {}).items() if val == "true"]

    form_variants = []

    for region in true_regions:
        new_form = copy.deepcopy(form)
        for key in new_form["genomic_regions"]:
            new_form["genomic_regions"][key] = "true" if key == region else "false"
        form_variants.append(new_form)

    return form_variants


def get_valid_pipeline_statuses():
    """
    Get the list of valid pipeline run statuses.

    :returns: List of valid status strings
    :rtype: list[str]
    """
    return ["pending", "started", "success", "failure"]


def _get_heuristic_rate(pipeline_name: str) -> float | None:
    """Look up the cached percentile seconds-per-gene rate for this pipeline from MongoDB.

    Returns the cached seconds-per-gene rate, or None if unavailable.
    """
    doc = mongo.db.cache.find_one({"_id": "pipeline_timeouts"})
    if doc:
        rate = doc.get("data", {}).get(pipeline_name, {}).get("seconds_per_gene")
        if isinstance(rate, int | float):
            return float(rate)
    return None


def extract_gene_count(form_data: dict) -> int | None:
    """Extract the number of genes from form_data for heuristic timeout normalization.

    file_regions is either a comma-separated gene list or a path to an uploaded .txt file.
    Returns None if the count cannot be determined.
    """
    file_regions = form_data.get("file_regions", "")
    if not file_regions:
        return None
    if not file_regions.endswith(".txt"):
        genes = [g.strip() for g in file_regions.split(",") if g.strip()]
        return len(genes) if genes else None
    try:
        with open(file_regions) as f:
            count = sum(1 for line in f if line.strip())
        return count if count > 0 else None
    except OSError:
        logger.warning(f"Could not read gene count from file_regions path: {file_regions}")
        return None


def get_timeout_multiplier(is_authenticated: bool) -> float:
    """Return the configured timeout multiplier for the current user type."""
    if is_authenticated:
        return CeleryConfig.pipeline_timeout_authenticated_multiplier
    return 1.0


def _get_config_timeout(is_authenticated: bool) -> int:
    """Return the configured fixed timeout for the current user type."""
    return int(CeleryConfig.pipeline_timeout_anon * get_timeout_multiplier(is_authenticated))


def resolve_timeout(pipeline_name: str, is_authenticated: bool, gene_count: int | None) -> int:
    """Return soft time limit in seconds for this pipeline run.

    In heuristic mode, multiplies the cached percentile seconds-per-gene rate by the
    current run's gene count and the configured safety factor. Falls back to fixed
    config values if no cache data exists or gene count is unavailable.
    """
    if CeleryConfig.pipeline_timeout_mode == "heuristic":
        cached_rate = _get_heuristic_rate(pipeline_name)
        if cached_rate is not None and gene_count:
            return int(
                cached_rate
                * gene_count
                * CeleryConfig.pipeline_timeout_heuristic_factor
                * get_timeout_multiplier(is_authenticated)
            )
    return _get_config_timeout(is_authenticated)


def delete_pipeline_run_files_and_db(mongo, run_id_obj):
    """
    Delete a pipeline run's output files and database entry.

    :param mongo: MongoDB instance
    :param run_id_obj: ObjectId of the run to delete
    :raises: 404 if the run does not exist
    :raises: 500 if the database deletion fails
    """
    # Fetch the run
    run = mongo.db.runs.find_one({"_id": run_id_obj})

    if not run:
        abort(HTTPStatus.NOT_FOUND)

    # Delete output files/folders
    output_path = deserialize_path(run.get("output_path"))
    if output_path and output_path.exists():
        try:
            shutil.rmtree(output_path)
        except Exception as e:
            output_label = path_for_display(run.get("output_path"))
            logger.warning(f"Failed to delete output directory {output_label}: {e!s}")
            # Continue with DB deletion even if file deletion fails

    # Remove from database
    result = mongo.db.runs.delete_one({"_id": run_id_obj})

    if result.deleted_count == 0:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR)


def execute_bulk_pipeline_run_deletion(mongo, run_id_objects: list[ObjectId]) -> dict:
    """
    Bulk delete multiple pipeline runs using the shared deletion helper.
    Handles partial failures gracefully.

    :param mongo: MongoDB instance
    :param run_id_objects: List of run ID ObjectIds to delete (already validated)
    :type run_id_objects: list[ObjectId]
    :returns: Dictionary with deletion results (deleted_count, failed, errors)
    :rtype: dict
    """
    # Delete each run using the shared helper
    deleted_count = 0
    failed = []
    errors = []

    for run_id_obj in run_id_objects:
        try:
            delete_pipeline_run_files_and_db(mongo, run_id_obj)
            deleted_count += 1
        except Exception as e:
            failed.append(str(run_id_obj))
            errors.append(str(e))

    return {
        "deleted_count": deleted_count,
        "failed": failed,
        "errors": errors,
    }
