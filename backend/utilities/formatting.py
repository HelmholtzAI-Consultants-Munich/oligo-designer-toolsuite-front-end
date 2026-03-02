from bson import ObjectId

from backend.routes.route_helpers import find_user_by_id


def format_user(user):
    """
    Format a user document for API response.

    Converts MongoDB user document to JSON-serializable format.

    :param user: The user document from MongoDB
    :type user: dict
    :returns: Formatted user dictionary
    :rtype: dict
    """
    return {
        "id": str(user["_id"]),
        "username": user.get("username"),
        "role": user.get("role", "user"),
        "helmholtz_sub": user.get("helmholtz_sub"),
        "created_at": user.get("_id").generation_time.isoformat() if user.get("_id") else None,
    }


def format_pipeline_run(run):
    """
    Format a pipeline run document for API response.

    Converts MongoDB document to JSON-serializable format and includes user information.

    :param run: The pipeline run document from MongoDB
    :type run: dict
    :returns: Formatted pipeline run dictionary
    :rtype: dict
    """
    user_id = run.get("user_id")
    user_info = None

    # Fetch user information if user_id exists
    if user_id:
        try:
            user = find_user_by_id(ObjectId(user_id))
            if user:
                # Show username for CLI users, helmholtz_sub for Helmholtz users
                identifier = user.get("username") or user.get("helmholtz_sub") or "Unknown"
                user_info = {"id": str(user["_id"]), "identifier": identifier}
        except Exception:
            pass

    return {
        "id": str(run["_id"]),
        "pipeline": run.get("pipeline", "unknown"),
        "status": run.get("status", "unknown"),
        "timestamp": run.get("timestamp", ""),
        "created_at": run.get("created_at").isoformat() if run.get("created_at") else None,
        "output_path": run.get("output_path", ""),
        "user_id": user_id,
        "user": user_info,
        "session_id": run.get("session_id"),
        "transferred_from_anon": run.get("transferred_from_anon", False),
    }
