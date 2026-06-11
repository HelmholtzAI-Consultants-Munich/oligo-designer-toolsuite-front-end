from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from pymongo import MongoClient
from redis import Redis
from redis.exceptions import LockError

from backend.config import CeleryConfig, Config
from backend.types import RunStatus

PIPELINE_RUN_STAMP = "pipeline_run_id"


def _change_queue_length(redis: Redis, priority: str, change: int) -> int:
    current = redis.hget(Config.REDIS_QUEUE_LENGTH_KEY, priority)
    new_length = max(int(current or 0) + change, 0)
    redis.hset(Config.REDIS_QUEUE_LENGTH_KEY, priority, new_length)
    return new_length


@contextmanager
def queue_accounting_lock() -> Iterator[Redis]:
    """Hold the global queue-accounting lock and yield its Redis client."""
    redis = Redis.from_url(Config.REDIS_URI)
    lock = redis.lock(
        Config.REDIS_QUEUE_ACCOUNTING_LOCK_KEY,
        timeout=Config.REDIS_QUEUE_ACCOUNTING_LOCK_TIMEOUT,
    )
    try:
        if not lock.acquire(blocking=True):
            raise LockError(f"Unable to acquire Redis lock {Config.REDIS_QUEUE_ACCOUNTING_LOCK_KEY}")
        yield redis
    finally:
        if lock.owned():
            lock.release()
        redis.close()


def add_pending_run(redis: Redis, mongo: Any, priority: int) -> tuple[int, int]:
    """Account for a newly enqueued run and return its queue position."""
    default_length, high_length = (
        int(value or 0) for value in redis.hmget(Config.REDIS_QUEUE_LENGTH_KEY, ["default", "high"])
    )

    if priority == CeleryConfig.task_high_priority:
        mongo.runs.update_many(
            {"status": RunStatus.PENDING, "priority": "default"},
            {"$inc": {"queue_position.0": 1}},
        )
        _change_queue_length(redis, "high", 1)
        return high_length, 0

    _change_queue_length(redis, "default", 1)
    return high_length, default_length


def remove_pending_run(redis: Redis, mongo: Any, run: dict[str, Any]) -> None:
    """Remove a pending run from counters and advance runs queued behind it."""
    priority = run.get("priority", "default")
    position = run.get("queue_position") or (0, 0)

    if priority == "high":
        mongo.runs.update_many(
            {
                "status": RunStatus.PENDING,
                "queue_position.0": {"$gt": position[0]},
            },
            {"$inc": {"queue_position.0": -1}},
        )
    else:
        mongo.runs.update_many(
            {
                "status": RunStatus.PENDING,
                "priority": "default",
                "queue_position.1": {"$gt": position[1]},
            },
            {"$inc": {"queue_position.1": -1}},
        )

    _change_queue_length(redis, priority, -1)


def start_pending_run(task_id: str) -> bool:
    """Atomically mark a pending run started and remove it from queue accounting."""
    with MongoClient(Config.MONGO_URI) as client:
        mongo = client["oligo_db"]
        with queue_accounting_lock() as redis:
            run = mongo.runs.find_one({"task_id": task_id, "status": RunStatus.PENDING})
            if run is None:
                return False

            result = mongo.runs.update_one(
                {"_id": run["_id"], "status": RunStatus.PENDING},
                {"$set": {"status": RunStatus.STARTED}},
            )
            if result.modified_count == 0:
                return False

            remove_pending_run(redis, mongo, run)
            return True
