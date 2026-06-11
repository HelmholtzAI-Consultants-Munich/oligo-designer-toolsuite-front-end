from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from redis import Redis
from redis.exceptions import LockError

from backend.config import CeleryConfig, Config
from backend.database import mongo_database
from backend.types import RunStatus


def _decrement_queue_length(redis: Redis, priority: str) -> int:
    new_length = redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, priority, -1)
    if new_length < 0:
        redis.hset(Config.REDIS_QUEUE_LENGTH_KEY, priority, 0)
        return 0
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


def add_pending_run(redis: Redis, db: Any, priority: int) -> tuple[int, int]:
    """Account for a newly enqueued run and return its queue position."""
    default_length, high_length = (
        int(value or 0) for value in redis.hmget(Config.REDIS_QUEUE_LENGTH_KEY, ["default", "high"])
    )

    if priority == CeleryConfig.task_high_priority:
        db.runs.update_many(
            {"status": RunStatus.PENDING, "priority": "default"},
            {"$inc": {"queue_position.0": 1}},
        )
        redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, "high", 1)
        return high_length, 0

    redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, "default", 1)
    return high_length, default_length


def remove_pending_run(redis: Redis, db: Any, run: dict[str, Any]) -> None:
    """Remove a pending run from counters and advance runs queued behind it."""
    priority = run.get("priority", "default")
    position = run.get("queue_position") or (0, 0)

    if priority == "high":
        db.runs.update_many(
            {
                "status": RunStatus.PENDING,
                "queue_position.0": {"$gt": position[0]},
            },
            {"$inc": {"queue_position.0": -1}},
        )
    else:
        db.runs.update_many(
            {
                "status": RunStatus.PENDING,
                "priority": "default",
                "queue_position.1": {"$gt": position[1]},
            },
            {"$inc": {"queue_position.1": -1}},
        )

    _decrement_queue_length(redis, priority)


def start_pending_run(task_id: str) -> bool:
    """Mark a pending run started and update queue accounting under the shared lock."""
    with mongo_database() as db:
        with queue_accounting_lock() as redis:
            run = db.runs.find_one({"task_id": task_id, "status": RunStatus.PENDING})
            if run is None:
                return False

            result = db.runs.update_one(
                {"_id": run["_id"], "status": RunStatus.PENDING},
                {"$set": {"status": RunStatus.STARTED}},
            )
            if result.modified_count == 0:
                return False

            remove_pending_run(redis, db, run)
            return True
