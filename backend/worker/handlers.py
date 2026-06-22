"""Worker file for Celery task handlers.

Read more about task handlers here: https://docs.celeryq.dev/en/latest/userguide/tasks.html#handlers
"""

from typing import Any

from billiard.einfo import ExceptionInfo
from celery import Task

from backend.types import RunStatus
from backend.worker.database import _update_run_by_task


class PipelineTask(Task):
    """Custom Task subclass that keeps the database up-to-date with the task state."""

    def before_start(self, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        super().before_start(task_id, args, kwargs)
        _update_run_by_task(task_id, {"status": RunStatus.STARTED})

    def on_success(self, retval: Any, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        super().on_success(retval, task_id, args, kwargs)
        _update_run_by_task(task_id, {"status": RunStatus.SUCCESS})

    def on_failure(
        self,
        exc: Exception,
        task_id: str,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        einfo: ExceptionInfo,
    ) -> None:
        """Pipeline error handling is done in pipeline_chord_errback."""
        super().on_failure(exc, task_id, args, kwargs, einfo)
