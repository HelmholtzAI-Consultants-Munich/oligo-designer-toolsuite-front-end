"""Worker file for Celery task handlers.

Read more about task handlers here: https://docs.celeryq.dev/en/latest/userguide/tasks.html#handlers
"""

from typing import Any

from billiard.einfo import ExceptionInfo
from celery import Task

from backend.types import RunStatus
from backend.worker.celery import logger
from backend.worker.database import _parse_run_id, _update_run


class PipelineTask(Task):
    """Custom Task subclass that keeps the database up-to-date with the task state."""

    def _update_run_status(self, task_id: str, handler_name: str, status: RunStatus) -> None:
        run_id = _parse_run_id(task_id)
        if run_id is None:
            logger.error(f"No valid run_id given to {handler_name}: ({task_id=})")
            return
        update_result = _update_run(run_id, {"status": status})
        if update_result.matched_count == 0:
            logger.error(f"Pipeline {handler_name} handler could not update run in database ({task_id=})")

    def before_start(self, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        super().before_start(task_id, args, kwargs)
        self._update_run_status(task_id, "before_start", RunStatus.STARTED)

    def on_success(self, retval: Any, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        super().on_success(retval, task_id, args, kwargs)
        self._update_run_status(task_id, "on_success", RunStatus.SUCCESS)

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
