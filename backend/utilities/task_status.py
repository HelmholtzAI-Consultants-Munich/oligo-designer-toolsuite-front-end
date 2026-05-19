from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded


def resolve_pipeline_task_status(celery_state: str, task_result: bool | Exception | None) -> str:
    """Map Celery task outcome data to the persisted pipeline run status.

    This module intentionally does not import Flask so it can be shared between
    the Flask server and the Celery worker without introducing cross-boundary dependencies.
    """
    normalized_state = celery_state.lower()
    if normalized_state == "success":
        return "success" if task_result else "failure"
    if normalized_state == "failure" and isinstance(task_result, SoftTimeLimitExceeded | TimeLimitExceeded):
        return "timeout"
    return normalized_state
