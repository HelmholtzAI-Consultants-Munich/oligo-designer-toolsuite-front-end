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
from http import HTTPStatus
from typing import Any

from bson import ObjectId
from flask import Blueprint, abort, jsonify, send_file, session
from flask_login import current_user

from backend.extensions import mongo
from backend.routes.route_helpers import get_run_or_404, get_user_context
from backend.utilities.pipeline import delete_pipeline_run_files_and_db
from backend.utilities.typed_values import (
    deserialize_path,
    path_for_display,
    safe_join_under,
    timestamp_to_iso,
    utc_now,
)

runs_bp = Blueprint("runs", __name__)


def format_run_metrics(metrics: dict[str, Any] | None) -> dict[str, Any] | None:
    """Return run metrics formatted for API responses."""
    if not isinstance(metrics, dict):
        return None

    formatted: dict[str, Any] = {}
    for field in ["queue_wait_seconds", "execution_seconds", "total_seconds"]:
        if field in metrics:
            formatted[field] = metrics[field]

    for field in ["started_at", "finished_at"]:
        if metrics.get(field) is not None:
            formatted[field] = timestamp_to_iso(metrics[field])

    return formatted or None


def format_run(run: dict[Any, Any]) -> dict[str, Any]:
    """Return run payload formatted for API responses."""
    formatted = {
        "_id": str(run["_id"]),
        "pipeline": run.get("pipeline", "unknown"),
        "status": run.get("status", "unknown"),
        "timestamp": timestamp_to_iso(run.get("timestamp")),
        "output_path": path_for_display(run.get("output_path")),
        "user_id": run.get("user_id", "unknown"),
        "priority": run.get("priority", "unknown"),
        "queue_position": run.get("queue_position", "unknown"),
    }

    if metrics := format_run_metrics(run.get("metrics")):
        formatted["metrics"] = metrics

    if run.get("status") in ["failure", "timeout", "empty_result"] and run.get("error_message"):
        formatted["error_message"] = run.get("error_message")
    return formatted


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

    # Delete files and DB entry (aborts with 404/500 on failure)
    delete_pipeline_run_files_and_db(mongo, run_id)

    return jsonify({"message": "Run deleted successfully"}), HTTPStatus.OK


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
        "created_at": utc_now(),
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    return jsonify({"run_id": str(run_result.inserted_id)})


@runs_bp.route("/api/runs", methods=["GET"])
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
        formatted_runs.append(format_run(run))
    return jsonify(formatted_runs), HTTPStatus.OK


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
    formatted_run = format_run(run)
    return jsonify(formatted_run), HTTPStatus.OK


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

    output_dir = deserialize_path(run.get("output_path"))
    if output_dir is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Run output directory is missing")

    # Support subdirs (e.g. "annotation/example.fna"), but block path traversal.
    file_path = safe_join_under(output_dir, filename)
    if file_path is None:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid file path")

    if not file_path.exists():
        abort(HTTPStatus.NOT_FOUND, description="File not found")

    # Return correct mimetype
    if filename.endswith((".yml", ".yaml")):
        return send_file(file_path, as_attachment=True)
    elif filename.endswith((".txt", ".log")):
        return send_file(file_path, mimetype="text/plain")
    elif filename.endswith(".fna"):
        return send_file(file_path, mimetype="application/octet-stream")
    else:
        abort(HTTPStatus.BAD_REQUEST, description="Unsupported file type")


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

    output_dir = deserialize_path(run.get("output_path"))
    if output_dir is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Run output directory is missing")

    files = []

    # Main output dir files
    for fname in os.listdir(output_dir):
        if fname.endswith((".yml", ".yaml", ".txt", ".log")):
            file = output_dir / fname
            files.append(
                {
                    "name": fname,
                    "type": "log" if "log" in fname else "config",
                    "size": file.stat().st_size,
                }
            )

    # Special handling for Genomic Region Generator pipeline
    if run.get("pipeline") == "generator":
        output_gen = output_dir / "annotation"
        if output_gen.exists():
            for fname in os.listdir(output_gen):
                if fname.endswith((".yml", ".yaml", ".txt", ".log", ".fna")):
                    file = output_gen / fname
                    files.append(
                        {
                            "name": f"annotation/{fname}",
                            "type": "log" if "log" in fname else "config",
                            "size": file.stat().st_size,
                        }
                    )
    return jsonify(files), HTTPStatus.OK


@runs_bp.route("/api/runs/<ObjectId:run_id>/config", methods=["GET"])
def get_run_config(run_id: ObjectId):
    """
    Return the stored UI config for a specific pipeline run.

    The config is a PipelineConfigExport JSON object saved when the run was started.
    Older runs that pre-date this feature will return 404.

    :param run_id: The ObjectId of the run.
    :type run_id: ObjectId
    :returns: PipelineConfigExport JSON or 404.
    :rtype: flask.Response
    """
    run = get_run_or_404(run_id, require_ownership=True)

    pipeline_run_config = run.get("pipeline_run_config")
    if pipeline_run_config is None:
        abort(HTTPStatus.NOT_FOUND, description="No saved config for this run.")

    return jsonify(pipeline_run_config), HTTPStatus.OK


def update_run_in_DB(run_id: ObjectId, data: dict[Any, Any]):
    return mongo.db.runs.update_one({"_id": run_id}, {"$set": data})


def update_run_status_in_DB(run_id: ObjectId, status: str):
    return update_run_in_DB(run_id, {"status": status})


@runs_bp.route("/api/runs/<ObjectId:run_id>/status", methods=["GET"])
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

    return jsonify({"state": run["status"]}), HTTPStatus.OK
