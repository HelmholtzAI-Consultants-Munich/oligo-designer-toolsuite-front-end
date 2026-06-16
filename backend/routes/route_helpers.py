from http import HTTPStatus
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests
from bson import ObjectId
from flask import abort, current_app, redirect, session
from flask_login import current_user

from backend.extensions import db
from backend.utilities.legal_acceptance import require_current_terms_acceptance
from backend.utilities.typed_values import parse_http_url, sanitize_relative_redirect_path

# ============================================================================
# User Context Helpers
# ============================================================================


def get_user_context() -> tuple[str | None, str | None]:
    """Get user context (user_id and session_id) based on authentication status.

    For authenticated users, user_id is set and session_id is None.
    For anonymous users, user_id is None and session_id is retrieved from session.

    :returns: Tuple of (user_id, session_id)
    :rtype: tuple[str | None, str | None]
    :raises: 401 if anonymous user has no session_id
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
    """Get user context and the user's data directory path.

    :returns: Tuple of (user_id, session_id, user_dir)
    :rtype: tuple[str | None, str | None, pathlib.Path]
    :raises: 401 if anonymous user has no session_id
    """
    user_id, session_id = get_user_context()
    userdata_path = Path(current_app.config["USERDATA_PATH"])

    if user_id:
        user_dir = userdata_path / user_id
    else:
        user_dir = userdata_path / "anon" / session_id

    return user_id, session_id, user_dir


def require_terms_acceptance_for_current_context() -> tuple[str | None, str | None]:
    user_id, session_id = get_user_context()
    require_current_terms_acceptance(user_id=user_id, session_id=session_id)
    return user_id, session_id


# ============================================================================
# User Retrieval Helpers
# ============================================================================


def find_user_by_id(user_id: ObjectId, exclude_password: bool = True) -> dict | None:
    """Find a user by ID from the database (returns None if not found).

    Use this when checking if a user exists (e.g., admin checks) where None
    is a valid state. For API endpoints where missing user should return 404,
    use get_user_by_id_or_404() instead.

    :param user_id: The MongoDB ObjectId of the user
    :type user_id: ObjectId
    :param exclude_password: Whether to exclude password field from result
    :type exclude_password: bool
    :returns: User document or None if not found
    :rtype: dict | None
    """
    projection = {"password": False} if exclude_password else {}
    return db.users.find_one({"_id": user_id}, projection)


def get_user_by_id_or_404(user_id: ObjectId, exclude_password: bool = True) -> dict:
    """Retrieve a user by ID, raising 404 if not found.

    Use this in API endpoints where a missing user should return 404.
    For checking if a user exists (e.g., admin checks), use find_user_by_id() instead.

    :param user_id: The MongoDB ObjectId of the user
    :type user_id: ObjectId
    :param exclude_password: Whether to exclude password field from result
    :type exclude_password: bool
    :returns: User document from MongoDB
    :rtype: dict
    :raises: 404 if user not found
    """
    user = find_user_by_id(user_id, exclude_password=exclude_password)
    if not user:
        abort(HTTPStatus.NOT_FOUND)
    return user


# ============================================================================
# Run Retrieval Helpers
# ============================================================================


def build_run_query(run_id: ObjectId, require_ownership: bool = True) -> dict:
    """Build MongoDB query for run retrieval with authorization.

    Constructs a query dictionary that includes the run_id and appropriate
    authorization filter (user_id for authenticated users, session_id for
    anonymous users). If require_ownership is False, only filters by run_id
    (useful for admin operations).

    :param run_id: The ObjectId of the run
    :type run_id: ObjectId
    :param require_ownership: Whether to include ownership filter
    :type require_ownership: bool
    :returns: MongoDB query dictionary
    :rtype: dict
    :raises: 403 if unauthorized
    """
    query = {"_id": run_id}
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
    """Retrieve a run with authorization check, raising 404 if not found.

    Fetches a run from the database with appropriate authorization checks.
    For authenticated users, checks user_id. For anonymous users, checks
    session_id. If require_ownership is False, skips ownership check
    (useful for admin operations).

    :param run_id: The ObjectId of the run
    :type run_id: ObjectId
    :param require_ownership: Whether to enforce ownership check
    :type require_ownership: bool
    :returns: The run document from MongoDB
    :rtype: dict
    :raises: 403 if unauthorized, 404 if not found
    """
    query = build_run_query(run_id, require_ownership=require_ownership)
    run = db.runs.find_one(query)
    if not run:
        abort(HTTPStatus.NOT_FOUND)
    return run


# ============================================================================
# Turnstile Helpers
# ============================================================================


def validate_turnstile(token):
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


def _userinfo_entitlements(userinfo: dict[str, Any]) -> list[str]:
    """Return Helmholtz group entitlement claims."""
    return _string_values(userinfo.get("entitlements"))


def _get_required_entitlements() -> list[str]:
    """Return configured Helmholtz entitlement groups required to access the app."""
    return _string_values(current_app.config.get("HELMHOLTZ_REQUIRED_ENTITLEMENT"))


def _entitlement_matches_required_group(entitlement: str, required_entitlement: str) -> bool:
    return entitlement == required_entitlement or entitlement.startswith(f"{required_entitlement}#")


def _is_entitlement_restriction_enabled() -> bool:
    return bool(current_app.config.get("HELMHOLTZ_RESTRICT_BY_ENTITLEMENT", True))


def is_helmholtz_access_allowed(userinfo: dict[str, Any]) -> bool:
    """Return whether Helmholtz userinfo satisfies the configured access policy."""
    if not _is_entitlement_restriction_enabled():
        return True

    required_entitlements = _get_required_entitlements()
    if not required_entitlements:
        return False

    return any(
        _entitlement_matches_required_group(entitlement, required_entitlement)
        for entitlement in _userinfo_entitlements(userinfo)
        for required_entitlement in required_entitlements
    )


def fetch_helmholtz_userinfo(access_token: str) -> dict[str, Any]:
    """Fetch OIDC userinfo claims using the absolute configured Helmholtz endpoint."""
    userinfo_url = parse_http_url(current_app.config.get("HELMHOLTZ_USERINFO_ENDPOINT"))
    if userinfo_url is None:
        raise ValueError("HELMHOLTZ_USERINFO_ENDPOINT configuration is invalid")

    response = requests.get(
        userinfo_url.geturl(),
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=current_app.config["HELMHOLTZ_USERINFO_TIMEOUT_SECONDS"],
    )
    response.raise_for_status()
    userinfo = response.json()
    if not isinstance(userinfo, dict):
        raise ValueError("Helmholtz userinfo endpoint returned a non-object response")
    return userinfo


def _merge_userinfo_claims(token_userinfo: object, endpoint_userinfo: object) -> dict[str, Any]:
    """Prefer endpoint userinfo claims over decoded ID-token claims."""
    return {
        **(token_userinfo if isinstance(token_userinfo, dict) else {}),
        **(endpoint_userinfo if isinstance(endpoint_userinfo, dict) else {}),
    }


def load_helmholtz_userinfo(token: dict[str, Any]) -> dict[str, Any]:
    """Load complete userinfo claims for authorization and account lookup."""
    token_userinfo = token.get("userinfo")
    endpoint_userinfo: dict[str, Any] = {}
    access_token = token.get("access_token")

    if not access_token:
        current_app.logger.warning("OAuth token response did not include an access_token")
    else:
        try:
            endpoint_userinfo = fetch_helmholtz_userinfo(access_token)
        except Exception as error:
            current_app.logger.warning("Failed to fetch Helmholtz userinfo endpoint: %s", error)

    return _merge_userinfo_claims(token_userinfo, endpoint_userinfo)


def redirect_to_login_with_oauth_error(error: str):
    frontend_url = parse_http_url(current_app.config.get("FRONTEND_URL"))
    if frontend_url is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Frontend URL configuration is invalid")

    query = {"oauth_error": error}
    redirect_path = sanitize_relative_redirect_path(session.pop("oauth_redirect", None))
    if redirect_path:
        query["redirect"] = redirect_path
    return redirect(f"{frontend_url.geturl().rstrip('/')}/login?{urlencode(query)}")


def revoke_helmholtz_token(access_token: str) -> None:
    """Revoke a Helmholtz access token and request provider-side logout."""
    try:
        revocation_url = parse_http_url(current_app.config.get("HELMHOLTZ_REVOCATION_ENDPOINT"))
        if revocation_url is None:
            current_app.logger.warning("Token revocation skipped: invalid revocation endpoint URL")
            return

        response = requests.post(
            revocation_url.geturl(),
            data={
                "token": access_token,
                "client_id": current_app.config.get("HELMHOLTZ_CLIENT_ID"),
                "token_type_hint": "access_token",
                "logout": "true",
            },
            timeout=current_app.config["HELMHOLTZ_USERINFO_TIMEOUT_SECONDS"],
        )
        if response.status_code != HTTPStatus.OK:
            current_app.logger.warning("Token revocation failed: %s", response.status_code)
    except Exception as error:
        current_app.logger.error("Error revoking token: %s", error)


def deny_oauth_login(token: dict[str, Any], error: str):
    if access_token := token.get("access_token"):
        revoke_helmholtz_token(access_token)
    session.pop("oauth_token", None)
    return redirect_to_login_with_oauth_error(error)


def redirect_after_oauth_login():
    frontend_url_raw = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
    frontend_url = parse_http_url(frontend_url_raw)
    if frontend_url is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Frontend URL configuration is invalid")

    frontend_base = frontend_url.geturl().rstrip("/")
    redirect_path = sanitize_relative_redirect_path(session.pop("oauth_redirect", None))
    if redirect_path:
        return redirect(f"{frontend_base}{redirect_path}")
    return redirect(f"{frontend_base}/")


def get_or_create_helmholtz_user(helmholtz_sub: str) -> dict:
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
