"""Pipeline chord errback tests."""

from unittest.mock import MagicMock, patch

import pytest
from billiard.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
from bson import ObjectId
from celery.exceptions import ChordError, TaskRevokedError
from redis import Redis

from backend.config import Config
from backend.exceptions import ODTCloudError, ODTEmptyResultError
from backend.extensions import db
from backend.types import RunStatus
from backend.worker.callbacks import pipeline_chord_errback

pytestmark = pytest.mark.usefixtures("isolated_redis")


def _mock_request(run_id: ObjectId) -> MagicMock:
    """Build a minimal stand-in for celery.worker.request.Request carrying only the id the errback reads."""
    return MagicMock(id=str(run_id))


def test_pipeline_chord_errback_returns_early_for_invalid_run_id():
    """A request whose id is not a valid ObjectId is rejected before any database access."""
    with (
        patch("backend.worker.callbacks._update_run") as update_run,
        patch("backend.worker.callbacks.mongo_database") as mongo_database,
    ):
        pipeline_chord_errback(_mock_request("not-an-object-id"), RuntimeError("boom"), None)

    update_run.assert_not_called()
    mongo_database.assert_not_called()


def test_pipeline_chord_errback_skips_update_for_revoked_task():
    """A TaskRevokedError returns early without touching the database.

    Notes:
        The run was already deleted when it was revoked, so there is nothing
        left to update.
    """
    with (
        patch("backend.worker.callbacks._update_run") as update_run,
        patch("backend.worker.callbacks.mongo_database") as mongo_database,
    ):
        pipeline_chord_errback(_mock_request(ObjectId()), TaskRevokedError(), None)

    update_run.assert_not_called()
    mongo_database.assert_not_called()


def test_pipeline_chord_errback_unwraps_chord_error_cause(app):
    """A ChordError's __cause__ is unwrapped before status-mapping runs.

    Arguments:
        app {Any} -- Flask application instance providing the app context

    Notes:
        Celery wraps chord-header failures in ChordError; the original
        exception must decide the resulting run status, not ChordError itself.
    """
    with app.app_context():
        run_id = db.runs.insert_one({"status": RunStatus.STARTED}).inserted_id
        chord_error = ChordError("chord failed")
        chord_error.__cause__ = ODTEmptyResultError("no oligos found")

        pipeline_chord_errback(_mock_request(run_id), chord_error, None)

        run = db.runs.find_one({"_id": run_id})
        assert run["status"] == RunStatus.EMPTY_RESULT
        assert run["error_message"] == "no oligos found"


def test_pipeline_chord_errback_uses_generic_message_for_bare_chord_error(app):
    """A ChordError with no cause maps to failure with a chord-specific message.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    with app.app_context():
        run_id = db.runs.insert_one({"status": RunStatus.STARTED}).inserted_id

        pipeline_chord_errback(_mock_request(run_id), ChordError("chord failed"), None)

        run = db.runs.find_one({"_id": run_id})
        assert run["status"] == RunStatus.FAILURE
        assert run["error_message"] == "An error occured during genomic region generation."


@pytest.mark.parametrize(
    ("exc", "expected_status", "expected_message"),
    [
        (ODTEmptyResultError("no oligos found"), RunStatus.EMPTY_RESULT, "no oligos found"),
        (ODTCloudError("cloud boom"), RunStatus.FAILURE, "cloud boom"),
        (TimeLimitExceeded(), RunStatus.TIMEOUT, "The pipeline exceeded the time limit."),
        (SoftTimeLimitExceeded(), RunStatus.TIMEOUT, "The pipeline exceeded the time limit."),
        (RuntimeError("boom"), RunStatus.FAILURE, "An unexpected error occured."),
    ],
)
def test_pipeline_chord_errback_maps_exception_types_to_status(app, exc, expected_status, expected_message):
    """Each exception type is mapped to its corresponding run status and message.

    Arguments:
        app {Any} -- Flask application instance providing the app context
        exc {BaseException} -- the exception passed to the errback
        expected_status {RunStatus} -- the run status the errback must write
        expected_message {str} -- the error message the errback must write
    """
    with app.app_context():
        run_id = db.runs.insert_one({"status": RunStatus.STARTED}).inserted_id

        pipeline_chord_errback(_mock_request(run_id), exc, None)

        run = db.runs.find_one({"_id": run_id})
        assert run["status"] == expected_status
        assert run["error_message"] == expected_message


def test_pipeline_chord_errback_clears_queue_accounting_when_run_still_pending(app):
    """A run still pending when the errback fires also has its queue accounting cleared.

    Arguments:
        app {Any} -- Flask application instance providing the app context

    Notes:
        This covers the case where a genomic region generation header task
        failed before PipelineTask.before_start ever ran, so accounting was
        never cleared elsewhere.
    """
    redis_client = Redis.from_url(Config.REDIS_URI)
    redis_client.hset(Config.REDIS_QUEUE_LENGTH_KEY, "default", 1)
    with app.app_context():
        run_id = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "default", "queue_position": [0, 0]}
        ).inserted_id

        pipeline_chord_errback(_mock_request(run_id), RuntimeError("boom"), None)

        assert db.runs.find_one({"_id": run_id})["status"] == RunStatus.FAILURE
        assert int(redis_client.hget(Config.REDIS_QUEUE_LENGTH_KEY, "default")) == 0


def test_pipeline_chord_errback_skips_queue_accounting_when_run_already_started(app):
    """A run that already left pending state is not passed through queue accounting again.

    Arguments:
        app {Any} -- Flask application instance providing the app context

    Notes:
        PipelineTask.before_start already cleared accounting for started runs,
        so re-running it here would double-decrement the queue length.
    """
    redis_client = Redis.from_url(Config.REDIS_URI)
    redis_client.hset(Config.REDIS_QUEUE_LENGTH_KEY, "default", 1)
    with app.app_context():
        run_id = db.runs.insert_one({"status": RunStatus.STARTED}).inserted_id

        pipeline_chord_errback(_mock_request(run_id), RuntimeError("boom"), None)

        assert db.runs.find_one({"_id": run_id})["status"] == RunStatus.FAILURE
        assert int(redis_client.hget(Config.REDIS_QUEUE_LENGTH_KEY, "default")) == 1
