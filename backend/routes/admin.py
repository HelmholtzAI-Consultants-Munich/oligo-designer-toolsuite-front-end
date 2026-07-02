"""
Admin API Endpoints for Refine Admin Panel

This module provides REST API endpoints for admin operations, specifically
user management. All endpoints require admin role authentication.

Endpoints:
    - GET /api/admin/users - List all users
    - GET /api/admin/users/<user_id> - Get single user
    - PUT /api/admin/users/<user_id> - Update user
    - DELETE /api/admin/users/<user_id> - Delete user

:requires: Flask, Flask-Login, MongoDB (via extensions.mongo)
"""

import datetime
from http import HTTPStatus
from typing import NotRequired, TypedDict

from bson import ObjectId
from flask import Blueprint, abort, current_app, jsonify, request
from flask_login import current_user, login_required

from backend.constants import USER_DENYLIST_COLLECTION_KEY
from backend.extensions import celery_app, db
from backend.routes.route_helpers import find_user_by_id, get_run_or_404, get_user_by_id_or_404
from backend.utilities.account_cleanup import delete_user_account_data
from backend.utilities.formatting import (
    format_feedback,
    format_monthly_report,
    format_pipeline_run,
    format_user,
)
from backend.utilities.legal import (
    get_legal_document_admin_view,
    is_supported_legal_document,
    list_legal_document_admin_views,
    publish_legal_document,
)
from backend.utilities.pipeline import (
    delete_pipeline_run_files_and_db,
    execute_bulk_pipeline_run_deletion,
    get_valid_pipeline_statuses,
)
from backend.utilities.user_denylist import (
    ban_helmholtz_sub,
    format_ban,
    remove_ban,
)
from backend.utilities.validation import validate_and_convert_ids, validate_id_array
from backend.worker.task_index import Tasks

admin_bp = Blueprint("admin", __name__)


class BulkOperationResponse(TypedDict):
    message: str
    skipped: NotRequired[list[str]]
    invalid_ids: NotRequired[list[str]]


class BulkDeleteResponse(BulkOperationResponse):
    deleted_count: int


class BulkUpdateResponse(BulkOperationResponse):
    updated_count: int


def is_admin(user):
    """Re-checks the role against the database rather than trusting anything
    cached on the Flask-Login user object, since role changes should take
    effect immediately without waiting for re-login.

    Args:
        user: the current Flask-Login user (may be unauthenticated).

    Returns:
        bool: True only for an authenticated user whose stored role is "admin".
    """
    if not user or not user.is_authenticated:
        return False

    user_doc = find_user_by_id(ObjectId(user.id), exclude_password=False)
    if not user_doc:
        return False

    return user_doc.get("role") == "admin"


def require_admin(f):
    """Kept separate from @login_required so routes can require authentication
    without admin, or stack both when only admins should access an endpoint.

    Args:
        f: the view function to protect.

    Returns:
        the wrapped view, which aborts 403 before running f if the caller
        isn't an admin.
    """

    def decorated_function(*args, **kwargs):
        if not is_admin(current_user):
            abort(HTTPStatus.FORBIDDEN, description="Unauthorized. Admin access required.")
        return f(*args, **kwargs)

    decorated_function.__name__ = f.__name__
    return decorated_function


def _validate_legal_document_key(document_key: str) -> str:
    if not is_supported_legal_document(document_key):
        abort(HTTPStatus.NOT_FOUND, description="Legal document not found")
    return document_key


@admin_bp.route("/api/admin/users", methods=["GET"])
@login_required
@require_admin
def get_users():
    """Joins in ban status per user so the admin panel can show/act on bans
    without a separate round-trip per row.

    Returns:
        flask.Response: JSON list of users, formatted for the Refine data
        provider, each annotated with banned/ban_id.
    """
    users = list(db.users.find({}, {"password": 0}))  # Exclude password

    # Format for Refine: convert _id to id, format dates
    bans_by_sub = {
        ban["helmholtz_sub"]: ban for ban in db[USER_DENYLIST_COLLECTION_KEY].find({}, {"helmholtz_sub": 1})
    }
    formatted_users = []
    for user in users:
        formatted_user = format_user(user)
        ban = bans_by_sub.get(user.get("helmholtz_sub"))
        formatted_user["banned"] = ban is not None
        formatted_user["ban_id"] = str(ban["_id"]) if ban else None
        formatted_users.append(formatted_user)

    return jsonify(formatted_users), HTTPStatus.OK


@admin_bp.route("/api/admin/users/<ObjectId:user_id>", methods=["GET"])
@login_required
@require_admin
def get_user(user_id: ObjectId):
    """Get a single user by ID (admin only).

    Args:
        user_id (ObjectId): the user to fetch.

    Returns:
        flask.Response: the user, formatted for the Refine data provider.
    """
    user = get_user_by_id_or_404(user_id, exclude_password=True)
    return jsonify(format_user(user)), HTTPStatus.OK


@admin_bp.route("/api/admin/users/<ObjectId:user_id>", methods=["PUT"])
@login_required
@require_admin
def update_user(user_id: ObjectId):
    """Username updates are restricted to CLI-registered users (identified by
    already having a username) since Helmholtz-AAI users' identity comes from
    their helmholtz_sub, not a locally-editable username.

    Args:
        user_id (ObjectId): the user to update.

    Returns:
        flask.Response: the updated user, formatted for the Refine data provider.
    """
    data = request.get_json() or {}

    # Validate role if provided
    if "role" in data and data["role"] not in ["user", "admin"]:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid role. Must be 'user' or 'admin'")

    # Build update document
    update_doc = {}
    if "username" in data:
        # Only allow username updates for CLI users (users with username field)
        user = get_user_by_id_or_404(user_id, exclude_password=True)
        if not user.get("username"):
            abort(
                HTTPStatus.BAD_REQUEST,
                description="Helmholtz users do not have a username to update, use helmholtz-sub instead",
            )
        update_doc["username"] = data["username"].strip()
    if "role" in data:
        update_doc["role"] = data["role"]

    if not update_doc:
        abort(HTTPStatus.BAD_REQUEST, description="No fields to update")

    # Verify user exists before updating
    get_user_by_id_or_404(user_id, exclude_password=True)

    # Update user
    db.users.update_one({"_id": user_id}, {"$set": update_doc})

    # Fetch updated user
    user = get_user_by_id_or_404(user_id, exclude_password=True)

    return jsonify(format_user(user)), HTTPStatus.OK


@admin_bp.route("/api/admin/users/<ObjectId:user_id>", methods=["DELETE"])
@login_required
@require_admin
def delete_user(user_id: ObjectId):
    """Delete a user and their associated data (admin only).

    Args:
        user_id (ObjectId): the user to delete.

    Returns:
        flask.Response: confirmation message.
    """
    # Prevent deleting yourself
    if str(current_user.id) == str(user_id):
        abort(HTTPStatus.BAD_REQUEST, description="Cannot delete your own account")

    get_user_by_id_or_404(user_id, exclude_password=True)
    delete_user_account_data(
        user_id=str(user_id),
        upload_root=current_app.config["UPLOAD_PATH"],
        userdata_root=current_app.config["USERDATA_PATH"],
    )

    return jsonify({"message": "User deleted successfully"}), HTTPStatus.OK


@admin_bp.route("/api/admin/users/<ObjectId:user_id>/ban", methods=["POST"])
@login_required
@require_admin
def ban_user(user_id: ObjectId):
    """Bans by helmholtz_sub rather than user_id, so a banned person can't
    just log in again and get a fresh account with full access.

    Args:
        user_id (ObjectId): the user to ban.

    Returns:
        flask.Response: the created ban record.
    """
    if str(current_user.id) == str(user_id):
        abort(HTTPStatus.BAD_REQUEST, description="Cannot ban your own account")

    user = get_user_by_id_or_404(user_id, exclude_password=True)
    ban = ban_helmholtz_sub(user["helmholtz_sub"], str(current_user.id))
    return jsonify(format_ban(ban)), HTTPStatus.OK


@admin_bp.route("/api/admin/banned-users", methods=["GET"])
@login_required
@require_admin
def get_banned_users():
    """List banned users (admin only), most recently banned first.

    Returns:
        flask.Response: JSON list of ban records.
    """
    bans = db[USER_DENYLIST_COLLECTION_KEY].find({}).sort("banned_at", -1)
    return jsonify([format_ban(ban) for ban in bans]), HTTPStatus.OK


@admin_bp.route("/api/admin/banned-users/<ObjectId:ban_id>", methods=["DELETE"])
@login_required
@require_admin
def unban_user(ban_id: ObjectId):
    """Remove a ban (admin only).

    Args:
        ban_id (ObjectId): the ban record to remove — not a user_id, since a
        ban is keyed on helmholtz_sub, not the (possibly recreated) account.

    Returns:
        flask.Response: confirmation message.
    """
    if not remove_ban(ban_id):
        abort(HTTPStatus.NOT_FOUND, description="Ban not found")
    return jsonify({"message": "User unbanned successfully"}), HTTPStatus.OK


@admin_bp.route("/api/admin/legal-documents", methods=["GET"])
@login_required
@require_admin
def get_legal_documents():
    """List legal documents with the current version and history.

    Returns:
        flask.Response: JSON list of legal document admin views.
    """
    return jsonify(list_legal_document_admin_views()), HTTPStatus.OK


@admin_bp.route("/api/admin/legal-documents/<document_key>", methods=["GET"])
@login_required
@require_admin
def get_legal_document_detail(document_key: str):
    """Get the current admin view for a legal document.

    Args:
        document_key (str): which document (e.g. terms, privacy) — validated
        against the supported set before lookup.

    Returns:
        flask.Response: the document's admin view.
    """
    return jsonify(get_legal_document_admin_view(_validate_legal_document_key(document_key))), HTTPStatus.OK


@admin_bp.route("/api/admin/legal-documents/<document_key>/publish", methods=["POST"])
@login_required
@require_admin
def publish_admin_legal_document(document_key: str):
    """Publish a new legal document version. Publishing (rather than editing
    in place) preserves the history so users can be told which version they
    accepted.

    Args:
        document_key (str): which document to publish a new version of.

    Returns:
        flask.Response: the document's admin view after publishing.
    """
    document_key = _validate_legal_document_key(document_key)
    data = request.get_json() or {}

    try:
        document = publish_legal_document(
            document_key=document_key,
            body=data.get("body", ""),
        )
    except ValueError as exc:
        abort(HTTPStatus.BAD_REQUEST, description=str(exc))

    return jsonify(get_legal_document_admin_view(document_key, published_doc=document)), HTTPStatus.OK


@admin_bp.route("/api/admin/pipelines", methods=["GET"])
@login_required
@require_admin
def get_pipeline_runs():
    """List all pipeline runs across all users (admin only) — unlike the
    user-facing runs endpoint, this isn't scoped to the caller.

    Returns:
        flask.Response: JSON list of pipeline runs, newest first.
    """
    # Get all runs, sorted by created_at descending (newest first)
    runs = list(db.runs.find({}).sort("created_at", -1))

    # Format for Refine: convert _id to id, format dates
    formatted_runs = [format_pipeline_run(run) for run in runs]

    return jsonify(formatted_runs), HTTPStatus.OK


@admin_bp.route("/api/admin/pipelines/<ObjectId:run_id>", methods=["PUT"])
@login_required
@require_admin
def update_pipeline_status(run_id: ObjectId):
    """Lets an admin manually correct a run's status (e.g. force-fail a stuck
    run) without needing direct database access.

    Args:
        run_id (ObjectId): the run to update — checked with
        require_ownership=False since admins can touch any user's run.

    Returns:
        flask.Response: the updated run.
    """
    data = request.get_json() or {}

    if "status" not in data:
        abort(HTTPStatus.BAD_REQUEST, description="Status field is required")

    status = data["status"].strip().lower()

    # Validate status
    valid_statuses = get_valid_pipeline_statuses()
    if status not in valid_statuses:
        abort(
            HTTPStatus.BAD_REQUEST, description=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # Verify run exists (admin can access any run)
    get_run_or_404(run_id, require_ownership=False)

    # Update pipeline run
    result = db.runs.update_one({"_id": run_id}, {"$set": {"status": status}})

    if result.matched_count == 0:
        abort(HTTPStatus.NOT_FOUND, description="Pipeline run not found")

    # Fetch updated run
    run = get_run_or_404(run_id, require_ownership=False)

    # Format and return response
    return jsonify(format_pipeline_run(run)), HTTPStatus.OK


@admin_bp.route("/api/admin/pipelines/<ObjectId:run_id>", methods=["DELETE"])
@login_required
@require_admin
def delete_pipeline_run(run_id: ObjectId):
    """Delete any user's pipeline run and its output files (admin only) —
    skips the ownership check that the user-facing delete endpoint enforces.

    Args:
        run_id (ObjectId): the run to delete.

    Returns:
        flask.Response: confirmation message.
    """
    # Admin can delete any run - use shared deletion helper
    delete_pipeline_run_files_and_db(db, run_id)

    return jsonify({"message": "Pipeline run deleted successfully"}), HTTPStatus.OK


@admin_bp.route("/api/admin/dashboard", methods=["GET"])
@login_required
@require_admin
def get_dashboard_stats():
    """Pre-aggregates counts server-side so the admin dashboard doesn't have
    to pull full user/run collections just to show totals.

    Returns:
        flask.Response: JSON with user counts (total/admin/regular) and
        pipeline run counts (total/by_status).
    """
    # User statistics
    total_users = db.users.count_documents({})
    admin_users = db.users.count_documents({"role": "admin"})
    regular_users = total_users - admin_users

    # Pipeline run statistics by status
    pipeline_stats = {}
    valid_statuses = get_valid_pipeline_statuses()

    for status in valid_statuses:
        count = db.runs.count_documents({"status": status})
        pipeline_stats[status] = count

    # Total pipeline runs
    total_runs = db.runs.count_documents({})

    return jsonify(
        {
            "users": {
                "total": total_users,
                "admin": admin_users,
                "regular": regular_users,
            },
            "pipeline_runs": {
                "total": total_runs,
                "by_status": pipeline_stats,
            },
        }
    ), HTTPStatus.OK


@admin_bp.route("/api/admin/feedback", methods=["GET"])
@login_required
@require_admin
def get_feedback():
    """List all user feedback (admin only), newest first.

    Returns:
        flask.Response: JSON list of feedback entries.
    """
    feedback_cursor = db.feedback.find({}).sort("created_at", -1)
    feedback_entries = list(feedback_cursor)

    formatted_feedback = [format_feedback(doc) for doc in feedback_entries]

    return jsonify(formatted_feedback), HTTPStatus.OK


@admin_bp.route("/api/admin/users/bulk-delete", methods=["POST"])
@login_required
@require_admin
def bulk_delete_users():
    """Silently skips (rather than failing) the caller's own ID and any
    invalid IDs, so one bad ID in a batch doesn't block deleting the rest.

    Returns:
        flask.Response: deletion results, including which IDs were skipped
        or invalid.
    """
    data = request.get_json() or {}
    user_ids: list[str] = validate_id_array(data, "user_ids")

    # Filter out current user's ID (prevent self-deletion)
    current_user_id = str(current_user.id)
    filtered_user_ids = [uid for uid in user_ids if uid != current_user_id]
    skipped = [uid for uid in user_ids if uid == current_user_id]

    if not filtered_user_ids:
        abort(
            HTTPStatus.BAD_REQUEST, description="Cannot delete your own account or no valid users to delete"
        )

    # Convert to ObjectIds and validate
    object_ids, invalid_ids = validate_and_convert_ids(filtered_user_ids)

    if not object_ids:
        abort(HTTPStatus.BAD_REQUEST, description="No valid user IDs provided")

    existing_users = list(db.users.find({"_id": {"$in": object_ids}}, {"_id": 1}))
    deleted_count = 0

    for user in existing_users:
        delete_user_account_data(
            user_id=str(user["_id"]),
            upload_root=current_app.config["UPLOAD_PATH"],
            userdata_root=current_app.config["USERDATA_PATH"],
        )
        deleted_count += 1

    response: BulkDeleteResponse = {
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} user(s)",
    }

    if skipped:
        response["skipped"] = skipped
        response["message"] += f", skipped {len(skipped)} (cannot delete own account)"

    if invalid_ids:
        response["invalid_ids"] = invalid_ids

    return jsonify(response), HTTPStatus.OK


@admin_bp.route("/api/admin/users/bulk-update-role", methods=["POST"])
@login_required
@require_admin
def bulk_update_user_role():
    """Silently skips the caller's own ID when demoting to "user", since an
    admin locking themselves out of the admin panel would need another admin
    to fix — better to just exclude them from the batch.

    Returns:
        flask.Response: update results, including which IDs were skipped
        or invalid.
    """
    data = request.get_json() or {}
    user_ids = validate_id_array(data, "user_ids")

    role = data.get("role", "").strip().lower()

    if role not in ["user", "admin"]:
        abort(HTTPStatus.BAD_REQUEST, description=f"Role must be 'user' or 'admin', is {role}")

    # Filter out current user's ID if demoting from admin (prevent self-demotion)
    current_user_id = str(current_user.id)
    filtered_user_ids = user_ids.copy()
    skipped = []

    if role == "user":
        # Check if current user is trying to demote themselves (prevent self-demotion)
        if current_user_id in filtered_user_ids:
            filtered_user_ids.remove(current_user_id)
            skipped.append(current_user_id)

    if not filtered_user_ids:
        abort(
            HTTPStatus.BAD_REQUEST,
            description="Cannot demote your own admin account or no valid users to update",
        )

    # Convert to ObjectIds and validate
    object_ids, invalid_ids = validate_and_convert_ids(filtered_user_ids)

    if not object_ids:
        abort(HTTPStatus.BAD_REQUEST, description="No valid user IDs provided")

    # Update users in batch
    result = db.users.update_many({"_id": {"$in": object_ids}}, {"$set": {"role": role}})

    response: BulkUpdateResponse = {
        "updated_count": result.modified_count,
        "message": f"Successfully updated role of {result.modified_count} user(s) to {role}",
    }

    if skipped:
        response["skipped"] = skipped
        response["message"] += f", skipped {len(skipped)} (cannot demote own admin account)"

    if invalid_ids:
        response["invalid_ids"] = invalid_ids

    return jsonify(response), HTTPStatus.OK


@admin_bp.route("/api/admin/pipelines/bulk-delete", methods=["POST"])
@login_required
@require_admin
def bulk_delete_pipeline_runs():
    """Reports partial failures per-run instead of aborting the whole batch,
    since one run's files being unreachable on disk shouldn't block deleting
    the rest.

    Returns:
        flask.Response: deletion results, including any per-run failures.
    """
    data = request.get_json() or {}
    run_ids = validate_id_array(data, "run_ids")

    # Convert to ObjectIds and validate
    object_ids, invalid_ids = validate_and_convert_ids(run_ids)

    if not object_ids:
        abort(HTTPStatus.BAD_REQUEST, description="No valid run IDs provided")

    # Delete runs using the shared helper function
    result = execute_bulk_pipeline_run_deletion(db, object_ids)

    response = {
        "deleted_count": result["deleted_count"],
        "message": f"Successfully deleted {result['deleted_count']} pipeline run(s)",
    }

    if result["failed"]:
        response["failed"] = result["failed"]
        response["failed_count"] = len(result["failed"])
        response["message"] += f", {len(result['failed'])} failed"

    if result["errors"]:
        response["errors"] = result["errors"]

    if invalid_ids:
        response["invalid_ids"] = invalid_ids

    return jsonify(response), HTTPStatus.OK


@admin_bp.route("/api/admin/pipelines/bulk-update-status", methods=["POST"])
@login_required
@require_admin
def bulk_update_pipeline_status():
    """Bulk equivalent of update_pipeline_status, for correcting many stuck
    runs at once instead of one at a time.

    Returns:
        flask.Response: update results, including any invalid IDs.
    """
    data = request.get_json() or {}
    run_ids = validate_id_array(data, "run_ids")

    status = data.get("status", "").strip().lower()

    if not status:
        abort(HTTPStatus.BAD_REQUEST, description="Status field is required")

    # Validate status
    valid_statuses = get_valid_pipeline_statuses()
    if status not in valid_statuses:
        abort(
            HTTPStatus.BAD_REQUEST,
            description=f"Invalid status: {status} Must be one of: {', '.join(valid_statuses)}",
        )

    # Convert to ObjectIds and validate
    object_ids, invalid_ids = validate_and_convert_ids(run_ids)

    if not object_ids:
        abort(HTTPStatus.BAD_REQUEST, description="No valid run IDs provided")

    # Update runs in batch
    result = db.runs.update_many({"_id": {"$in": object_ids}}, {"$set": {"status": status}})

    response: BulkUpdateResponse = {
        "updated_count": result.modified_count,
        "message": f"Successfully updated status of {result.modified_count} pipeline run(s) to {status}",
    }

    if invalid_ids:
        response["invalid_ids"] = invalid_ids

    return jsonify(response), HTTPStatus.OK


@admin_bp.route("/api/admin/reports", methods=["GET"])
@login_required
@require_admin
def get_monthly_reports():
    """A single report if year/month are given, otherwise the full history —
    the admin panel uses both: a list view and a detail view for one month.

    Returns:
        flask.Response: one report, or a list of all reports (newest first).
    """
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)

    if year and month:
        report_id = f"{year}-{month:02d}"
        doc = db.monthly_reports.find_one({"_id": report_id})
        if not doc:
            abort(HTTPStatus.NOT_FOUND, description=f"No report found for {report_id}")
        return jsonify(format_monthly_report(doc)), HTTPStatus.OK

    reports = list(db.monthly_reports.find({}).sort([("year", -1), ("month", -1)]))
    return jsonify([format_monthly_report(r) for r in reports]), HTTPStatus.OK


@admin_bp.route("/api/admin/reports/<string:report_id>", methods=["DELETE"])
@login_required
@require_admin
def delete_monthly_report(report_id):
    result = db.monthly_reports.delete_one({"_id": report_id})
    if result.deleted_count == 0:
        abort(HTTPStatus.NOT_FOUND, description=f"No report found for {report_id}")
    return jsonify({"message": f"Report {report_id} deleted"}), HTTPStatus.OK


@admin_bp.route("/api/admin/reports/generate", methods=["POST"])
@login_required
@require_admin
def trigger_monthly_report():
    """Dispatches report generation to Celery rather than running it inline,
    since aggregating a month of data shouldn't block the request. Omitting
    year/month regenerates the most recent report (the common case);
    specifying both lets an admin backfill or redo a specific month, but
    never the current/future month since it isn't finished yet.

    Returns:
        flask.Response: confirmation that generation was queued.
    """
    data = request.get_json(silent=True) or {}
    year = data.get("year")
    month = data.get("month")

    kwargs = {}
    if year is None and month is None:
        pass
    elif year is None or month is None:
        abort(HTTPStatus.BAD_REQUEST, description="Year and month must both be provided.")
    else:
        try:
            target_year = int(year)
            target_month = int(month)
        except (TypeError, ValueError):
            abort(HTTPStatus.BAD_REQUEST, description="Year and month must be valid integers.")

        if target_year < 1:
            abort(HTTPStatus.BAD_REQUEST, description="Year must be a positive integer.")
        if not 1 <= target_month <= 12:
            abort(HTTPStatus.BAD_REQUEST, description="Month must be between 1 and 12.")
        today = datetime.date.today()
        if (target_year, target_month) >= (today.year, today.month):
            abort(
                HTTPStatus.BAD_REQUEST,
                description="Cannot generate reports for the current or future month.",
            )

        kwargs = {"target_year": target_year, "target_month": target_month}

    celery_app.send_task(Tasks.GENERATE_MONTHLY_REPORT, kwargs=kwargs)
    return jsonify({"message": "Report generation started"}), HTTPStatus.ACCEPTED
