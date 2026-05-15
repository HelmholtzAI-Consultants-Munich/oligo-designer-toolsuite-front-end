import logging
from typing import Any

from billiard.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from bson import ObjectId
from bson.errors import InvalidId
from celery.exceptions import ChordError
from celery.worker.request import Request
from pymongo import MongoClient
from pymongo.results import UpdateResult

from backend.config import Config
from backend.types import RunStatus
from backend.utilities.exceptions import ODTCloudError
from backend.worker.celery import app

logger = logging.getLogger(__name__)


def _parse_run_id(run_id_str: str) -> ObjectId | None:
    try:
        return ObjectId(run_id_str)
    except InvalidId:
        return None


def _update_run_in_DB(run_id: ObjectId, data: dict[Any, Any]) -> UpdateResult:
    with MongoClient(Config.MONGO_URI) as client:
        db = client["oligo_db"]
        return db.runs.update_one({"_id": run_id}, {"$set": data})


@app.task()
def pipeline_chord_errback(request: Request, exc: Exception, traceback: str | None, run_id_str: str) -> None:
    logger.info("An error occured during pipeline execution.")

    run_id = _parse_run_id(run_id_str)
    if run_id is None:
        logger.error(f"Pipeline chord errback received invalid run id: {run_id_str}")
        return

    status = RunStatus.FAILURE
    error_message: str
    if isinstance(exc, ChordError):
        # Any exceptions raised in a chord header will be wrapped in a ChordError.
        error_message = "An error occured during genomic region generation."
    # The following lines could be added once we directly call ODT from within the same Python process.
    # elif isinstance(exc, OligoDesignerError):
    #     error_message = "An error occured during pipeline execution."
    elif isinstance(exc, ODTCloudError):
        error_message = str(exc)
    elif isinstance(exc, TimeLimitExceeded | SoftTimeLimitExceeded):
        status = RunStatus.TIMEOUT  # override run status
        error_message = "The pipeline exceeded the time limit."
    else:
        error_message = "An unexpected error occured."

    _update_run_in_DB(run_id, {"status": status, "error_message": error_message})
