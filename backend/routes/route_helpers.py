"""
Shared helpers for resolving the current user/session, fetching users and
runs with authorization enforced, and verifying Turnstile tokens.
"""

import re
import unicodedata
from http import HTTPStatus
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlencode

import aarc_entitlement
import nh3
import requests
from bson import ObjectId
from flask import abort, current_app, redirect, session
from flask_login import current_user

from backend.extensions import db, oauth
from backend.utilities.legal_acceptance import require_current_terms_acceptance
from backend.utilities.typed_values import parse_http_url, sanitize_relative_redirect_path

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


# ============================================================================
# Helmholtz AAI Helpers
# ============================================================================


def _string_values(value: object) -> list[str]:
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    if isinstance(value, list):
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]
    return []


def _parse_entitlement(value: str) -> aarc_entitlement.G002 | None:
    try:
        return aarc_entitlement.G002(value)
    except Exception:
        return None


def is_helmholtz_access_allowed(userinfo: dict[str, Any]) -> bool:
    """Checks whether Helmholtz userinfo satisfies the configured access policy.

    Arguments:
        userinfo {dict[str, Any]} -- the OIDC userinfo claims to check.

    Notes:
        Access is unrestricted unless HELMHOLTZ_RESTRICT_BY_ENTITLEMENT is
        set, so entitlement-gating (e.g. requiring VO membership) is opt-in
        per deployment rather than hardcoded.

    Returns:
        bool -- True if access is allowed.
    """
    if not bool(current_app.config.get("HELMHOLTZ_RESTRICT_BY_ENTITLEMENT", False)):
        return True

    required_entitlements = [
        parsed
        for value in _string_values(current_app.config.get("HELMHOLTZ_REQUIRED_ENTITLEMENT"))
        if (parsed := _parse_entitlement(value)) is not None
    ]
    if not required_entitlements:
        return False

    user_entitlements = [
        parsed
        for value in _string_values(userinfo.get("entitlements"))
        if (parsed := _parse_entitlement(value)) is not None
    ]

    return any(
        entitlement.satisfies(required_entitlement)
        for entitlement in user_entitlements
        for required_entitlement in required_entitlements
    )


def fetch_helmholtz_userinfo(token: dict[str, Any]) -> dict[str, Any]:
    """Fetches OIDC userinfo claims via the registered Helmholtz OAuth client.

    Arguments:
        token {dict[str, Any]} -- the OAuth token to authenticate the request with.

    Raises:
        ValueError: if the userinfo endpoint doesn't return a JSON object.

    Returns:
        dict[str, Any] -- the userinfo claims.
    """
    response = oauth.helmholtz.get(
        "userinfo", token=token, timeout=current_app.config["HELMHOLTZ_AAI_TIMEOUT_SECONDS"]
    )
    response.raise_for_status()
    userinfo = response.json()
    if not isinstance(userinfo, dict):
        raise ValueError("Helmholtz userinfo endpoint returned a non-object response")
    return userinfo


def load_helmholtz_userinfo(token: dict[str, Any]) -> dict[str, Any]:
    """Loads complete userinfo claims for authorization and account lookup.

    Arguments:
        token {dict[str, Any]} -- the OAuth token, including any userinfo
        Helmholtz already embedded in it.

    Notes:
        Merges the token's embedded userinfo with a live call to the
        userinfo endpoint, since entitlements are only returned by the
        endpoint, not the ID token.

    Returns:
        dict[str, Any] -- combined userinfo claims.
    """
    token_userinfo = token.get("userinfo")
    endpoint_userinfo: dict[str, Any] = {}
    access_token = token.get("access_token")

    if not access_token:
        current_app.logger.warning("OAuth token response did not include an access_token")
    else:
        try:
            # entitlements is only returned by the userinfo endpoint, not the ID token
            endpoint_userinfo = fetch_helmholtz_userinfo(token)
        except Exception as error:
            current_app.logger.warning("Failed to fetch Helmholtz userinfo endpoint: %s", error)

    return {
        **(token_userinfo if isinstance(token_userinfo, dict) else {}),
        **(endpoint_userinfo if isinstance(endpoint_userinfo, dict) else {}),
    }


def _frontend_base_url() -> str:
    """Resolves and validates the configured frontend URL.

    Notes:
        Validated here since it's used to build redirect URLs — a malformed
        FRONTEND_URL should fail loudly rather than produce a broken redirect.

    Returns:
        str -- the frontend base URL, without a trailing slash.
    """
    frontend_url = parse_http_url(current_app.config.get("FRONTEND_URL"))
    if frontend_url is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Frontend URL configuration is invalid")
    return frontend_url.geturl().rstrip("/")


def redirect_to_login_with_oauth_error(error: str):
    """Redirects to the frontend login page with an OAuth error code.

    Arguments:
        error {str} -- short error code the frontend displays to the user.

    Notes:
        The pending OAuth redirect target (if any) is preserved as a query
        param, so the user still lands where they intended after retrying.

    Returns:
        flask.Response -- redirect to the frontend login page.
    """
    query = {"oauth_error": error}
    redirect_path = sanitize_relative_redirect_path(session.pop("oauth_redirect", None))
    if redirect_path:
        query["redirect"] = redirect_path
    return redirect(f"{_frontend_base_url()}/login?{urlencode(query)}")


def revoke_helmholtz_token(access_token: str) -> None:
    """Revokes a Helmholtz access token and requests provider-side logout.

    Arguments:
        access_token {str} -- the token to revoke.

    Notes:
        Requests provider-side logout so Helmholtz AAI's own SSO session
        doesn't silently re-authenticate the same account on the next login
        attempt. Failures are logged, not raised, since the user should
        still be logged out locally either way.
    """
    try:
        response = oauth.helmholtz.post(
            "revoke",
            data={
                "token": access_token,
                "client_id": current_app.config.get("HELMHOLTZ_CLIENT_ID"),
                "token_type_hint": "access_token",
                # Needed so users can switch accounts; otherwise Helmholtz AAI's SSO
                # session silently re-authenticates the same account on next login.
                "logout": "true",
            },
            token={"access_token": access_token, "token_type": "Bearer"},
            timeout=current_app.config["HELMHOLTZ_AAI_TIMEOUT_SECONDS"],
        )
        if response.status_code != HTTPStatus.OK:
            current_app.logger.warning("Token revocation failed: %s", response.status_code)
    except Exception as error:
        current_app.logger.error("Error revoking token: %s", error)


def deny_oauth_login(access_token: str | None, error: str):
    """Revokes the OAuth token (if any) and redirects to login with an error.

    Arguments:
        access_token {str | None} -- token to revoke, if one was issued
        before the login was denied.
        error {str} -- short error code the frontend displays to the user.

    Returns:
        flask.Response -- redirect to the frontend login page.
    """
    if access_token:
        revoke_helmholtz_token(access_token)
    session.pop("oauth_token", None)
    return redirect_to_login_with_oauth_error(error)


def redirect_after_oauth_login():
    redirect_path = sanitize_relative_redirect_path(session.pop("oauth_redirect", None))
    if redirect_path:
        return redirect(f"{_frontend_base_url()}{redirect_path}")
    return redirect(f"{_frontend_base_url()}/")


def get_or_create_helmholtz_user(helmholtz_sub: str) -> dict:
    """Looks up a user by helmholtz_sub, creating one on first login.

    Arguments:
        helmholtz_sub {str} -- the Helmholtz AAI subject identifier.

    Notes:
        New users default to role "user" with no terms accepted yet, so a
        first-time Helmholtz AAI login provisions an account without a
        separate registration step.

    Returns:
        dict -- the existing or newly created user document.
    """
    user_doc = db.users.find_one({"helmholtz_sub": helmholtz_sub})
    if user_doc:
        return user_doc

    user_id = db.users.insert_one(
        {
            "helmholtz_sub": helmholtz_sub,
            "role": "user",
            "accepted_terms_version": None,
            "terms_accepted_at": None,
        }
    ).inserted_id
    user_doc = db.users.find_one({"_id": user_id})
    if not user_doc:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Failed to create Helmholtz user")
    return user_doc


# Sanitization Helpers
# ============================================================================


def sanitize_input(raw_message: str) -> str:
    """Sanitizes free-text user input before it's stored or displayed.

    Arguments:
        raw_message {str} -- the raw text to sanitize.

    Notes:
        Strips HTML and stray control characters and normalizes Unicode/line
        endings, so stored feedback/messages can't smuggle markup or
        invisible characters back out when rendered elsewhere.

    Returns:
        str -- sanitized text.
    """
    normalized = unicodedata.normalize("NFKC", raw_message)
    sanitized = nh3.clean(normalized)
    sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", sanitized)
    return sanitized.replace("\r\n", "\n").replace("\r", "\n").strip()
