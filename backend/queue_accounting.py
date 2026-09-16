"""
Tracks pipeline-run queue length and position, keeping Redis counters and MongoDB queue_position fields in sync.
"""

from collections.abc import Generator
from contextlib import contextmanager
from typing import Any, cast

from redis import Redis
from redis.exceptions import LockError

from backend.config import CeleryConfig, Config
from backend.types import RunStatus


def _decrement_queue_length(redis: Redis, priority: str) -> int:
    """Decrements a queue-length counter, clamping at 0.

    Arguments:
        redis {Redis} -- client to update.
        priority {str} -- "high" or "default".

    Notes:
        Clamped rather than allowed to go negative, so drift between the
        counter and actual pending runs can't compound into an increasingly
        wrong queue-position estimate.

    Returns:
        int -- the counter's new value.
    """
    new_length = cast(int, redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, priority, -1))
    if new_length < 0:
        redis.hset(Config.REDIS_QUEUE_LENGTH_KEY, priority, 0)  # type: ignore
        return 0
    return new_length


@contextmanager
def queue_accounting_lock() -> Generator[Redis, None, None]:
    """Holds the global queue-accounting lock and yields its Redis client.

    Notes:
        Queue-length counters and per-run queue positions are updated together
        across Redis and MongoDB; without a shared lock, concurrent
        enqueues/dequeues could interleave and leave them inconsistent.

    Returns:
        Redis -- client to use for queue-accounting operations while the
        lock is held.
    """
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
    """Accounts for a newly enqueued run and returns its queue position.

    Arguments:
        redis {Redis} -- client for queue-length counters.
        db {Any} -- MongoDB database, used to shift other pending runs' positions.
        priority {int} -- the run's Celery task priority.

    Notes:
        Must be called while holding queue_accounting_lock, since it reads
        and updates the shared counters. A new high-priority run pushes every
        pending default-priority run's high-priority-ahead count up by one,
        since it will run before them.

    Returns:
        tuple[int, int] -- (high-priority runs ahead, default-priority runs
        ahead) for the new run.
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
    """Decrements queue counters and shifts positions for runs queued behind the removed run.

    Arguments:
        redis {Redis} -- client for queue-length counters.
        db {Any} -- MongoDB database, used to shift other pending runs' positions.
        run {dict[str, Any]} -- the pending run being removed, used for its
        priority and queue_position.

    Notes:
        Must be called while holding queue_accounting_lock, since it reads
        and updates the shared counters.
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
