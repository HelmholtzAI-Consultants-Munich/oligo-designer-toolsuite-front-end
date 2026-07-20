"""Callbacks which can be added to a celery task via chaining should be defined here."""

from billiard.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from celery.exceptions import ChordError, TaskRevokedError
from celery.worker.request import Request

from backend.database import mongo_database
from backend.exceptions import ODTCloudError, ODTEmptyResultError
from backend.queue_accounting import _remove_pending_run, queue_accounting_lock
from backend.types import RunStatus
from backend.worker.celery import app, logger
from backend.worker.database import _parse_run_id, _update_run


@app.task()
def pipeline_chord_errback(request: Request, exc: BaseException, trace: str | None) -> None:
    """Error handling callback (errback) for pipeline chords.

    Arguments:
        request {Request} -- The execution request received by the worker with task metadata.
        exc {BaseException} -- The exception raised during task execution (wrapped in ChordError if raised in chord header).
        trace {str | None} -- The exception traceback as a str if present.
    """
    logger.info("A pipeline task did not finish successfully.")

    run_id = _parse_run_id(request.id)
    if run_id is None:
        logger.error(f"Pipeline chord errback received invalid run id: {request.id}")
        return

    # Extract original exception from ChordError if available
    # NOTE: This is adapted from Celery's `backends.base.Backend._handle_group_chord_error`.
    if isinstance(exc, ChordError) and hasattr(exc, "__cause__") and exc.__cause__:
        exc = exc.__cause__

    status = RunStatus.FAILURE
    error_message: str

    match exc:
        case TaskRevokedError():
            # Run was intentionally cancelled and already deleted from the DB — nothing to update.
            logger.info("Pipeline run was revoked, skipping status update.")
            return
        case ChordError():
            error_message = "An error occured during genomic region generation."
        case ODTEmptyResultError():
            status = RunStatus.EMPTY_RESULT  # override run status
            error_message = str(exc)
        case ODTCloudError():
            error_message = str(exc)
        case TimeLimitExceeded() | SoftTimeLimitExceeded():
            status = RunStatus.TIMEOUT  # override run status
            error_message = "The pipeline exceeded the time limit."
        case _:
            error_message = "An unexpected error occured."

    with mongo_database() as db:
        with queue_accounting_lock() as redis:
            run = db.runs.find_one({"_id": run_id, "status": RunStatus.PENDING})
            if run is not None:
                # The run never left the queue (e.g. a genomic region generation header task
                # failed before the pipeline body task started), so its accounting was never
                # cleared by PipelineTask.before_start. Clear it here instead.
                _update_run(run_id, {"status": status, "error_message": error_message})
                _remove_pending_run(redis, db, run)
                return

    _update_run(run_id, {"status": status, "error_message": error_message})
