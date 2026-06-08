import copy
import logging
import shutil
from http import HTTPStatus
from typing import Any

from bson import ObjectId
from flask import abort, current_app

from backend.config import CeleryConfig
from backend.utilities.typed_values import deserialize_path, path_for_display

logger = logging.getLogger(__name__)


def generate_single_region_forms(form: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Generate separate forms where each form has only one genomic region set to "true",
    and all others set to "false".

    :param form: Original form dictionary with possibly multiple "true" genomic regions
    :return: List of form dictionaries, each with only one "true" genomic region
    """
    true_regions = [key for key, val in form.get("genomic_regions", {}).items() if val]

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
    return ["pending", "started", "success", "failure", "timeout", "empty_result"]


def get_timeout_multiplier(is_authenticated: bool) -> float:
    """Return the configured static timeout multiplier for the current user type."""
    if is_authenticated:
        return CeleryConfig.pipeline_timeout_authenticated_multiplier
    return 1.0


def resolve_timeout(is_authenticated: bool) -> int:
    """Return the soft time limit in seconds for a pipeline run.

    The timeout is intentionally static: anonymous users receive the base limit,
    and authenticated users receive the configured multiplier on that limit.
    """
    return int(CeleryConfig.pipeline_timeout_anon * get_timeout_multiplier(is_authenticated))


def delete_pipeline_run_files_and_db(mongo, run_id_obj):
    """
    Delete a pipeline run's output files and database entry.

    :param mongo: MongoDB instance
    :param run_id_obj: ObjectId of the run to delete
    :raises: 404 if the run does not exist
    :raises: 500 if the database deletion fails
    """
    # Fetch the run
    run = mongo.runs.find_one({"_id": run_id_obj})

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
    result = mongo.runs.delete_one({"_id": run_id_obj})

    if result.deleted_count == 0:
        current_app.logger.error(f"Failed to delete run {run_id_obj}")
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
