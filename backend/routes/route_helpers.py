import re
import unicodedata
from http import HTTPStatus
from pathlib import Path
from typing import Any, cast

import nh3
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
        if current_user is not None and current_user.is_authenticated:
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
    current_app.logger.debug(f"Retrieved run {run_id} with query {query}: {run}")
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


def append_event_to_run(run_id: ObjectId, step_payload: dict[str, Any]) -> Any:
    """Append a new step to the run's steps array.

    Arguments:
        run_id {ObjectId} -- The pipeline run's id.
        step_payload {dict[str, Any]} -- The step data to append.
    """
    update_result = db.runs.update_one(
        {"_id": run_id},
        {"$push": {"events": step_payload}},
    )
    if not update_result.acknowledged:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, "Failed to update the run in the database.")


def get_events_for_run(run_id: ObjectId) -> list[dict[str, Any]]:
    """Retrieve all events for a given run.

    Arguments:
        run_id {ObjectId} -- The pipeline run's id.

    Returns:
        list[dict[str, Any]] -- A list of all events for the given run.
    """
    run = get_run_or_404(run_id)
    return run.get("events", [])


def sanitize_dict_for_db(obj: Any) -> Any:
    """Recursively convert dict keys to strings so the object is BSON-serializable.

    Arguments:
        obj {Any} -- The object to sanitize (dict, list, or primitive).

    Returns:
        Any -- The sanitized object, safe to store in database.
    """
    if isinstance(obj, dict):
        return {str(k): sanitize_dict_for_db(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_dict_for_db(v) for v in obj]
    return obj


# ============================================================================
# Turnstile Helpers
# ============================================================================


def validate_turnstile(token):
    # TODO remove temporary bypass for testing
    return True
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
# Sanitization Helpers
# ============================================================================


def sanitize_input(raw_message: str) -> str:
    normalized = unicodedata.normalize("NFKC", raw_message)
    sanitized = nh3.clean(normalized)
    sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", sanitized)
    return sanitized.replace("\r\n", "\n").replace("\r", "\n").strip()
