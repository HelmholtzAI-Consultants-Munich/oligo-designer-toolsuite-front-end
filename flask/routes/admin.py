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

from bson import ObjectId
from extensions import mongo
from flask_login import current_user, login_required
from helpers import (
    delete_pipeline_run_files_and_db,
    execute_bulk_pipeline_run_deletion,
    validate_and_convert_ids,
    validate_id_array,
)

from flask import Blueprint, jsonify, request

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

    user_doc = mongo.db.users.find_one({"_id": ObjectId(user.id)})
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
            return jsonify({"error": "Unauthorized. Admin access required."}), 403
        return f(*args, **kwargs)

    decorated_function.__name__ = f.__name__
    return decorated_function


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
        "email": user.get("email", ""),
        "name": user.get("name", ""),
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
            user = mongo.db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1})
            if user:
                user_info = {"id": str(user["_id"]), "email": user.get("email", "Unknown")}
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


def get_valid_pipeline_statuses():
    """
    Get the list of valid pipeline run statuses.

    :returns: List of valid status strings
    :rtype: list[str]
    """
    return ["pending", "started", "success", "failure"]


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
    try:
        users = list(mongo.db.users.find({}, {"password": 0}))  # Exclude password

        # Format for Refine: convert _id to id, format dates
        formatted_users = [format_user(user) for user in users]

        return jsonify(formatted_users), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch users: {e!s}"}), 500


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
    try:
        user = mongo.db.users.find_one({"_id": user_id}, {"password": 0})

        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify(format_user(user)), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch user: {e!s}"}), 500


@admin_bp.route("/api/admin/users/<ObjectId:user_id>", methods=["PUT"])
@login_required
@require_admin
def update_user(user_id: ObjectId):
    """
    Update a user (admin only).

    Allows updating email, name, and role fields.

    :param user_id: The MongoDB ObjectId of the user
    :type user_id: ObjectId
    :request json email: Optional email address
    :request json name: Optional name
    :request json role: Optional role ('user' or 'admin')
    :returns: JSON updated user object
    :rtype: flask.Response
    """
    try:
        data = request.get_json() or {}

        # Validate role if provided
        if "role" in data and data["role"] not in ["user", "admin"]:
            return jsonify({"error": "Invalid role. Must be 'user' or 'admin'"}), 400

        # Build update document
        update_doc = {}
        if "email" in data:
            update_doc["email"] = data["email"].strip().lower()
        if "name" in data:
            update_doc["name"] = data["name"].strip()
        if "role" in data:
            update_doc["role"] = data["role"]

        if not update_doc:
            return jsonify({"error": "No fields to update"}), 400

        # Update user
        result = mongo.db.users.update_one({"_id": user_id}, {"$set": update_doc})

        if result.matched_count == 0:
            return jsonify({"error": "User not found"}), 404

        # Fetch updated user
        user = mongo.db.users.find_one({"_id": user_id}, {"password": 0})

        return jsonify(format_user(user)), 200

    except Exception as e:
        return jsonify({"error": f"Failed to update user: {e!s}"}), 500


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
    try:
        # Prevent deleting yourself
        if str(current_user.id) == str(user_id):
            return jsonify({"error": "Cannot delete your own account"}), 400

        result = mongo.db.users.delete_one({"_id": user_id})

        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to delete user: {e!s}"}), 500


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
    try:
        # Get all runs, sorted by created_at descending (newest first)
        runs = list(mongo.db.runs.find({}).sort("created_at", -1))

        # Format for Refine: convert _id to id, format dates
        formatted_runs = [format_pipeline_run(run) for run in runs]

        return jsonify(formatted_runs), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch pipeline runs: {e!s}"}), 500


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
    try:
        data = request.get_json() or {}

        if "status" not in data:
            return jsonify({"error": "Status field is required"}), 400

        status = data["status"].strip().lower()

        # Validate status (only these 4 statuses are allowed)
        valid_statuses = get_valid_pipeline_statuses()
        if status not in valid_statuses:
            return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400

        # Update pipeline run
        result = mongo.db.runs.update_one({"_id": run_id}, {"$set": {"status": status}})

        if result.matched_count == 0:
            return jsonify({"error": "Pipeline run not found"}), 404

        # Fetch updated run
        run = mongo.db.runs.find_one({"_id": run_id})
        if not run:
            return jsonify({"error": "Pipeline run not found"}), 404

        # Format and return response
        return jsonify(format_pipeline_run(run)), 200

    except Exception as e:
        return jsonify({"error": f"Failed to update pipeline run: {e!s}"}), 500


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
    try:
        # Admin can delete any run - use shared deletion helper
        success, error = delete_pipeline_run_files_and_db(mongo, run_id)

        if not success:
            status_code = 404 if error == "Pipeline run not found" else 500
            return jsonify({"error": error}), status_code

        return jsonify({"message": "Pipeline run deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": f"Failed to delete pipeline run: {e!s}"}), 500


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
    try:
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
        ), 200

    except Exception as e:
        return jsonify({"error": f"Failed to fetch dashboard statistics: {e!s}"}), 500


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
    try:
        data = request.get_json() or {}
        user_ids, error = validate_id_array(data, "user_ids")
        if error:
            return jsonify(error[0]), error[1]

        # Filter out current user's ID (prevent self-deletion)
        current_user_id = str(current_user.id)
        filtered_user_ids = [uid for uid in user_ids if uid != current_user_id]
        skipped = [uid for uid in user_ids if uid == current_user_id]

        if not filtered_user_ids:
            return jsonify(
                {
                    "error": "Cannot delete users",
                    "message": "Cannot delete your own account or no valid users to delete",
                }
            ), 400

        # Convert to ObjectIds and validate
        object_ids, invalid_ids = validate_and_convert_ids(filtered_user_ids)

        if not object_ids:
            return jsonify({"error": "No valid user IDs provided"}), 400

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

        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": f"Failed to bulk delete users: {e!s}"}), 500


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
    try:
        data = request.get_json() or {}
        user_ids, error = validate_id_array(data, "user_ids")
        if error:
            return jsonify(error[0]), error[1]

        role = data.get("role", "").strip().lower()

        if role not in ["user", "admin"]:
            return jsonify({"error": "role must be 'user' or 'admin'"}), 400

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
            return jsonify(
                {
                    "error": "Cannot update roles",
                    "message": "Cannot demote your own admin account or no valid users to update",
                }
            ), 400

        # Convert to ObjectIds and validate
        object_ids, invalid_ids = validate_and_convert_ids(filtered_user_ids)

        if not object_ids:
            return jsonify({"error": "No valid user IDs provided"}), 400

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

        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": f"Failed to bulk update user roles: {e!s}"}), 500


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
    try:
        data = request.get_json() or {}
        run_ids, error = validate_id_array(data, "run_ids")
        if error:
            return jsonify(error[0]), error[1]

        # Convert to ObjectIds and validate
        object_ids, invalid_ids = validate_and_convert_ids(run_ids)

        if not object_ids:
            return jsonify({"error": "No valid run IDs provided"}), 400

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

        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": f"Failed to bulk delete pipeline runs: {e!s}"}), 500


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
    try:
        data = request.get_json() or {}
        run_ids, error = validate_id_array(data, "run_ids")
        if error:
            return jsonify(error[0]), error[1]

        status = data.get("status", "").strip().lower()

        if not status:
            return jsonify({"error": "status field is required"}), 400

        # Validate status
        valid_statuses = get_valid_pipeline_statuses()
        if status not in valid_statuses:
            return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400

        # Convert to ObjectIds and validate
        object_ids, invalid_ids = validate_and_convert_ids(run_ids)

        if not object_ids:
            return jsonify({"error": "No valid run IDs provided"}), 400

        # Update runs in batch
        result = mongo.db.runs.update_many({"_id": {"$in": object_ids}}, {"$set": {"status": status}})

        response = {
            "updated_count": result.modified_count,
            "message": f"Successfully updated status of {result.modified_count} pipeline run(s) to {status}",
        }

        if invalid_ids:
            response["invalid_ids"] = invalid_ids

        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": f"Failed to bulk update pipeline status: {e!s}"}), 500
