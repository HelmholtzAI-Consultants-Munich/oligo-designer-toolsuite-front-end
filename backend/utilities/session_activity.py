from backend.extensions import db
from backend.utils import utc_now

ANONYMOUS_SESSIONS_COLLECTION = "anonymous_sessions"


def touch_anonymous_session(session_id: str | None) -> None:
    if not session_id:
        return

    db[ANONYMOUS_SESSIONS_COLLECTION].update_one(
        {"session_id": session_id},
        {"$set": {"last_activity_at": utc_now()}},
        upsert=True,
    )


def delete_anonymous_session(session_id: str | None) -> None:
    if not session_id:
        return

    db[ANONYMOUS_SESSIONS_COLLECTION].delete_one({"session_id": session_id})
