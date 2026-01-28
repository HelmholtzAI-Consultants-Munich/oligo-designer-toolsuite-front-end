"""
Pipeline Management Endpoints

This module handles all pipeline run CRUD operations, including initialization, deletion,
listing runs and files, and secure download of output files. Endpoints enforce user or session-level
authorization to protect user data.

Features:
    - Run initialization (database entry)
    - Run deletion with file system cleanup
    - Listing of all runs for authenticated or session users
    - Listing of output files for a given run
    - Secure file download with mimetype detection and subdirectory support

:requires: Flask, Flask-Login, MongoDB (via extensions.mongo), OS, datetime, traceback
"""

import os
from datetime import datetime
from typing import Any

from bson import ObjectId
from flask import Blueprint, abort, jsonify, send_file, session
from flask_login import current_user

from backend.extensions import celery_app, mongo
from backend.helpers import delete_pipeline_run_files_and_db
from backend.routes.validation_helpers import get_run_or_404, get_task_id, get_user_context

runs_bp = Blueprint("runs", __name__)


@runs_bp.route("/api/runs/<ObjectId:run_id>", methods=["DELETE"])
def delete_run(run_id: ObjectId):
    """
    Delete a pipeline run and its associated output files.

    Only allows deletion if the run belongs to the current authenticated user.
    Removes output files/folders from disk and deletes the corresponding database entry.

    :param run_id: The ObjectId of the run to delete.
    :type run_id: ObjectId
    :returns: JSON message with success or error.
    :rtype: flask.Response

    Workflow:
        1. Verify ownership (user_id or session_id).
        2. Use shared helper to delete files and database entry.
    """
    # Check ownership first (users can only delete their own runs)
    get_run_or_404(run_id, require_ownership=True)

    # Use shared deletion helper
    success, error = delete_pipeline_run_files_and_db(mongo, run_id)

    if not success:
        abort(500, description=error)

    return jsonify({"message": "Run deleted successfully"}), 200


@runs_bp.route("/api/init_run_id", methods=["POST"])
def init_run_id():
    """
    Initialize a new pipeline run in the database.

    Sets initial status to "pending" and records creation timestamp.

    :returns: JSON object with new run_id.
    :rtype: flask.Response
    """
    user_id, session_id = get_user_context()

    run_doc = {
        "status": "pending",
        "user_id": user_id,
        "session_id": session_id,
        "created_at": datetime.now(),
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    return jsonify({"run_id": str(run_result.inserted_id)})


@runs_bp.route("/api/pipelines", methods=["GET"])
def get_pipeline_runs():
    """
    List all pipeline runs for the current user or anonymous session.

    Authenticated users see their runs; anonymous users see runs for their session_id.

    :returns: List of run documents, formatted for the frontend.
    :rtype: flask.Response

    Workflow:
        1. Check if user is authenticated.
        2. Query DB for runs by user_id or session_id.
        3. Format and return run info for each run.
    """
    if current_user.is_authenticated:
        runs = list(mongo.db.runs.find({"user_id": str(current_user.id)}))
    else:
        session_id = session.get("session_id")
        runs = list(mongo.db.runs.find({"session_id": session_id})) if session_id else []

    formatted_runs = []
    for run in runs:
        formatted = {
            "_id": str(run["_id"]),
            "pipeline": run.get("pipeline", "unknown"),
            "status": run.get("status", "unknown"),
            "timestamp": run.get("timestamp", "").replace("_", " "),
            "output_path": run.get("output_path", ""),
            "user_id": run.get("user_id", "unknown"),
        }
        formatted_runs.append(formatted)
    return jsonify(formatted_runs), 200


@runs_bp.route("/api/runs/<ObjectId:run_id>", methods=["GET"])
def get_pipeline_run(run_id: ObjectId):
    """
    Retrieve details of a specific pipeline run.

    Checks user/session authorization for the run.

    :param run_id: The ObjectId of the run.
    :type run_id: ObjectId
    :returns: Run document or JSON error.
    :rtype: flask.Response

    Workflow:
        1. Fetch run for user/session.
        2. Return run details or error if not found.
    """
    # Auth or session check
    run = get_run_or_404(run_id, require_ownership=True)

    formatted_run = {
        "_id": str(run["_id"]),
        "pipeline": run.get("pipeline", "unknown"),
        "status": run.get("status", "unknown"),
        "timestamp": run.get("timestamp", "").replace("_", " "),
        "output_path": run.get("output_path", ""),
        "user_id": run.get("user_id", "unknown"),
    }
    # Include error_message if status is failure
    if run.get("status") == "failure" and run.get("error_message"):
        formatted_run["error_message"] = run.get("error_message")
    return jsonify(formatted_run), 200


@runs_bp.route("/api/runs/<ObjectId:run_id>/files/<path:filename>", methods=["GET"])
def get_run_file(run_id: ObjectId, filename: str):
    """
    Download a file for a specific pipeline run.

    Checks user/session authorization for the run. Supports nested files (e.g., annotation/ subdirectory).
    Detects mimetype for common bioinformatics file types.

    :param run_id: The ObjectId of the run.
    :type run_id: ObjectId
    :param filename: The (possibly nested) file path relative to the run's output directory.
    :type filename: str
    :returns: File stream or JSON error.
    :rtype: flask.Response

    Workflow:
        1. Fetch run for user/session.
        2. Resolve the requested file path (with subdir support).
        3. Serve file with correct mimetype, or return error.
    """
    # Auth or session check
    run = get_run_or_404(run_id, require_ownership=True)

    # Support subdirs (e.g. "annotation/example.fna")
    file_path = os.path.join(run["output_path"], *filename.split("/"))
    if not os.path.exists(file_path):
        abort(404, description="File not found")

    # Return correct mimetype
    if filename.endswith((".yml", ".yaml")):
        return send_file(file_path, as_attachment=True)
    elif filename.endswith((".txt", ".log")):
        return send_file(file_path, mimetype="text/plain")
    elif filename.endswith(".fna"):
        return send_file(file_path, mimetype="application/octet-stream")
    else:
        abort(400, description="Unsupported file type")


@runs_bp.route("/api/runs/<ObjectId:run_id>/files", methods=["GET"])
def get_run_files(run_id: ObjectId):
    """
    List all output files for a specific pipeline run.

    Handles both main output directory and special annotation subdirectory for Genomic Region Generator pipeline.

    :param run_id: The ObjectId of the run.
    :type run_id: ObjectId
    :returns: List of file metadata dictionaries (name, type, size).
    :rtype: flask.Response

    Workflow:
        1. Auth/session check for run.
        2. List files in run output directory.
        3. If pipeline is Genomic Region Generator, include files from annotation subdir.
    """
    # Auth or session check
    run = get_run_or_404(run_id, require_ownership=True)

    output_dir = run["output_path"]
    files = []

    # Main output dir files
    for fname in os.listdir(output_dir):
        if fname.endswith((".yml", ".yaml", ".txt", ".log")):
            files.append(
                {
                    "name": fname,
                    "type": "log" if "log" in fname else "config",
                    "size": os.path.getsize(os.path.join(output_dir, fname)),
                }
            )

    # Special handling for "Genomic Region Generator" pipeline
    if run.get("pipeline") == "Genomic Region Generator":
        output_gen = os.path.join(output_dir, "annotation")
        if os.path.exists(output_gen):
            for fname in os.listdir(output_gen):
                if fname.endswith((".yml", ".yaml", ".txt", ".log", ".fna")):
                    files.append(
                        {
                            "name": f"annotation/{fname}",
                            "type": "log" if "log" in fname else "config",
                            "size": os.path.getsize(os.path.join(output_gen, fname)),
                        }
                    )
    return jsonify(files), 200


def update_run_in_DB(run_id: ObjectId, data: dict[Any, Any]):
    return mongo.db.runs.update_one({"_id": run_id}, {"$set": data})


def update_run_status_in_DB(run_id: ObjectId, status: str):
    return update_run_in_DB(run_id, {"status": status})


@runs_bp.route("/api/runs/<ObjectId:run_id>/state", methods=["GET"])
def get_run_status(run_id: ObjectId):
    """
    Return status of a specific pipeline run.

    Queries the Celery result backend for the current state of the run.
    Unpacks results and updates the database if the state changed.

    :param run_id: The ObjectId of the run.
    :type run_id: ObjectId
    :returns: Run status or JSON error.
    :rtype: flask.Response
    """
    run = get_run_or_404(run_id)
    state = run["status"]

    if state in {"success", "failure"}:
        return jsonify({"state": state})

    # Check for potential state changes
    task_id = get_task_id(run)
    result_promise = celery_app.AsyncResult(task_id)

    if result_promise.successful():
        ok = result_promise.get()
        # overwrite "success" state if pipeline failed but output was delivered successfully
        # -> literally "task failed successfully"
        state = result_promise.state.lower() if ok else "failure"
    else:
        state = result_promise.state.lower()

    if run["status"] != state:
        update_run_status_in_DB(run_id, state)

    return jsonify({"state": state}), 200
