import logging
from typing import Any

from billiard.einfo import ExceptionInfo
from celery import Task
from pymongo import MongoClient
from pymongo.results import UpdateResult

from backend.config import Config
from backend.types import RunStatus

logger = logging.getLogger(__name__)


def _update_run_in_DB(task_id: str, data: dict[Any, Any]) -> UpdateResult:
    with MongoClient(Config.MONGO_URI) as client:
        db = client["oligo_db"]
        return db.runs.update_one({"task_id": task_id}, {"$set": data})


class PipelineTask(Task):
    def before_start(self, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        super().before_start(task_id, args, kwargs)
        update_result = _update_run_in_DB(task_id, {"status": RunStatus.STARTED})
        if update_result.matched_count == 0:
            logger.error(f"Pipeline before_start handler could not update run in database ({task_id=})")

    def on_success(self, retval: Any, task_id: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> None:
        super().on_success(retval, task_id, args, kwargs)
        update_result = _update_run_in_DB(task_id, {"status": RunStatus.SUCCESS})
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
        """Error handling is done in pipeline_chord_errback."""
        super().on_failure(exc, task_id, args, kwargs, einfo)
