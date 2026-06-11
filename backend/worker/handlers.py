"""Worker file for Celery task handlers.

Read more about task handlers here: https://docs.celeryq.dev/en/latest/userguide/tasks.html#handlers
"""

from typing import Any

from billiard.einfo import ExceptionInfo
from celery import Task
from celery.exceptions import Ignore

from backend.queue_accounting import start_pending_run
from backend.types import RunStatus
from backend.worker.celery import logger
from backend.worker.database import _update_run_by_task


class PipelineTask(Task):
    """Custom Task subclass that keeps the database up-to-date with the task state."""

    def before_start(self, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        super().before_start(task_id, args, kwargs)
        if not start_pending_run(task_id):
            logger.info(f"Pipeline before_start handler found no pending run ({task_id=})")
            raise Ignore()

    def on_success(self, retval: Any, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        super().on_success(retval, task_id, args, kwargs)
        update_result = _update_run_by_task(task_id, {"status": RunStatus.SUCCESS})
        if update_result.matched_count == 0:
            logger.error(f"Pipeline success handler could not update run in database ({task_id=})")

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
