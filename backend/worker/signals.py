from celery import Task
from celery.signals import task_prerun
from pymongo import MongoClient
from redis import Redis

from backend.config import CeleryConfig, Config


def _is_pipeline_task(task: Task) -> bool:
    return task.name == "backend.worker.tasks.run_pipeline"


@task_prerun.connect
def on_task_prerun(task_id, task, *args, **kwargs):
    """Decrease the queue position of pending tasks when a task starts running."""
    if not _is_pipeline_task(task):
        return
    client = MongoClient(Config.MONGO_URI)
    db = client["oligo_db"]
    redis = Redis.from_url(Config.REDIS_URI)
    if (
        task.request.delivery_info.get("priority", CeleryConfig.task_default_priority)
        == CeleryConfig.task_high_priority
    ):
        # remove one high priority task ahead of all pending tasks
        db.runs.update_many(
            {"status": "pending", "queue_position.0": {"$gt": 0}},
            {"$inc": {"queue_position.0": -1}},
        )
        redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, "high", -1)
    else:
        # remove one low priority task ahead of all pending low priority tasks
        db.runs.update_many(
            {"status": "pending", "priority": "default", "queue_position.1": {"$gt": 0}},
            {"$inc": {"queue_position.1": -1}},
        )
        redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, "default", -1)
