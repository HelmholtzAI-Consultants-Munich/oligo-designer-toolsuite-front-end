from typing import Any

from celery import Task
from celery.signals import task_postrun, task_prerun

from backend.utils import utc_now
from backend.worker.celery import logger
from backend.worker.converters import parse_datetime
from backend.worker.database import _update_run_by_task_id
from backend.worker.task_index import Tasks


def _is_pipeline_task(task: Task) -> bool:
    return task.name == Tasks.RUN_PIPELINE


def capture_start_time(task_id: str, task: Task) -> None:
    """Store the task start timestamp and queue wait duration on the run."""
    started_at = utc_now()
    task.request.started_at = started_at  # pyrefly:ignore

    metrics: dict[str, Any] = {"started_at": started_at}
    enqueued_at = parse_datetime((task.request.headers or {}).get("enqueued_at"))
    if enqueued_at is not None:
        metrics["queue_wait_seconds"] = max((started_at - enqueued_at).total_seconds(), 0.0)

    _update_run_by_task_id(task_id, {f"metrics.{key}": value for key, value in metrics.items()})


def capture_completion_metrics(task_id: str, task: Task) -> None:
    """Store task finish timestamp and elapsed durations on the run."""
    finished_at = utc_now()
    metrics: dict[str, Any] = {"finished_at": finished_at}

    started_at = getattr(task.request, "started_at", None)
    if started_at is not None:
        metrics["execution_seconds"] = max((finished_at - started_at).total_seconds(), 0.0)

    enqueued_at = parse_datetime((task.request.headers or {}).get("enqueued_at"))
    if enqueued_at is not None:
        metrics["total_seconds"] = max((finished_at - enqueued_at).total_seconds(), 0.0)

    _update_run_by_task_id(task_id, {f"metrics.{key}": value for key, value in metrics.items()})


def _log_signal_call(signal_name: str, task_id: str) -> None:
    logger.debug(f"Executing Celery signal ({signal_name=}, {task_id=})")


@task_prerun.connect
def on_task_prerun(task_id, task, *args, **kwargs) -> None:
    if not _is_pipeline_task(task):
        return
    _log_signal_call("on_task_prerun", task_id)
    capture_start_time(task_id, task)


@task_postrun.connect
def on_task_postrun(task_id, task, *args, **kwargs) -> None:
    if not _is_pipeline_task(task):
        return
    _log_signal_call("on_task_postrun", task_id)
    capture_completion_metrics(task_id, task)
