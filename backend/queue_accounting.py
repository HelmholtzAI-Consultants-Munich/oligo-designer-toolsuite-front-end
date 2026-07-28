from collections.abc import Generator
from contextlib import contextmanager
from typing import Any, cast

from redis import Redis
from redis.exceptions import LockError

from backend.config import CeleryConfig, Config
from backend.types import RunStatus


def _decrement_queue_length(redis: Redis, priority: str) -> int:
    new_length = cast(int, redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, priority, -1))
    if new_length < 0:
        redis.hset(Config.REDIS_QUEUE_LENGTH_KEY, priority, 0)  # type: ignore
        return 0
    return new_length


@contextmanager
def queue_accounting_lock() -> Generator[Redis, None, None]:
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
    """Account for a newly enqueued run and return its queue position.

    Must be called while holding queue_accounting_lock.
    """
    default_length, high_length = (
        int(cast(str | None, value) or 0)
        for value in cast(list, redis.hmget(Config.REDIS_QUEUE_LENGTH_KEY, ["default", "high"]))
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


def _remove_pending_run(redis: Redis, db: Any, run: dict[str, Any]) -> None:
    """Decrement queue counters and shift positions for runs queued behind the removed run.

    Must be called while holding queue_accounting_lock.
    """
    priority = run.get("priority", "default")
    position = run.get("queue_position") or (0, 0)

    if priority == "high":
        # Shift all pending runs with a higher high-priority position one step forward.
        db.runs.update_many(
            {
                "status": RunStatus.PENDING,
                "queue_position.0": {"$gt": position[0]},
            },
            {"$inc": {"queue_position.0": -1}},
        )
    else:
        # Shift all pending default-priority runs with a higher default-priority position one step forward.
        db.runs.update_many(
            {
                "status": RunStatus.PENDING,
                "priority": "default",
                "queue_position.1": {"$gt": position[1]},
            },
            {"$inc": {"queue_position.1": -1}},
        )

    _decrement_queue_length(redis, priority)
