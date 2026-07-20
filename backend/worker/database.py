"""Worker file for MongoDB interaction and related utility functions."""

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.results import UpdateResult

from backend.database import mongo_database
from backend.queue_accounting import _remove_pending_run, queue_accounting_lock
from backend.types import RunStatus
from backend.worker.celery import logger


def _parse_run_id(run_id_str: str) -> ObjectId | None:
    """Tries to parse a valid MongoDB `ObjectId` from a string and returns None if it fails.

    Arguments:
        run_id_str {str} -- The string that should be parsed.

    Returns:
        ObjectId | None -- An ObjectId is returned if the conversion is successful, else None is returned.
    """
    try:
        return ObjectId(run_id_str)
    except InvalidId:
        logger.error(f"Attempted to use invalid value as run id ({run_id_str=})")
        return None


def _update_run(run_id: ObjectId, data: dict[str, Any]) -> UpdateResult:
    """Update a run in the database. The run must already exist in the database.

    Notes:
        This is very similar to `backend.routes.route_helpers.update_run_in_DB`,
        with the main difference being the error handling. This function logs
        an error if the run could not be updated.

    Arguments:
        run_id {ObjectId} -- The pipeline run's id.
        data {dict[str, Any]} -- The data to be set in the database.
    """
    with mongo_database() as db:
        result = db.runs.update_one({"_id": run_id}, {"$set": data})
        if not result.acknowledged:
            logger.error("Failed to update run in database")
        return result


def _update_run_by_task_id(task_id: str, data: dict[str, Any]) -> None:
    """Updates a run by its task id.

    Wraps the `_update_run` method to achieve this behavior.

    Arguments:
        task_id {str} -- The unique task ID of the celery task.
        data {dict[str, Any]} -- The data that should be set.
    """
    run_id = _parse_run_id(task_id)
    if run_id is None:
        return
    _update_run(run_id, data)


def start_pending_run(task_id: str) -> bool:
    """Mark a pending run started and update queue accounting under the shared lock."""
    run_id = _parse_run_id(task_id)
    if run_id is None:
        return False

    with mongo_database() as db:
        with queue_accounting_lock() as redis:
            run = db.runs.find_one({"_id": run_id, "status": RunStatus.PENDING})
            if run is None:
                return False

            result = _update_run(run_id, {"status": RunStatus.STARTED})
            if result.modified_count == 0:
                return False

            _remove_pending_run(redis, db, run)
            return True
