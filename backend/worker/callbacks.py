from billiard.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from celery.exceptions import ChordError
from celery.worker.request import Request

from backend.exceptions import ODTCloudError, ODTEmptyResultError
from backend.types import RunStatus
from backend.worker.celery import app, logger
from backend.worker.database import _parse_run_id, _update_run


@app.task()
def pipeline_chord_errback(request: Request, exc: BaseException, trace: str | None, run_id_str: str) -> None:
    """Error handling callback (errback) for pipeline chords.

    Notes:
        The `run_id_str` _must_ be provided explicitly when building the signature linked to the chord.

    Arguments:
        request {Request} -- The execution request received by the worker with task metadata.
        exc {Exception} -- The exception raised during task execution (wrapped in ChordError if raised in chord header).
        traceback {str | None} -- The exception traceback as a str if present.
        run_id_str {str} -- The run id provided when linking the errback.
    """
    logger.info("An error occured during pipeline execution.")

    run_id = _parse_run_id(run_id_str)
    if run_id is None:
        logger.error(f"Pipeline chord errback received invalid run id: {run_id_str}")
        return

    # Extract original exception from ChordError if available
    # NOTE: This is adapted from Celery's `backends.base.Backend._handle_group_chord_error`.
    if isinstance(exc, ChordError) and hasattr(exc, "__cause__") and exc.__cause__:
        exc = exc.__cause__

    status = RunStatus.FAILURE
    error_message: str

    match exc:
        case ChordError():
            error_message = "An error occured during genomic region generation."
        # The following lines could be added once we directly call ODT from within the same Python process.
        # case OligoDesignerError():
        #     error_message = "An error occured during pipeline execution."
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

    _update_run(run_id, {"status": status, "error_message": error_message})
