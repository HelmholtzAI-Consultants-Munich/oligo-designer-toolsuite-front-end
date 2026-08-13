"""
Converts raw MongoDB documents into the JSON shapes the frontend expects
(renaming _id to id, formatting timestamps, enriching with looked-up user info).
"""

from bson import ObjectId

from backend.routes.route_helpers import find_user_by_id
from backend.utilities.typed_values import path_for_display, timestamp_for_display


def format_user(user):
    """Formats a user document for API responses.

    Arguments:
        user {dict} -- the raw MongoDB user document.

    Notes:
        created_at is derived from the ObjectId's embedded generation time,
        since user documents don't otherwise track when they were created.

    Returns:
        dict -- user formatted for API responses.
    """
    return {
        "id": str(user["_id"]),
        "username": user.get("username"),
        "role": user.get("role", "user"),
        "helmholtz_sub": user.get("helmholtz_sub"),
        "accepted_terms_version": user.get("accepted_terms_version"),
        "terms_accepted_at": user.get("terms_accepted_at").isoformat()
        if user.get("terms_accepted_at")
        else None,
        "created_at": user.get("_id").generation_time.isoformat() if user.get("_id") else None,
    }


def format_pipeline_run(run):
    """Formats a pipeline run document for API responses, including a human-readable identifier for its owning user.

    Arguments:
        run {dict} -- the raw pipeline run document from MongoDB.

    Notes:
        User lookup failures are swallowed so a run still displays even if
        its user was since deleted.

    Returns:
        dict -- run formatted for API responses.
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
        "run_name": run.get("run_name"),
        "pipeline": run.get("pipeline", "unknown"),
        "status": run.get("status", "unknown"),
        "timestamp": timestamp_for_display(run.get("timestamp"), separator="_"),
        "created_at": run.get("created_at").isoformat() if run.get("created_at") else None,
        "output_path": path_for_display(run.get("output_path")),
        "user_id": str(user_id) if user_id else None,
        "user": user_info,
        "session_id": run.get("session_id"),
        "transferred_from_anon": run.get("transferred_from_anon", False),
    }


def format_feedback(feedback):
    """Formats a feedback document for API responses, including the submitting user's info.

    Arguments:
        feedback {dict} -- the raw feedback document from MongoDB.

    Notes:
        Used both for the admin panel and to format a user's own
        just-submitted entry. User lookup failures are swallowed so the
        entry still displays/returns even if the user was since deleted.

    Returns:
        dict -- feedback formatted for API responses.
    """
    user_id = feedback.get("user_id")
    user_info = None

    if user_id:
        try:
            user = find_user_by_id(ObjectId(user_id))
            if user:
                user_info = {
                    "id": str(user["_id"]),
                    "email": user.get("email", "Unknown"),
                }
        except Exception:
            # If user lookup fails, we still return the feedback without user info
            pass

    created_at = feedback.get("created_at")
    created_at_value = created_at.isoformat() if created_at is not None else None

    return {
        "id": str(feedback["_id"]),
        "message": feedback.get("message", ""),
        "created_at": created_at_value,
        "user_id": user_id,
        "user": user_info,
        "metadata": feedback.get("metadata") or {},
    }


def format_monthly_report(report):
    """Formats a monthly report document for the frontend.

    Arguments:
        report {dict} -- the raw monthly report document from MongoDB.

    Notes:
        generated_at is pre-formatted here since the frontend can't parse
        MongoDB's native datetime.

    Returns:
        dict -- report formatted for the frontend.
    """
    return {
        "id": report["_id"],
        "year": report["year"],
        "month": report["month"],
        "generated_at": report["generated_at"].isoformat(),
        "generated_by": report["generated_by"],
        "users": report["users"],
        "runs": report["runs"],
        "conversions": report["conversions"],
        "feedback": report["feedback"],
    }
