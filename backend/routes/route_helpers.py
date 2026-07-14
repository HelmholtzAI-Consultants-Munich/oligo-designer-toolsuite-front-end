"""
Shared helpers for resolving the current user/session, fetching users and
runs with authorization enforced, and verifying Turnstile tokens.
"""

from http import HTTPStatus
from pathlib import Path
from typing import Any, cast

import requests
from bson import ObjectId
from flask import abort, current_app, session
from flask_login import current_user

from backend.extensions import db
from backend.utilities.legal_acceptance import require_current_terms_acceptance

# ============================================================================
# User Context Helpers
# ============================================================================


def get_user_context() -> tuple[None, str] | tuple[str, None]:
    """Resolves the identity of the current caller as either a user id or session id.

    Notes:
        This is the single source of truth for who is making this request,
        so every route handles anonymous and authenticated users the same
        way.

    Raises:
        HTTPException: 401 if an anonymous user's session has expired/lost its
        session_id, since there's no user to fall back to.

    Returns:
        tuple[None, str] | tuple[str, None] -- (user_id, None) if authenticated,
        (None, session_id) if anonymous. Callers branch on which one is set.
    """
    if current_user.is_authenticated:
        return str(current_user.id), None
    session_id = session.get("session_id")
    if not session_id:
        abort(
            HTTPStatus.UNAUTHORIZED,
            description="Your session has expired. Please refresh the page and try again.",
        )
    return None, session_id


def get_user_context_with_directory() -> tuple[str | None, str | None, Path]:
    """Resolves the on-disk user directory alongside the user context.

    Notes:
        Anonymous and authenticated users store their data under different
        path layouts (`anon/<session_id>` vs `<user_id>`), and most callers
        need both together.

    Raises:
        HTTPException: 401 if an anonymous user's session has expired/lost its
        session_id.

    Returns:
        tuple[str | None, str | None, Path] -- (user_id, session_id, user_dir).
    """
    user_id, session_id = get_user_context()
    userdata_path = Path(current_app.config["USERDATA_PATH"])

    if user_id:
        user_dir = userdata_path / user_id
    else:
        session_id = cast(str, session_id)
        user_dir = userdata_path / "anon" / session_id

    return user_id, session_id, user_dir


def require_terms_acceptance_for_current_context() -> tuple[str | None, str | None]:
    """Resolves the current user context and enforces terms acceptance for it.

    Notes:
        This gates pipeline submission behind terms acceptance without
        callers having to separately fetch the user context and then check
        acceptance themselves.

    Returns:
        tuple[str | None, str | None] -- (user_id, session_id) for the caller
        to reuse, since resolving it again would just repeat this same lookup.
    """
    user_id, session_id = get_user_context()
    require_current_terms_acceptance(user_id=user_id, session_id=session_id)
    return user_id, session_id


# ============================================================================
# User Retrieval Helpers
# ============================================================================


def find_user_by_id(user_id: ObjectId, exclude_password: bool = True) -> dict | None:
    """Looks up a user document by id, returning None if not found.

    Arguments:
        user_id {ObjectId} -- the user to look up.

    Keyword Arguments:
        exclude_password {bool} -- set False only when the caller needs to
        verify a password hash (e.g. legacy login). (default: {True})

    Notes:
        Use this when a missing user is a valid outcome (e.g. admin
        existence checks). For API endpoints where a missing user should
        404, use get_user_by_id_or_404() instead.

    Returns:
        dict | None -- the user document, or None if not found.
    """
    projection = {"password": False} if exclude_password else {}
    return db.users.find_one({"_id": user_id}, projection)


def get_user_by_id_or_404(user_id: ObjectId, exclude_password: bool = True) -> dict:
    """Looks up a user document by id, aborting with 404 if not found.

    Arguments:
        user_id {ObjectId} -- the user to look up.

    Keyword Arguments:
        exclude_password {bool} -- set False only when the caller needs the
        password hash. (default: {True})

    Notes:
        Use this in API endpoints where a missing user should end the
        request with a 404 instead of the caller having to check for None
        itself. For checks where a missing user is expected/valid, use
        find_user_by_id() instead.

    Raises:
        HTTPException: 404 if no user with this id exists.

    Returns:
        dict -- the user document.
    """
    user = find_user_by_id(user_id, exclude_password=exclude_password)
    if not user:
        abort(HTTPStatus.NOT_FOUND)
    return user


# ============================================================================
# Run Helpers
# ============================================================================


def build_run_query(run_id: ObjectId, require_ownership: bool = True) -> dict:
    """Builds the MongoDB query dict used to fetch a run.

    Arguments:
        run_id {ObjectId} -- the run to query for.

    Keyword Arguments:
        require_ownership {bool} -- False skips the ownership filter entirely
        — only use this for admin operations that may act on any run.
        (default: {True})

    Notes:
        This is split out from get_run_or_404 so admin operations can reuse
        the same ownership logic while opting out of it
        (require_ownership=False), rather than duplicating the
        user/session branching.

    Raises:
        HTTPException: 403 if an anonymous caller has no session_id to scope
        the query to.

    Returns:
        dict -- MongoDB query dict, scoped to the current user/session unless
        require_ownership is False.
    """
    query: dict[str, Any] = {"_id": run_id}
    if require_ownership:
        if current_user.is_authenticated:
            query["user_id"] = str(current_user.id)
        else:
            session_id = session.get("session_id")
            if not session_id:
                abort(HTTPStatus.FORBIDDEN)
            query["session_id"] = session_id
    return query


def get_run_or_404(run_id: ObjectId, require_ownership: bool = True) -> dict:
    """Fetches a run document by id, aborting with 404 if it doesn't exist.

    Arguments:
        run_id {ObjectId} -- the run to fetch.

    Keyword Arguments:
        require_ownership {bool} -- False skips the ownership check.
        (default: {True})

    Notes:
        This is the standard way routes fetch a run, so ownership
        enforcement can't be forgotten in a handler — pass
        require_ownership=False only for admin endpoints that are allowed
        to touch any user's run.

    Raises:
        HTTPException: 403 if unauthorized, 404 if the run doesn't exist.

    Returns:
        dict -- the run document.
    """
    query = build_run_query(run_id, require_ownership=require_ownership)
    run = db.runs.find_one(query)
    if not run:
        abort(HTTPStatus.NOT_FOUND)
    return run


def update_run_in_DB(run_id: ObjectId, data: dict[str, Any]) -> None:
    """Updates fields on an existing run document.

    Arguments:
        run_id {ObjectId} -- the run to update.
        data {dict[str, Any]} -- fields to $set on the run document.

    Notes:
        The run must already exist. This is similar to
        `backend.worker.database._update_run`, but this variant aborts the
        request on failure instead of the worker's own error handling,
        since routes need the request to fail loudly while a background
        task doesn't.
    """
    update_result = db.runs.update_one({"_id": run_id}, {"$set": data})
    if not update_result.acknowledged:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, "Failed to update the run in the database.")


# ============================================================================
# Turnstile Helpers
# ============================================================================


def validate_turnstile(token):
    """Verifies a Cloudflare Turnstile challenge token server-side.

    Arguments:
        token {str} -- the Turnstile response token submitted by the client.

    Notes:
        This ensures a client can't just skip the challenge. It fails open
        to "not verified" on network errors rather than raising, since a
        Cloudflare outage shouldn't crash the request.

    Returns:
        bool -- True only if Cloudflare confirms the token is valid.
    """
    url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    secret = current_app.config.get("TURNSTILE_SECRET_KEY")

    data = {"secret": secret, "response": token}

    try:
        response = requests.post(url, data=data, timeout=10)
        response.raise_for_status()

        result = response.json()

        if not result.get("success"):
            current_app.logger.warning(f"Turnstile verification failed: {result.get('error-codes')}")
            return False

        return True

    except requests.RequestException as e:
        current_app.logger.warning(f"Turnstile request failed: {e}")
        return False
