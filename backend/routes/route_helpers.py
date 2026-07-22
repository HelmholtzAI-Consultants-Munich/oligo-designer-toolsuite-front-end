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
        session_id = cast(str, session_id)
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
# Run Helpers
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


def update_run_in_DB(run_id: ObjectId, data: dict[str, Any]) -> None:
    """Update a run in the database. The run must already exist in the database.

    Notes:
        This is very similar to `backend.worker.database._update_run`,
        with the main difference being the error handling. This aborts
        the request if the run could not be updated.

    Arguments:
        run_id {ObjectId} -- The pipeline run's id.
        data {dict[str, Any]} -- The data to be set in the database.
    """
    update_result = db.runs.update_one({"_id": run_id}, {"$set": data})
    if not update_result.acknowledged:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, "Failed to update the run in the database.")


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


def _parse_entitlement(value: str) -> aarc_entitlement.G002 | None:
    try:
        return aarc_entitlement.G002(value)
    except Exception:
        return None


def is_helmholtz_access_allowed(userinfo: dict[str, Any]) -> bool:
    """Return whether Helmholtz userinfo satisfies the configured access policy."""
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
    """Fetch OIDC userinfo claims via the registered Helmholtz OAuth client."""
    response = oauth.helmholtz.get(
        "userinfo", token=token, timeout=current_app.config["HELMHOLTZ_AAI_TIMEOUT_SECONDS"]
    )
    response.raise_for_status()
    userinfo = response.json()
    if not isinstance(userinfo, dict):
        raise ValueError("Helmholtz userinfo endpoint returned a non-object response")
    return userinfo


def load_helmholtz_userinfo(token: dict[str, Any]) -> dict[str, Any]:
    """Load complete userinfo claims for authorization and account lookup."""
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

    current_app.logger.warning("DEBUG token_userinfo (ID token claims): %s", token_userinfo)
    current_app.logger.warning("DEBUG endpoint_userinfo (userinfo endpoint): %s", endpoint_userinfo)
    return {
        **(token_userinfo if isinstance(token_userinfo, dict) else {}),
        **(endpoint_userinfo if isinstance(endpoint_userinfo, dict) else {}),
    }


def _frontend_base_url() -> str:
    frontend_url = parse_http_url(current_app.config.get("FRONTEND_URL"))
    if frontend_url is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Frontend URL configuration is invalid")
    return frontend_url.geturl().rstrip("/")


def redirect_to_login_with_oauth_error(error: str):
    query = {"oauth_error": error}
    redirect_path = sanitize_relative_redirect_path(session.pop("oauth_redirect", None))
    if redirect_path:
        query["redirect"] = redirect_path
    return redirect(f"{_frontend_base_url()}/login?{urlencode(query)}")


def revoke_helmholtz_token(token: dict[str, Any]) -> None:
    """Revoke a Helmholtz access token and request provider-side logout."""
    access_token = token.get("access_token")
    if not access_token:
        return

    try:
        response = oauth.helmholtz.post(
            "revoke",
            data={
                "token": access_token,
                "client_id": current_app.config.get("HELMHOLTZ_CLIENT_ID"),
                "token_type_hint": "access_token",
                "logout": "true",
            },
            token=token,
            timeout=current_app.config["HELMHOLTZ_AAI_TIMEOUT_SECONDS"],
        )
        if response.status_code != HTTPStatus.OK:
            current_app.logger.warning("Token revocation failed: %s", response.status_code)
    except Exception as error:
        current_app.logger.error("Error revoking token: %s", error)


def deny_oauth_login(token: dict[str, Any], error: str):
    if token.get("access_token"):
        revoke_helmholtz_token(token)
    session.pop("oauth_token", None)
    return redirect_to_login_with_oauth_error(error)


def redirect_after_oauth_login():
    redirect_path = sanitize_relative_redirect_path(session.pop("oauth_redirect", None))
    if redirect_path:
        return redirect(f"{_frontend_base_url()}{redirect_path}")
    return redirect(f"{_frontend_base_url()}/")


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


# Sanitization Helpers
# ============================================================================


def sanitize_input(raw_message: str) -> str:
    normalized = unicodedata.normalize("NFKC", raw_message)
    sanitized = nh3.clean(normalized)
    sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", sanitized)
    return sanitized.replace("\r\n", "\n").replace("\r", "\n").strip()
