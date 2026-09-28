"""
Pipeline-run mechanics shared across routes and workers: splitting a
multi-region form into single-region forms, computing timeouts, and
deleting a run's files/database entry
"""

import copy
import logging
import shutil
from http import HTTPStatus
from typing import Any

from bson import ObjectId
from flask import abort

from backend.config import CeleryConfig, Config
from backend.extensions import celery_app
from backend.queue_accounting import _remove_pending_run, queue_accounting_lock
from backend.types import RunStatus
from backend.utilities.typed_values import deserialize_path, path_for_display

logger = logging.getLogger(__name__)


def generate_single_region_forms(form: dict[str, Any]) -> list[dict[str, Any]]:
    """Splits a form into several forms with one form per selected genomic region

    Arguments:
        form {dict[str, Any]} -- form with possibly multiple regions set to "true".

    Notes:
        The region generator task only knows how to process one region at a
        time.(gene, exon,...) Each form for each gene is deep-copied  so that the data for the different region are independent.

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


def get_valid_pipeline_statuses() -> list[str]:
    """Returns all valid pipeline run status values.

    Returns:
        list[str] -- all valid pipeline run status values.
    """
    return ["pending", "started", "success", "failure", "timeout", "empty_result"]


def get_timeout_multiplier(is_authenticated: bool) -> float:
    """Returns the timeout multiplier for the given authentication state.

    Arguments:
        is_authenticated {bool} -- whether the current caller is logged in.

    Notes:
        Authenticated users get a longer timeout budget than anonymous ones,
        as an incentive to log in for larger/slower runs.

    Returns:
        float -- multiplier to apply to the anonymous base timeout.
    """
    if is_authenticated:
        return CeleryConfig.pipeline_timeout_authenticated_multiplier
    return 1.0


def resolve_timeout(is_authenticated: bool) -> int:
    """Resolves the soft time limit for the Celery pipeline task.

    Arguments:
        is_authenticated {bool} -- whether the current caller is logged in.

    Returns:
        int -- soft time limit in seconds for the Celery pipeline task.
    """
    return int(CeleryConfig.pipeline_timeout_anon * get_timeout_multiplier(is_authenticated))


def delete_pipeline_run_files_and_db(mongo, run_id_obj):
    """Deletes a pipeline run's output files and database record.

    Arguments:
        mongo {pymongo.database.Database} -- MongoDB database instance.
        run_id_obj {ObjectId} -- ObjectId of the run to delete.

    Raises:
        NotFound: if run_id_obj doesn't match an existing run, including a
        race where it's deleted between the lookup and the delete.

    Notes:
        An uncaught database error during the delete itself propagates as
        a 500, rather than being caught and converted to an error response.
    """
    run = mongo.runs.find_one({"_id": run_id_obj})
    if not run:
        abort(HTTPStatus.NOT_FOUND)

    initial_status = run.get("status")
    if initial_status in (RunStatus.PENDING, RunStatus.STARTED):
        try:
            # PENDING describes the callback; genomic header tasks may already be running,
            # so terminate matching active tasks for both cancellable run states.
            celery_app.control.revoke_by_stamped_headers(
                {Config.CELERY_PIPELINE_RUN_STAMP: str(run_id_obj)},
                terminate=True,
                signal="SIGTERM",
            )
        except Exception:
            logger.exception("Failed to revoke pipeline chord for run %s", run_id_obj)

    with queue_accounting_lock() as redis:
        result = mongo.runs.delete_one({"_id": run_id_obj})
        if result.deleted_count == 0:
            abort(HTTPStatus.NOT_FOUND)

        if initial_status == RunStatus.PENDING:
            _remove_pending_run(redis, mongo, run)

    # Delete output files/folders
    output_path_value = run.get("output_path")
    output_path = deserialize_path(output_path_value)
    if output_path and output_path.exists():
        try:
            shutil.rmtree(output_path)
        except Exception as e:
            output_label = path_for_display(output_path_value)
            logger.warning(f"Failed to delete output directory {output_label}: {e!s}")


def execute_bulk_pipeline_run_deletion(mongo, run_id_objects: list[ObjectId]) -> dict:
    """Deletes multiple pipeline runs

    Arguments:
        mongo {pymongo.database.Database} -- MongoDB database instance.
        run_id_objects {list[ObjectId]} -- run IDs to delete (already validated).

    Notes:
        Each run is deleted independently and per-run failures are caught,
        so one bad/already-missing run in a batch doesn't abort deletion of
        the rest.

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
