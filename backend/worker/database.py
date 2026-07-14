"""Worker file for MongoDB interaction and related utility functions."""

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient

from backend.config import Config
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


def _update_run(run_id: ObjectId, data: dict[str, Any]) -> None:
    """Update a run in the database. The run must already exist in the database.

    Notes:
        This is very similar to `backend.routes.route_helpers.update_run_in_DB`,
        with the main difference being the error handling. This function logs
        an error if the run could not be updated.

    Arguments:
        run_id {ObjectId} -- The pipeline run's id.
        data {dict[str, Any]} -- The data to be set in the database.
    """
    with MongoClient(Config.MONGO_URI) as client:
        db = client["oligo_db"]
        update_result = db.runs.update_one({"_id": run_id}, {"$set": data})

    if not update_result.acknowledged:
        logger.error("Failed to update run in database")


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
