"""
Tracks anonymous sessions' last-activity time, separately from the runs/
uploads they own, so stale anonymous data can eventually be identified and
cleaned up without depending on the browser session cookie still existing.
"""

from backend.extensions import db
from backend.utils import utc_now

ANONYMOUS_SESSIONS_COLLECTION = "anonymous_sessions"


def touch_anonymous_session(session_id: str | None) -> None:
    """Creates the session record if it doesn't exist yet, or just updates its timestamp if it does.

    Arguments:
        session_id {str | None} -- no-op if None, since there's nothing to
        track for an authenticated caller.

    Notes:
        This is called on every request from an anonymous visitor, so last_activity_at reflects
        real recent use rather than only when the session was first created — needed to tell
        stale sessions apart from active ones later.
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
        session_id {str | None} -- no-op if None.

    Notes:
        This is called when an anonymous session's data is migrated to a newly logged-in user,
        since the session_id no longer needs activity tracking once its runs/uploads have been
        reassigned.
    """
    if not session_id:
        return

    db[ANONYMOUS_SESSIONS_COLLECTION].delete_one({"session_id": session_id})
