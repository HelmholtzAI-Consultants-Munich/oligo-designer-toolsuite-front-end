"""Tracks last-activity timestamps for anonymous sessions, used to identify stale sessions for cleanup."""

from backend.extensions import db
from backend.utils import utc_now

ANONYMOUS_SESSIONS_COLLECTION = "anonymous_sessions"


def touch_anonymous_session(session_id: str | None) -> None:
    """Creates the session record if it doesn't exist yet, or just updates its timestamp if it does.

    Arguments:
        session_id {str | None} -- the anonymous session to touch.

    Notes:
        Called on every request from an anonymous visitor, so last_activity_at
        reflects real recent use, not just session creation.
    """
    if not session_id:
        return

    db[ANONYMOUS_SESSIONS_COLLECTION].update_one(
        {"session_id": session_id},
        {"$set": {"last_activity_at": utc_now()}},
        upsert=True,
    )


def delete_anonymous_session(session_id: str | None) -> None:
    """Deletes the anonymous session record.

    Arguments:
        session_id {str | None} -- the anonymous session to delete.

    Notes:
        Called after an anonymous session's data is migrated to a logged-in
        user, once activity tracking is no longer needed.
    """
    if not session_id:
        return

    db[ANONYMOUS_SESSIONS_COLLECTION].delete_one({"session_id": session_id})
