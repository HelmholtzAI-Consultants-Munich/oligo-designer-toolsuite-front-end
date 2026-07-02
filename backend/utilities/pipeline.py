"""
Pipeline-run mechanics shared across routes and workers: splitting a
multi-region form into single-region forms, computing timeouts, and
deleting a run's files/database entry — centralized here so single and
bulk deletion (and single vs. batched region generation) stay consistent.
"""

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
    """Splits a form into one variant per selected region, since the region
    generator task only knows how to process one region at a time — deep
    copies so mutating one variant's regions can't affect another's.

    Arguments:
        form {dict[str, Any]} -- form with possibly multiple regions set to "true".

    Returns:
        list[dict[str, Any]] -- one form per originally-selected region, each
        with only that region set to "true".
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
    """Single source of truth for valid statuses, so admin status-update
    validation and any other status check can't drift out of sync with
    what the worker actually sets on a run.

    Returns:
        list[str] -- all valid pipeline run status values.
    """
    return ["pending", "started", "success", "failure", "timeout", "empty_result"]


def get_timeout_multiplier(is_authenticated: bool) -> float:
    """Authenticated users get a longer timeout budget than anonymous ones,
    as an incentive to log in for larger/slower runs.

    Arguments:
        is_authenticated {bool} -- whether the current caller is logged in.

    Returns:
        float -- multiplier to apply to the anonymous base timeout.
    """
    if is_authenticated:
        return CeleryConfig.pipeline_timeout_authenticated_multiplier
    return 1.0


def resolve_timeout(is_authenticated: bool) -> int:
    """Deliberately static rather than based on input size/complexity, since
    estimating actual runtime up front isn't reliable — a fixed budget per
    user type is simpler to reason about and enforce consistently.

    Arguments:
        is_authenticated {bool} -- whether the current caller is logged in.

    Returns:
        int -- soft time limit in seconds for the Celery pipeline task.
    """
    return int(CeleryConfig.pipeline_timeout_anon * get_timeout_multiplier(is_authenticated))


def delete_pipeline_run_files_and_db(mongo, run_id_obj):
    """Shared by both single-run and bulk deletion, so both paths clean up
    the same way. File deletion failures are only logged, not fatal — a
    user should still be able to remove a stray run record even if its
    output directory is already gone or unreachable on disk.

    Arguments:
        mongo -- MongoDB database instance.
        run_id_obj -- ObjectId of the run to delete.
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
    """Deletes each run independently and catches per-run failures, so one
    bad/already-missing run in a batch doesn't abort deletion of the rest —
    callers get back which ones failed instead of an all-or-nothing error.

    Arguments:
        mongo -- MongoDB database instance.
        run_id_objects {list[ObjectId]} -- run IDs to delete (already validated).

    Returns:
        dict -- deleted_count, plus failed run IDs and their error messages.
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
