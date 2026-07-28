"""Queue accounting tests."""

from unittest.mock import MagicMock, patch

import pytest
from redis import Redis
from redis.exceptions import LockError

from backend.config import CeleryConfig, Config
from backend.extensions import db
from backend.queue_accounting import (
    _decrement_queue_length,
    _remove_pending_run,
    add_pending_run,
    queue_accounting_lock,
)
from backend.types import RunStatus

pytestmark = pytest.mark.usefixtures("isolated_redis")


def test_queue_accounting_lock_yields_working_client_and_releases_lock_on_success():
    """On success the lock is released, allowing it to be re-acquired immediately afterward.

    Notes:
        Successfully re-acquiring the same lock right after exit is the
        simplest proof that the context manager released it.
    """
    with queue_accounting_lock() as redis_client:
        assert redis_client.ping() is True

    other_lock = Redis.from_url(Config.REDIS_URI).lock(
        Config.REDIS_QUEUE_ACCOUNTING_LOCK_KEY,
        timeout=Config.REDIS_QUEUE_ACCOUNTING_LOCK_TIMEOUT,
    )
    assert other_lock.acquire(blocking=False)
    other_lock.release()


def test_queue_accounting_lock_raises_lock_error_when_acquire_fails():
    """A lock that cannot be acquired raises LockError instead of yielding.

    Notes:
        `.owned()` is patched to return False so the `finally` block's
        `if lock.owned(): lock.release()` does not also try to release a lock
        this process never held.
    """
    mock_lock = MagicMock()
    mock_lock.acquire.return_value = False
    mock_lock.owned.return_value = False

    with patch("backend.queue_accounting.Redis.lock", return_value=mock_lock):
        with pytest.raises(LockError):
            with queue_accounting_lock():
                pass

    mock_lock.release.assert_not_called()


def test_add_pending_run_default_priority_reports_length_without_touching_runs(app):
    """A default-priority run reports the current default-queue length and never writes to db.runs.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    redis_client = Redis.from_url(Config.REDIS_URI)
    redis_client.hset(Config.REDIS_QUEUE_LENGTH_KEY, mapping={"default": 2, "high": 1})
    with app.app_context():
        run_id = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "default", "queue_position": [0, 0]}
        ).inserted_id

        high_ahead, default_ahead = add_pending_run(redis_client, db, CeleryConfig.task_default_priority)

        assert high_ahead == 1
        assert default_ahead == 2
        assert db.runs.find_one({"_id": run_id})["queue_position"] == [0, 0]
        assert int(redis_client.hget(Config.REDIS_QUEUE_LENGTH_KEY, "default")) == 3


def test_add_pending_run_high_priority_shifts_pending_default_runs_and_increments_high_length(app):
    """A high-priority run bumps every pending default-priority run's high-ahead counter.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    redis_client = Redis.from_url(Config.REDIS_URI)
    redis_client.hset(Config.REDIS_QUEUE_LENGTH_KEY, mapping={"default": 2, "high": 1})
    with app.app_context():
        pending_default = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "default", "queue_position": [0, 0]}
        ).inserted_id
        started_default = db.runs.insert_one(
            {"status": RunStatus.STARTED, "priority": "default", "queue_position": [0, 0]}
        ).inserted_id

        high_ahead, default_ahead = add_pending_run(redis_client, db, CeleryConfig.task_high_priority)

        assert high_ahead == 1
        assert default_ahead == 0
        assert db.runs.find_one({"_id": pending_default})["queue_position"][0] == 1
        assert db.runs.find_one({"_id": started_default})["queue_position"][0] == 0
        assert int(redis_client.hget(Config.REDIS_QUEUE_LENGTH_KEY, "high")) == 2


def test_remove_pending_run_high_priority_shifts_positions_behind_it(app):
    """Removing a high-priority run shifts down queue_position.0 for every pending run behind it.

    Arguments:
        app {Any} -- Flask application instance providing the app context

    Notes:
        queue_position.0 is shared between high-priority runs' own position and
        default-priority runs' "high runs ahead" counter, so both kinds of
        pending run must shift, while runs ahead of the removed one must not.
    """
    redis_client = Redis.from_url(Config.REDIS_URI)
    redis_client.hset(Config.REDIS_QUEUE_LENGTH_KEY, "high", 1)
    with app.app_context():
        run_ahead = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "high", "queue_position": [1, 0]}
        ).inserted_id
        high_run_behind = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "high", "queue_position": [3, 0]}
        ).inserted_id
        default_run_behind = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "default", "queue_position": [3, 0]}
        ).inserted_id
        removed_run = {"priority": "high", "queue_position": (2, 0)}

        _remove_pending_run(redis_client, db, removed_run)

        assert db.runs.find_one({"_id": run_ahead})["queue_position"][0] == 1
        assert db.runs.find_one({"_id": high_run_behind})["queue_position"][0] == 2
        assert db.runs.find_one({"_id": default_run_behind})["queue_position"][0] == 2
        assert int(redis_client.hget(Config.REDIS_QUEUE_LENGTH_KEY, "high")) == 0


def test_remove_pending_run_default_priority_shifts_only_pending_default_runs(app):
    """Removing a default-priority run shifts queue_position.1 for pending default runs behind it only.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    redis_client = Redis.from_url(Config.REDIS_URI)
    redis_client.hset(Config.REDIS_QUEUE_LENGTH_KEY, "default", 1)
    with app.app_context():
        default_run_behind = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "default", "queue_position": [0, 2]}
        ).inserted_id
        high_run_same_position = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "high", "queue_position": [0, 2]}
        ).inserted_id
        removed_run = {"priority": "default", "queue_position": (0, 1)}

        _remove_pending_run(redis_client, db, removed_run)

        assert db.runs.find_one({"_id": default_run_behind})["queue_position"][1] == 1
        assert db.runs.find_one({"_id": high_run_same_position})["queue_position"][1] == 2
        assert int(redis_client.hget(Config.REDIS_QUEUE_LENGTH_KEY, "default")) == 0


def test_decrement_queue_length_clamps_at_zero_instead_of_going_negative():
    """Decrementing an already-zero (or negative) queue length is clamped to 0.

    Notes:
        Redis hash values could drift negative from a missed increment; the
        clamp keeps queue-length displays from showing nonsensical negatives.
    """
    redis_client = Redis.from_url(Config.REDIS_URI)
    redis_client.hset(Config.REDIS_QUEUE_LENGTH_KEY, "default", 0)

    result = _decrement_queue_length(redis_client, "default")

    assert result == 0
    assert int(redis_client.hget(Config.REDIS_QUEUE_LENGTH_KEY, "default")) == 0
