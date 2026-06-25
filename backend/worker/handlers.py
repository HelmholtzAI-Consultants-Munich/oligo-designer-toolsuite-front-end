"""Worker file for Celery task handlers.

Read more about task handlers here: https://docs.celeryq.dev/en/latest/userguide/tasks.html#handlers
"""

from typing import Any

from billiard.einfo import ExceptionInfo
from celery import Task
from celery.exceptions import TaskRevokedError

from backend.queue_accounting import start_pending_run
from backend.types import RunStatus
from backend.worker.celery import logger
from backend.worker.database import _update_run_by_task_id


class PipelineTask(Task):
    """Custom Task subclass that keeps the database up-to-date with the task state."""

    def _log_handler_call(self, handler_name: str, task_id: str) -> None:
        logger.debug(f"Executing PipelineTask handler ({handler_name=}, {task_id=})")

    def before_start(self, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        self._log_handler_call("before_start", task_id)
        super().before_start(task_id, args, kwargs)
        if not start_pending_run(task_id):
            logger.info(f"Pipeline before_start handler found no pending run ({task_id=})")
            raise TaskRevokedError(task_id)

    def on_success(self, retval: Any, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        self._log_handler_call("on_success", task_id)
        super().on_success(retval, task_id, args, kwargs)
        _update_run_by_task_id(task_id, {"status": RunStatus.SUCCESS})

    def on_failure(
        self,
        exc: Exception,
        task_id: str,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        einfo: ExceptionInfo,
    ) -> None:
        """Pipeline error handling is done in pipeline_chord_errback."""
        self._log_handler_call("on_failure", task_id)
        super().on_failure(exc, task_id, args, kwargs, einfo)
