import time
from typing import Any

from celery.signals import task_postrun, task_prerun

from backend.constants import PIPELINE_DURATION_STATS_COLLECTION
from backend.utilities.pipeline import resolve_pipeline_task_status
from backend.utilities.typed_values import utc_now
from backend.worker.helpers import get_worker_db


def _is_pipeline_task(task) -> bool:
    return getattr(task, "name", "") == "backend.worker.tasks.run_pipeline"


def _get_request_header(task, key: str) -> Any:
    headers = getattr(task.request, "headers", {}) or {}
    if key in headers:
        return headers[key]
    return getattr(task.request, key, None)


@task_prerun.connect
def on_task_prerun(task_id, task, *args, **kwargs):
    """Record start time of pipeline tasks for heuristic timeout calculation."""
    if _is_pipeline_task(task):
        started_at = utc_now()
        task.request.prerun_time = time.time()
        task.request.started_at = started_at
        with get_worker_db() as db:
            db.runs.update_one(
                {"task_id": task_id}, {"$set": {"started_at": started_at, "status": "started"}}
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

    with get_worker_db() as db:
        db.runs.update_one(
            {"task_id": task_id}, {"$set": {"status": final_status, "finished_at": finished_at}}
        )

        gene_count = _get_request_header(task, "gene_count")
        if final_status == "success" and isinstance(gene_count, int) and gene_count > 0:
            db[PIPELINE_DURATION_STATS_COLLECTION].update_one(
                {"task_id": task_id},
                {
                    "$set": {
                        "task_id": task_id,
                        "run_id": _get_request_header(task, "run_id"),
                        "pipeline": _get_request_header(task, "pipeline"),
                        "user_id": _get_request_header(task, "user_id"),
                        "session_id": _get_request_header(task, "session_id"),
                        "gene_count": gene_count,
                        "status": final_status,
                        "started_at": started_at,
                        "finished_at": finished_at,
                        "queue_wait_seconds": queue_wait_seconds,
                        "execution_seconds": execution_seconds,
                        "total_seconds": total_seconds,
                    }
                },
                upsert=True,
            )
