from http import HTTPStatus

from flask import abort

from backend.extensions import db
from backend.utilities.legal import TERMS_DOCUMENT_KEY, get_published_legal_document, insert_with_check
from backend.utils import utc_now


def _terms_acceptance_query(user_id: str | None = None, session_id: str | None = None) -> dict[str, str]:
    if user_id:
        return {"user_id": user_id}
    if session_id:
        return {"session_id": session_id}
    raise ValueError("A user_id or session_id is required")


def get_current_terms_version() -> str:
    return get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]


def get_latest_terms_acceptance(user_id: str | None = None, session_id: str | None = None) -> dict | None:
    return db.legal_acceptances.find_one(
        _terms_acceptance_query(user_id=user_id, session_id=session_id),
        sort=[("timestamp", -1)],
    )


def has_current_terms_acceptance(user_id: str | None = None, session_id: str | None = None) -> bool:
    acceptance = get_latest_terms_acceptance(user_id=user_id, session_id=session_id)
    return bool(acceptance and acceptance.get("terms_version") == get_current_terms_version())


def record_terms_acceptance(user_id: str | None = None, session_id: str | None = None) -> dict:
    existing_acceptance = get_latest_terms_acceptance(user_id=user_id, session_id=session_id)
    current_version = get_current_terms_version()

    if existing_acceptance and existing_acceptance.get("terms_version") == current_version:
        return existing_acceptance

    return insert_with_check(
        {
            **_terms_acceptance_query(user_id=user_id, session_id=session_id),
            "document": TERMS_DOCUMENT_KEY,
            "terms_version": current_version,
            "timestamp": utc_now(),
        },
        db.legal_acceptances,
    )


def require_current_terms_acceptance(user_id: str | None = None, session_id: str | None = None) -> None:
    if has_current_terms_acceptance(user_id=user_id, session_id=session_id):
        return

    abort(
        HTTPStatus.FORBIDDEN,
        description="You must accept the current Terms of Service and Privacy Policy before continuing.",
    )
