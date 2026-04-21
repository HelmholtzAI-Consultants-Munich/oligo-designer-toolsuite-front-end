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

from http import HTTPStatus

from bson import ObjectId
from flask import Blueprint, abort, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.routes.route_helpers import find_user_by_id, get_run_or_404, get_user_by_id_or_404
from backend.utilities.formatting import format_feedback, format_pipeline_run, format_user
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
from backend.utilities.validation import validate_and_convert_ids, validate_id_array

admin_bp = Blueprint("admin", __name__)


def is_admin(user):
    """
    Check if the current user has admin role.

    :param user: The current user object from Flask-Login
    :type user: User
    :returns: True if user has admin role, False otherwise
    :rtype: bool
    """
    if not user or not user.is_authenticated:
        return False

    user_doc = find_user_by_id(ObjectId(user.id), exclude_password=False)
    if not user_doc:
        return False

    return user_doc.get("role") == "admin"


def require_admin(f):
    """
    Decorator to require admin role for an endpoint.

    :param f: The route function to protect
    :type f: function
    :returns: Decorated function that checks admin role
    :rtype: function
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
    """
    Get all users (admin only).

    Returns list of users in format compatible with Refine data provider.

    :returns: JSON list of users
    :rtype: flask.Response
    """
    users = list(mongo.db.users.find({}, {"password": 0}))  # Exclude password

    # Format for Refine: convert _id to id, format dates
    formatted_users = [format_user(user) for user in users]

    return jsonify(formatted_users), HTTPStatus.OK


@admin_bp.route("/api/admin/users/<ObjectId:user_id>", methods=["GET"])
@login_required
@require_admin
def get_user(user_id: ObjectId):
    """
    Get a single user by ID (admin only).

    :param user_id: The MongoDB ObjectId of the user
    :type user_id: ObjectId
    :returns: JSON user object
    :rtype: flask.Response
    """
    user = get_user_by_id_or_404(user_id, exclude_password=True)
    return jsonify(format_user(user)), HTTPStatus.OK


@admin_bp.route("/api/admin/users/<ObjectId:user_id>", methods=["PUT"])
@login_required
@require_admin
def update_user(user_id: ObjectId):
    """
    Update a user (admin only).

    Allows updating username (for CLI users) and role fields.

    :param user_id: The MongoDB ObjectId of the user
    :type user_id: ObjectId
    :request json username: Optional username (for CLI users only)
    :request json role: Optional role ('user' or 'admin')
    :returns: JSON updated user object
    :rtype: flask.Response
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
    mongo.db.users.update_one({"_id": user_id}, {"$set": update_doc})

    # Fetch updated user
    user = get_user_by_id_or_404(user_id, exclude_password=True)

    return jsonify(format_user(user)), HTTPStatus.OK


@admin_bp.route("/api/admin/users/<ObjectId:user_id>", methods=["DELETE"])
@login_required
@require_admin
def delete_user(user_id: ObjectId):
    """
    Delete a user (admin only).

    :param user_id: The MongoDB ObjectId of the user
    :type user_id: ObjectId
    :returns: JSON confirmation message
    :rtype: flask.Response
    """
    # Prevent deleting yourself
    if str(current_user.id) == str(user_id):
        abort(HTTPStatus.BAD_REQUEST, description="Cannot delete your own account")

    result = mongo.db.users.delete_one({"_id": user_id})

    if result.deleted_count == 0:
        abort(HTTPStatus.NOT_FOUND, description="User not found")

    return jsonify({"message": "User deleted successfully"}), HTTPStatus.OK


@admin_bp.route("/api/admin/legal-documents", methods=["GET"])
@login_required
@require_admin
def get_legal_documents():
    """List legal documents with the current version and history."""
    return jsonify(list_legal_document_admin_views()), HTTPStatus.OK


@admin_bp.route("/api/admin/legal-documents/<document_key>", methods=["GET"])
@login_required
@require_admin
def get_legal_document_detail(document_key: str):
    """Get the current admin view for a legal document."""
    return jsonify(get_legal_document_admin_view(_validate_legal_document_key(document_key))), HTTPStatus.OK


@admin_bp.route("/api/admin/legal-documents/<document_key>/publish", methods=["POST"])
@login_required
@require_admin
def publish_admin_legal_document(document_key: str):
    """Publish a new legal document version."""
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
    """
    Get all pipeline runs (admin only).

    Returns list of all pipeline runs with user information.

    :returns: JSON list of pipeline runs
    :rtype: flask.Response
    """
    # Get all runs, sorted by created_at descending (newest first)
    runs = list(mongo.db.runs.find({}).sort("created_at", -1))

    # Format for Refine: convert _id to id, format dates
    formatted_runs = [format_pipeline_run(run) for run in runs]

    return jsonify(formatted_runs), HTTPStatus.OK


@admin_bp.route("/api/admin/pipelines/<ObjectId:run_id>", methods=["PUT"])
@login_required
@require_admin
def update_pipeline_status(run_id: ObjectId):
    """
    Update a pipeline run status (admin only).

    Allows updating the status field of a pipeline run.

    :param run_id: The MongoDB ObjectId of the pipeline run
    :type run_id: ObjectId
    :request json status: The new status value
    :returns: JSON updated pipeline run object
    :rtype: flask.Response
    """
    data = request.get_json() or {}

    if "status" not in data:
        abort(HTTPStatus.BAD_REQUEST, description="Status field is required")

    status = data["status"].strip().lower()

    # Validate status (only these 4 statuses are allowed)
    valid_statuses = get_valid_pipeline_statuses()
    if status not in valid_statuses:
        abort(
            HTTPStatus.BAD_REQUEST, description=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # Verify run exists (admin can access any run)
    get_run_or_404(run_id, require_ownership=False)

    # Update pipeline run
    result = mongo.db.runs.update_one({"_id": run_id}, {"$set": {"status": status}})

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
    """
    Delete a pipeline run and its associated output files (admin only).

    Removes output files/folders from disk and deletes the corresponding database entry.

    :param run_id: The MongoDB ObjectId of the pipeline run
    :type run_id: ObjectId
    :returns: JSON confirmation message
    :rtype: flask.Response
    """
    # Admin can delete any run - use shared deletion helper
    delete_pipeline_run_files_and_db(mongo, run_id)

    return jsonify({"message": "Pipeline run deleted successfully"}), HTTPStatus.OK


@admin_bp.route("/api/admin/dashboard", methods=["GET"])
@login_required
@require_admin
def get_dashboard_stats():
    """
    Get dashboard statistics (admin only).

    Returns aggregated statistics for the admin dashboard including:
    - Total users count
    - Admin vs regular user breakdown
    - Pipeline runs by status

    :returns: JSON object with dashboard statistics
    :rtype: flask.Response
    """
    # User statistics
    total_users = mongo.db.users.count_documents({})
    admin_users = mongo.db.users.count_documents({"role": "admin"})
    regular_users = total_users - admin_users

    # Pipeline run statistics by status
    pipeline_stats = {}
    valid_statuses = get_valid_pipeline_statuses()

    for status in valid_statuses:
        count = mongo.db.runs.count_documents({"status": status})
        pipeline_stats[status] = count

    # Total pipeline runs
    total_runs = mongo.db.runs.count_documents({})

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
    """
    Get all feedback entries (admin only).

    Returns list of feedback documents with optional user information.

    :returns: JSON list of feedback entries
    :rtype: flask.Response
    """
    feedback_cursor = mongo.db.feedback.find({}).sort("created_at", -1)
    feedback_entries = list(feedback_cursor)

    formatted_feedback = [format_feedback(doc) for doc in feedback_entries]

    return jsonify(formatted_feedback), HTTPStatus.OK


@admin_bp.route("/api/admin/users/bulk-delete", methods=["POST"])
@login_required
@require_admin
def bulk_delete_users():
    """
    Bulk delete users (admin only).

    Deletes multiple users in a single operation. Prevents self-deletion.

    :request json user_ids: Array of user IDs to delete
    :returns: JSON object with deletion results
    :rtype: flask.Response
    """
    data = request.get_json() or {}
    user_ids = validate_id_array(data, "user_ids")

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

    # Delete users in batch
    result = mongo.db.users.delete_many({"_id": {"$in": object_ids}})

    response = {
        "deleted_count": result.deleted_count,
        "message": f"Successfully deleted {result.deleted_count} user(s)",
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
    """
    Bulk update user roles (admin only).

    Updates the role of multiple users. Prevents self-demotion from admin.

    :request json user_ids: Array of user IDs to update
    :request json role: New role ('user' or 'admin')
    :returns: JSON object with update results
    :rtype: flask.Response
    """
    data = request.get_json() or {}
    user_ids = validate_id_array(data, "user_ids")

    role = data.get("role", "").strip().lower()

    if role not in ["user", "admin"]:
        abort(HTTPStatus.BAD_REQUEST, description="role must be 'user' or 'admin'")

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
    result = mongo.db.users.update_many({"_id": {"$in": object_ids}}, {"$set": {"role": role}})

    response = {
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
    """
    Bulk delete pipeline runs (admin only).

    Deletes multiple pipeline runs and their associated output files.
    Handles partial failures gracefully.

    :request json run_ids: Array of run IDs to delete
    :returns: JSON object with deletion results
    :rtype: flask.Response
    """
    data = request.get_json() or {}
    run_ids = validate_id_array(data, "run_ids")

    # Convert to ObjectIds and validate
    object_ids, invalid_ids = validate_and_convert_ids(run_ids)

    if not object_ids:
        abort(HTTPStatus.BAD_REQUEST, description="No valid run IDs provided")

    # Delete runs using the shared helper function
    result = execute_bulk_pipeline_run_deletion(mongo, object_ids)

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
    """
    Bulk update pipeline run status (admin only).

    Updates the status of multiple pipeline runs.

    :request json run_ids: Array of run IDs to update
    :request json status: New status ('pending', 'started', 'success', 'failure')
    :returns: JSON object with update results
    :rtype: flask.Response
    """
    data = request.get_json() or {}
    run_ids = validate_id_array(data, "run_ids")

    status = data.get("status", "").strip().lower()

    if not status:
        abort(HTTPStatus.BAD_REQUEST, description="status field is required")

    # Validate status
    valid_statuses = get_valid_pipeline_statuses()
    if status not in valid_statuses:
        abort(
            HTTPStatus.BAD_REQUEST, description=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # Convert to ObjectIds and validate
    object_ids, invalid_ids = validate_and_convert_ids(run_ids)

    if not object_ids:
        abort(HTTPStatus.BAD_REQUEST, description="No valid run IDs provided")

    # Update runs in batch
    result = mongo.db.runs.update_many({"_id": {"$in": object_ids}}, {"$set": {"status": status}})

    response = {
        "updated_count": result.modified_count,
        "message": f"Successfully updated status of {result.modified_count} pipeline run(s) to {status}",
    }

    if invalid_ids:
        response["invalid_ids"] = invalid_ids

    return jsonify(response), HTTPStatus.OK
