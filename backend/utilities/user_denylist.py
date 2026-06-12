from bson import ObjectId

from backend.constants import USER_DENYLIST_COLLECTION
from backend.extensions import db
from backend.utilities.typed_values import utc_now


def find_ban_by_helmholtz_sub(helmholtz_sub: str | None):
    if not helmholtz_sub:
        return None
    return db[USER_DENYLIST_COLLECTION].find_one({"helmholtz_sub": helmholtz_sub})


def is_helmholtz_sub_banned(helmholtz_sub: str | None) -> bool:
    return find_ban_by_helmholtz_sub(helmholtz_sub) is not None


def ban_helmholtz_sub(helmholtz_sub: str, banned_by: str):
    db[USER_DENYLIST_COLLECTION].update_one(
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
    return find_ban_by_helmholtz_sub(helmholtz_sub)


def format_ban(ban: dict) -> dict:
    banned_at = ban.get("banned_at")
    return {
        "id": str(ban["_id"]),
        "helmholtz_sub": ban["helmholtz_sub"],
        "banned_at": banned_at.isoformat() if banned_at else None,
        "banned_by": ban.get("banned_by"),
    }


def remove_ban(ban_id: ObjectId) -> bool:
    return db[USER_DENYLIST_COLLECTION].delete_one({"_id": ban_id}).deleted_count > 0
