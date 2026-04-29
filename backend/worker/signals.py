import time
from typing import Any

from celery.signals import task_postrun, task_prerun

from backend.constants import PIPELINE_RUN_LIFECYCLE_COLLECTION
from backend.utilities.pipeline import resolve_pipeline_task_status
from backend.utilities.timestamps import utc_now
from backend.worker.helpers import get_worker_db


def _is_pipeline_task(task) -> bool:
    return getattr(task, "name", "") == "backend.worker.tasks.run_pipeline"


def _get_request_header(task, key: str) -> Any:
    headers = getattr(task.request, "headers", {}) or {}
    if key in headers:
        return headers[key]
    return getattr(task.request, key, None)


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
    """Record start time of pipeline tasks for heuristic timeout calculation."""
    if _is_pipeline_task(task):
        started_at = utc_now()
        task.request.prerun_time = time.time()
        task.request.started_at = started_at
        with get_worker_db() as db:
            _get_lifecycle_collection(db).update_one(
                {"task_id": task_id},
                {
                    "$set": _get_lifecycle_metadata(task_id, task)
                    | {"started_at": started_at, "status": "started"}
                },
                upsert=True,
            )


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

    execution_seconds = None
    queue_wait_seconds = None
    total_seconds = None

    current_time = time.time()
    if prerun_time is not None:
        execution_seconds = current_time - prerun_time
    if publish_time is not None and prerun_time is not None:
        queue_wait_seconds = prerun_time - float(publish_time)
    if publish_time is not None:
        total_seconds = current_time - float(publish_time)

    lifecycle_update = _get_lifecycle_metadata(task_id, task) | {
        "status": final_status,
        "finished_at": finished_at,
    }
    if started_at is not None:
        lifecycle_update["started_at"] = started_at
    if queue_wait_seconds is not None:
        lifecycle_update["queue_wait_seconds"] = queue_wait_seconds
    if execution_seconds is not None:
        lifecycle_update["execution_seconds"] = execution_seconds
    if total_seconds is not None:
        lifecycle_update["total_seconds"] = total_seconds

    with get_worker_db() as db:
        _get_lifecycle_collection(db).update_one(
            {"task_id": task_id}, {"$set": lifecycle_update}, upsert=True
        )
