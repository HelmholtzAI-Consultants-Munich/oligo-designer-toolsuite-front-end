"""Worker database helper tests."""

from unittest.mock import MagicMock, patch

import pytest
from bson import ObjectId

from backend.database import mongo_database
from backend.extensions import db
from backend.types import RunStatus
from backend.worker.database import (
    _parse_run_id,
    _update_run,
    _update_run_by_task_id,
    start_pending_run,
)

pytestmark = pytest.mark.usefixtures("isolated_redis")


def test_parse_run_id_returns_object_id_for_valid_string():
    """A well-formed ObjectId string parses into an ObjectId."""
    run_id = ObjectId()

    assert _parse_run_id(str(run_id)) == run_id


def test_parse_run_id_returns_none_for_malformed_string():
    """A malformed string returns None instead of raising."""
    assert _parse_run_id("not-an-object-id") is None


def test_update_run_sets_fields_on_existing_run(app):
    """Updating an existing run persists the new fields.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    with app.app_context():
        run_id = db.runs.insert_one({"status": RunStatus.PENDING}).inserted_id

        _update_run(run_id, {"status": RunStatus.SUCCESS})

        assert db.runs.find_one({"_id": run_id})["status"] == RunStatus.SUCCESS


def test_update_run_by_task_id_updates_the_matching_run(app):
    """Updating by a valid task id updates the run with that same id.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    with app.app_context():
        run_id = db.runs.insert_one({"status": RunStatus.PENDING}).inserted_id

        _update_run_by_task_id(str(run_id), {"status": RunStatus.FAILURE})

        assert db.runs.find_one({"_id": run_id})["status"] == RunStatus.FAILURE


def test_update_run_by_task_id_is_a_no_op_for_invalid_task_id(app):
    """An invalid task id neither writes anything nor raises.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    with app.app_context():
        run_id = db.runs.insert_one({"status": RunStatus.PENDING}).inserted_id

        _update_run_by_task_id("not-an-object-id", {"status": RunStatus.FAILURE})

        assert db.runs.find_one({"_id": run_id})["status"] == RunStatus.PENDING


def test_start_pending_run_flips_status_to_started(app):
    """Starting a pending run flips its status to started in the database.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    with app.app_context():
        run_id = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "default", "queue_position": [0, 0]}
        ).inserted_id

        assert start_pending_run(str(run_id)) is True
        assert db.runs.find_one({"_id": run_id})["status"] == RunStatus.STARTED


def test_start_pending_run_returns_false_for_invalid_task_id():
    """An invalid task id is rejected before any database lookup."""
    assert start_pending_run("not-an-object-id") is False


def test_start_pending_run_returns_false_when_run_not_pending(app):
    """A run that exists but is not pending is left untouched.

    Arguments:
        app {Any} -- Flask application instance providing the app context

    Notes:
        This covers both "not found" and "found but wrong status" since the
        lookup filters on status == PENDING.
    """
    with app.app_context():
        run_id = db.runs.insert_one(
            {"status": RunStatus.STARTED, "priority": "default", "queue_position": [0, 0]}
        ).inserted_id

        assert start_pending_run(str(run_id)) is False
        assert db.runs.find_one({"_id": run_id})["status"] == RunStatus.STARTED


def test_start_pending_run_returns_false_when_update_does_not_modify(app):
    """A modified_count of 0 on the status update is treated as failure, leaving queue accounting untouched.

    Arguments:
        app {Any} -- Flask application instance providing the app context

    Notes:
        This simulates a race where another process already changed the run
        between the pending lookup and the update.
    """
    with app.app_context():
        run_id = db.runs.insert_one(
            {"status": RunStatus.PENDING, "priority": "default", "queue_position": [0, 0]}
        ).inserted_id

        with patch("backend.worker.database._update_run", return_value=MagicMock(modified_count=0)):
            assert start_pending_run(str(run_id)) is False


def test_mongo_database_yields_usable_database():
    """The context manager yields a Database that can serve real queries."""
    with mongo_database() as database:
        assert database.name == "oligo_db"
        database.list_collection_names()


def test_mongo_database_closes_client_on_normal_exit():
    """The underlying client is closed after the with-block exits normally."""
    with patch("backend.database.MongoClient.close", autospec=True) as mock_close:
        with mongo_database():
            pass

    mock_close.assert_called_once()


def test_mongo_database_closes_client_when_body_raises():
    """The underlying client is closed even when the with-block raises."""
    with patch("backend.database.MongoClient.close", autospec=True) as mock_close:
        with pytest.raises(RuntimeError):
            with mongo_database():
                raise RuntimeError("boom")

    mock_close.assert_called_once()
