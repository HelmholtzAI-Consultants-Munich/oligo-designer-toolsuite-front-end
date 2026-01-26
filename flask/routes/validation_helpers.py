from bson import ObjectId
from bson.errors import InvalidId
from extensions import mongo
from flask import current_app
from flask_login import current_user
from routes.error_handlers import ForbiddenError, InternalServerError, NotFoundError

from flask import session


# ============================================================================
# User Context Helpers
# ============================================================================


def require_user_context() -> dict[str, str]:
    """Get user context (user_id and session_id) based on authentication status.

    Returns a dictionary with user_id and session_id based on whether the user
    is authenticated or anonymous. For authenticated users, user_id is set and
    session_id is None. For anonymous users, user_id is None and session_id
    is retrieved from session.

    :returns: Dictionary with 'user_id' and 'session_id' keys (both strings)
    :rtype: dict[str, str]
    :raises ValueError: If anonymous user has no session_id
    """
    if current_user.is_authenticated:
        return {"user_id": str(current_user.id), "session_id": None}
    else:
        session_id = session.get("session_id")
        if not session_id:
            raise ValueError("Anonymous session ID not found in session")
        return {"user_id": None, "session_id": session_id}


def get_user_context() -> tuple[str | None, str]:
    """Get user context as unpacked tuple.

    Convenience wrapper around require_user_context() that returns
    unpacked values for easier assignment.

    :returns: Tuple of (user_id, session_id)
    :rtype: tuple[str | None, str]
    :raises ValueError: If anonymous user has no session_id
    """
    context = require_user_context()
    return context["user_id"], context["session_id"]


def get_user_directory(userdata_path: str) -> dict[str, str]:
    """Get user context and determine the user directory path.

    Combines require_user_context() with user directory determination.
    Returns user_id, session_id, and the computed user_dir path.

    :param userdata_path: The base path for user data (from app config)
    :type userdata_path: str
    :returns: Dictionary with 'user_id', 'session_id', and 'user_dir' keys
    :rtype: dict[str, str]
    :raises ValueError: If anonymous user has no session_id
    """
    import os

    context = require_user_context()
    user_id = context["user_id"]
    session_id = context["session_id"]

    if user_id:
        user_dir = os.path.join(userdata_path, user_id)
    else:
        user_dir = os.path.join(userdata_path, "anon", session_id)

    return {
        "user_id": user_id,
        "session_id": session_id,
        "user_dir": user_dir,
    }


def get_user_context_with_directory() -> tuple[str | None, str, str]:
    """Get user context and directory using current_app config.

    Convenience wrapper around get_user_directory() that automatically
    extracts USERDATA_PATH from current_app.config and returns unpacked values.

    :returns: Tuple of (user_id, session_id, user_dir)
    :rtype: tuple[str | None, str, str]
    :raises ValueError: If anonymous user has no session_id
    """
    context = get_user_directory(current_app.config["USERDATA_PATH"])
    return context["user_id"], context["session_id"], context["user_dir"]


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
    projection = {"password": 0} if exclude_password else {}
    return mongo.db.users.find_one({"_id": user_id}, projection)


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
        raise NotFoundError("User not found")
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
                raise ForbiddenError("Unauthorized")
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
    run = mongo.db.runs.find_one(query)
    if not run:
        raise NotFoundError("Run not found")
    return run


def get_run_id(run_id_str: str | None) -> ObjectId:
    """Convert a run_id string from JSON body to ObjectId.

    Use this for validating run_id from request JSON body (e.g., pipelines.py).
    For URL path parameters, use the ObjectId URL converter instead:
        @app.route("/api/runs/<ObjectId:run_id>")

    :param run_id_str: The ObjectId string from request JSON
    :type run_id_str: str | None
    :returns: The validated ObjectId
    :rtype: ObjectId
    :raises InvalidId: If the string is empty or not a valid ObjectId format
    """
    if not run_id_str:
        raise InvalidId("Run ID is required")
    try:
        return ObjectId(run_id_str)
    except Exception as e:
        raise InvalidId(f"Invalid run ID format: {run_id_str}") from e


def get_task_id(run) -> str:
    """Extract task_id from a run document.

    :param run: The run document from MongoDB
    :returns: The Celery task ID
    :rtype: str
    :raises: 500 if task_id is not found
    """
    task_id = run.get("task_id")
    if not task_id:
        raise InternalServerError("Corresponding task not found")
    return task_id
