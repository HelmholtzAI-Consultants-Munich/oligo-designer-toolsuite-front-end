"""
Bans are keyed on helmholtz_sub rather than a local user_id, since a banned
person could otherwise just log in again and get a fresh account with full
access — the ban has to survive across (re-)created accounts.
"""

from bson import ObjectId

from backend.constants import USER_DENYLIST_COLLECTION_KEY
from backend.extensions import db
from backend.utils import utc_now


def find_ban_by_helmholtz_sub(helmholtz_sub: str | None):
    """Finds the ban record for a helmholtz_sub, if any.

    Arguments:
        helmholtz_sub {str | None} -- the identity to check for a ban.

    Notes:
        An empty/missing sub returns None upfront rather than being queried,
        since matching on an empty value could otherwise return an unrelated
        record with the same missing field.

    Returns:
        dict | None -- the ban record, or None if this identity isn't banned.
    """
    if not helmholtz_sub:
        return None
    return db[USER_DENYLIST_COLLECTION_KEY].find_one({"helmholtz_sub": helmholtz_sub})


def is_helmholtz_sub_banned(helmholtz_sub: str | None) -> bool:
    """Checks whether a helmholtz_sub is currently banned.

    Arguments:
        helmholtz_sub {str | None} -- the identity to check.

    Notes:
        This is checked on every session reload (not just at login), so a
        ban takes effect immediately instead of waiting for the user's next
        login.

    Returns:
        bool -- True if this identity is currently banned.
    """
    return find_ban_by_helmholtz_sub(helmholtz_sub) is not None


def ban_helmholtz_sub(helmholtz_sub: str, banned_by: str):
    """Bans a helmholtz_sub identity.

    Arguments:
        helmholtz_sub {str} -- the identity to ban.
        banned_by {str} -- which admin issued the ban.

    Notes:
        Banning an already-banned identity is a no-op — the original ban's
        timestamp/admin aren't overwritten.

    Returns:
        dict -- the ban record (existing or newly created).
    """
    db[USER_DENYLIST_COLLECTION_KEY].update_one(
        {"helmholtz_sub": helmholtz_sub},
        {
            "$setOnInsert": {
                "helmholtz_sub": helmholtz_sub,
                "banned_at": utc_now(),
                "banned_by": banned_by,
            }
        },
        upsert=True,
    )
    ban = find_ban_by_helmholtz_sub(helmholtz_sub)
    assert ban is not None
    return ban


def format_ban(ban: dict) -> dict:
    """Format a ban record for API responses (admin panel).

    Arguments:
        ban {dict} -- the raw ban document from MongoDB.

    Returns:
        dict -- ban formatted for API responses.
    """
    banned_at = ban.get("banned_at")
    return {
        "id": str(ban["_id"]),
        "helmholtz_sub": ban["helmholtz_sub"],
        "banned_at": banned_at.isoformat() if banned_at else None,
        "banned_by": ban.get("banned_by"),
    }


def remove_ban(ban_id: ObjectId) -> bool:
    """Removes a ban record.

    Arguments:
        ban_id {ObjectId} -- the ban record to remove.

    Notes:
        Returns whether anything was actually deleted, so the caller can
        distinguish "ban not found" (404) from a successful removal without
        a separate existence check.

    Returns:
        bool -- True if a ban was deleted, False if ban_id didn't match anything.
    """
    return db[USER_DENYLIST_COLLECTION_KEY].delete_one({"_id": ban_id}).deleted_count > 0
