import logging
import time
from typing import Any

from celery import Task
from celery.signals import task_postrun, task_prerun

from backend.constants import PIPELINE_RUN_LIFECYCLE_COLLECTION
from backend.utilities.pipeline import resolve_pipeline_task_status
from backend.utilities.timestamps import utc_now
from backend.worker.helpers import get_worker_db

logger = logging.getLogger(__name__)


def _is_pipeline_task(task: Task) -> bool:
    return task.name == "backend.worker.tasks.run_pipeline"


def _get_request_header(task: Task, key: str) -> Any:
    # Custom headers passed at dispatch time are stored in task.request.headers.
    return task.request.headers.get(key)


def _get_lifecycle_collection(db):
    return db[PIPELINE_RUN_LIFECYCLE_COLLECTION]


def _get_lifecycle_metadata(task_id: str, task) -> dict[str, Any]:
    return {
        "task_id": task_id,
        "run_id": _get_request_header(task, "run_id"),
        "pipeline": _get_request_header(task, "pipeline"),
        "user_id": _get_request_header(task, "user_id"),
        "session_id": _get_request_header(task, "session_id"),
        "gene_count": _get_request_header(task, "gene_count"),
    }


@task_prerun.connect
def on_task_prerun(task_id, task, *args, **kwargs):
    """Capture start time of pipeline tasks for heuristic timeout calculation."""
    if _is_pipeline_task(task):
        task.request.prerun_time = time.time()
        task.request.started_at = utc_now()


@task_postrun.connect
def on_task_postrun(task_id, task, state, retval=None, *args, **kwargs):
    """Record completion metadata for pipeline tasks once execution ends."""
    if not _is_pipeline_task(task):
        return

    finished_at = utc_now()
    final_status = resolve_pipeline_task_status(state, retval)
    started_at = getattr(task.request, "started_at", None)
    prerun_time = getattr(task.request, "prerun_time", None)
    publish_time = _get_request_header(task, "publish_time")

    if started_at is None or prerun_time is None or publish_time is None:
        logger.warning(
            "Missing timing data for task %s (started_at=%s, prerun_time=%s, publish_time=%s); "
            "skipping lifecycle DB write.",
            task_id,
            started_at,
            prerun_time,
            publish_time,
        )
        return

    current_time = time.time()
    execution_seconds = current_time - prerun_time
    queue_wait_seconds = prerun_time - float(publish_time)
    total_seconds = current_time - float(publish_time)

    lifecycle_update = _get_lifecycle_metadata(task_id, task) | {
        "status": final_status,
        "finished_at": finished_at,
        "started_at": started_at,
        "queue_wait_seconds": queue_wait_seconds,
        "execution_seconds": execution_seconds,
        "total_seconds": total_seconds,
    }

    with get_worker_db() as db:
        _get_lifecycle_collection(db).update_one(
            {"task_id": task_id}, {"$set": lifecycle_update}, upsert=True
        )
