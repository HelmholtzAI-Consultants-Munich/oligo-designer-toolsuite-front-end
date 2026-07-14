"""This file contains functions for checking and recording whether a user or
anonymous session has accepted the current terms version, and for gating
pipeline submission on that acceptance.
"""

from http import HTTPStatus

from flask import abort

from backend.extensions import db
from backend.utilities.legal import TERMS_DOCUMENT_KEY, get_published_legal_document, insert_with_check
from backend.utils import utc_now


def _terms_acceptance_query(user_id: str | None = None, session_id: str | None = None) -> dict[str, str]:
    """Builds a query/filter scoped to a user or session identity.

    Keyword Arguments:
        user_id {str | None} -- set for authenticated callers. (default: {None})
        session_id {str | None} -- set for anonymous callers. (default: {None})

    Notes:
        This is shared by every acceptance lookup/write so authenticated and
        anonymous identities are always scoped the same way, and callers
        can't accidentally query or insert an acceptance record tied to
        neither.

    Raises:
        ValueError: if neither id is given, since an acceptance record must
        always be attributable to someone.

    Returns:
        dict[str, str] -- query/filter scoped to whichever id was provided.
    """
    if user_id:
        return {"user_id": user_id}
    if session_id:
        return {"session_id": session_id}
    raise ValueError("A user_id or session_id is required")


def get_current_terms_version() -> str:
    """Gets the version identifier of the currently published terms.

    Notes:
        Reading from the published document rather than a cached constant
        means a newly published terms update takes effect immediately.

    Returns:
        str -- the version identifier of the currently published terms.
    """
    return get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]


def get_latest_terms_acceptance(user_id: str | None = None, session_id: str | None = None) -> dict | None:
    """Gets the most recent terms acceptance record for a user or session.

    Keyword Arguments:
        user_id {str | None} -- set for authenticated callers. (default: {None})
        session_id {str | None} -- set for anonymous callers. (default: {None})

    Notes:
        Results are sorted by timestamp descending, since a user may have
        accepted multiple terms versions over time and only the most recent
        one determines whether they're currently compliant.

    Returns:
        dict | None -- the most recent acceptance record, or None if this
        identity has never accepted any terms version.
    """
    return db.legal_acceptances.find_one(
        _terms_acceptance_query(user_id=user_id, session_id=session_id),
        sort=[("timestamp", -1)],
    )


def has_current_terms_acceptance(user_id: str | None = None, session_id: str | None = None) -> bool:
    """Checks whether a user or session has accepted the current terms version.

    Keyword Arguments:
        user_id {str | None} -- set for authenticated callers. (default: {None})
        session_id {str | None} -- set for anonymous callers. (default: {None})

    Notes:
        This compares against the *current* published version, not just
        whether they have ever accepted something, since accepting an older
        version doesn't satisfy a later terms update.

    Returns:
        bool -- True only if the latest acceptance matches the current terms version.
    """
    acceptance = get_latest_terms_acceptance(user_id=user_id, session_id=session_id)
    return bool(acceptance and acceptance.get("terms_version") == get_current_terms_version())


def record_terms_acceptance(user_id: str | None = None, session_id: str | None = None) -> dict:
    """Records a user or session's acceptance of the current terms version.

    Keyword Arguments:
        user_id {str | None} -- set for authenticated callers. (default: {None})
        session_id {str | None} -- set for anonymous callers. (default: {None})

    Notes:
        The existing record is returned instead of inserting a duplicate if
        the caller already accepted the current version, since re-accepting
        shouldn't create redundant acceptance rows every time this is
        called.

    Returns:
        dict -- the existing or newly created acceptance record.
    """
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
    """Gate for pipeline submission that aborts if terms acceptance is missing.

    Keyword Arguments:
        user_id {str | None} -- set for authenticated callers. (default: {None})
        session_id {str | None} -- set for anonymous callers. (default: {None})

    Notes:
        Aborting instead of returning a bool means every call site enforces
        acceptance the same way rather than each caller having to remember
        to check and abort itself.
    """
    if has_current_terms_acceptance(user_id=user_id, session_id=session_id):
        return

    abort(
        HTTPStatus.FORBIDDEN,
        description="You must accept the current Terms of Service and Privacy Policy before continuing.",
    )
