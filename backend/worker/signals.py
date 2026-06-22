from datetime import UTC, datetime
from typing import Any

from celery import Task
from celery.signals import task_postrun, task_prerun
from pymongo import MongoClient
from redis import Redis

from backend.config import CeleryConfig, Config
from backend.constants import REDIS_QUEUE_LENGTH_KEY
from backend.worker.converters import parse_datetime


def _is_pipeline_task(task: Task) -> bool:
    return task.name == "backend.worker.tasks.run_pipeline"


def update_queue_positions(task: Task) -> None:
    """Decrease the queue position of pending tasks when a pipeline task starts."""
    redis = Redis.from_url(Config.REDIS_URI)
    try:
        with MongoClient(Config.MONGO_URI) as client:
            db = client["oligo_db"]
            if (
                task.request.delivery_info.get("priority", CeleryConfig.task_default_priority)
                == CeleryConfig.task_high_priority
            ):
                # remove one high priority task ahead of all pending tasks
                db.runs.update_many(
                    {"status": "pending", "queue_position.0": {"$gt": 0}},
                    {"$inc": {"queue_position.0": -1}},
                )
                redis.hincrby(REDIS_QUEUE_LENGTH_KEY, "high", -1)
            else:
                # remove one low priority task ahead of all pending low priority tasks
                db.runs.update_many(
                    {"status": "pending", "priority": "default", "queue_position.1": {"$gt": 0}},
                    {"$inc": {"queue_position.1": -1}},
                )
                redis.hincrby(REDIS_QUEUE_LENGTH_KEY, "default", -1)
    finally:
        redis.close()


def capture_start_time(task_id: str, task: Task) -> None:
    """Store the task start timestamp and queue wait duration on the run."""
    started_at = datetime.now(UTC)
    task.request.started_at = started_at

    metrics: dict[str, Any] = {"started_at": started_at}
    enqueued_at = parse_datetime((task.request.headers or {}).get("enqueued_at"))
    if enqueued_at is not None:
        metrics["queue_wait_seconds"] = max((started_at - enqueued_at).total_seconds(), 0.0)

    with MongoClient(Config.MONGO_URI) as client:
        db = client["oligo_db"]
        db.runs.update_one(
            {"task_id": task_id},
            {"$set": {f"metrics.{key}": value for key, value in metrics.items()}},
        )


def capture_completion_metrics(task_id: str, task: Task) -> None:
    """Store task finish timestamp and elapsed durations on the run."""
    finished_at = datetime.now(UTC)
    metrics: dict[str, Any] = {"finished_at": finished_at}

    started_at = getattr(task.request, "started_at", None)
    if started_at is not None:
        metrics["execution_seconds"] = max((finished_at - started_at).total_seconds(), 0.0)

    enqueued_at = parse_datetime((task.request.headers or {}).get("enqueued_at"))
    if enqueued_at is not None:
        metrics["total_seconds"] = max((finished_at - enqueued_at).total_seconds(), 0.0)

    with MongoClient(Config.MONGO_URI) as client:
        db = client["oligo_db"]
        db.runs.update_one(
            {"task_id": task_id},
            {"$set": {f"metrics.{key}": value for key, value in metrics.items()}},
        )


@task_prerun.connect
def on_task_prerun(task_id, task, *args, **kwargs):
    if not _is_pipeline_task(task):
        return
    update_queue_positions(task)
    capture_start_time(task_id, task)


@task_postrun.connect
def on_task_postrun(task_id, task, *args, **kwargs):
    if not _is_pipeline_task(task):
        return
    capture_completion_metrics(task_id, task)
