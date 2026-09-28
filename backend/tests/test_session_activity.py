"""Anonymous session activity helper tests."""

from backend.extensions import db
from backend.utilities.session_activity import (
    ANONYMOUS_SESSIONS_COLLECTION,
    delete_anonymous_session,
    touch_anonymous_session,
)


def test_touch_anonymous_session_is_a_no_op_for_falsy_session_id(app):
    """A missing session_id is skipped without writing to the database.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    with app.app_context():
        touch_anonymous_session(None)

        assert db[ANONYMOUS_SESSIONS_COLLECTION].count_documents({}) == 0


def test_delete_anonymous_session_removes_matching_document(app):
    """Deleting an anonymous session removes its document from the database.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    with app.app_context():
        db[ANONYMOUS_SESSIONS_COLLECTION].insert_one({"session_id": "anon-1"})

        delete_anonymous_session("anon-1")

        assert db[ANONYMOUS_SESSIONS_COLLECTION].count_documents({"session_id": "anon-1"}) == 0


def test_delete_anonymous_session_is_a_no_op_for_falsy_session_id(app):
    """A missing session_id is skipped without deleting anything.

    Arguments:
        app {Any} -- Flask application instance providing the app context
    """
    with app.app_context():
        db[ANONYMOUS_SESSIONS_COLLECTION].insert_one({"session_id": "anon-1"})

        delete_anonymous_session(None)

        assert db[ANONYMOUS_SESSIONS_COLLECTION].count_documents({}) == 1
