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

Notes:
    Requires Flask, Flask-Login, MongoDB (via extensions.mongo), OS,
    datetime, traceback.
"""

from http import HTTPStatus
from typing import Any

from bson import ObjectId
from flask import Blueprint, abort, current_app, jsonify, send_file, session
from flask_login import current_user

from backend.extensions import db
from backend.routes.route_helpers import (
    get_run_or_404,
)
from backend.utilities.pipeline import delete_pipeline_run_files_and_db
from backend.utilities.typed_values import (
    deserialize_path,
    safe_join_under,
    timestamp_to_iso,
)

runs_bp = Blueprint("runs", __name__)


def format_run_metrics(metrics: dict[str, Any] | None) -> dict[str, Any] | None:
    """Formats a run's metrics for the frontend, converting timestamps to ISO strings.

    Arguments:
        metrics {dict[str, Any] | None} -- raw metrics dict from the run
        document, or None for runs that don't have metrics yet.

    Notes:
        Only fields relevant to the frontend are exposed, so raw internal
        metric storage doesn't leak into the API.

    Returns:
        dict[str, Any] | None -- formatted metrics, or None if there's
        nothing to show (so callers can omit the key entirely).
    """
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
    """Formats a run document for the frontend.

    Arguments:
        run {dict[Any, Any]} -- the raw run document from MongoDB.

    Notes:
        error_message is only included for terminal failure states, so a
        successful/in-progress run's response doesn't carry a stale
        leftover error from an earlier attempt.

    Returns:
        dict[str, Any] -- run payload formatted for the frontend.
    """
    formatted = {
        "_id": str(run["_id"]),
        "pipeline": run.get("pipeline", "unknown"),
        "run_name": run.get("run_name"),
        "status": run.get("status", "unknown"),
        "timestamp": timestamp_to_iso(run.get("timestamp")),
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
    """Delete a pipeline run's output files and database entry.

    Arguments:
        run_id {ObjectId} -- the run to delete — ownership is enforced so
        users can only delete their own runs.

    Returns:
        flask.Response -- confirmation message.
    """
    # Check ownership first (users can only delete their own runs)
    get_run_or_404(run_id, require_ownership=True)

    # Delete files and DB entry (aborts with 404/500 on failure)
    delete_pipeline_run_files_and_db(db, run_id)

    return jsonify({"message": "Run deleted successfully"}), HTTPStatus.OK


@runs_bp.route("/api/runs", methods=["GET"])
def get_pipeline_runs():
    """Lists runs for the current identity (authenticated user or anonymous session).

    Notes:
        Runs are scoped to user_id if authenticated, otherwise the
        anonymous session_id, so each visitor only ever sees their own
        runs.

    Returns:
        flask.Response -- JSON list of the caller's runs, formatted for the
        frontend.
    """
    if current_user.is_authenticated:
        runs = list(db.runs.find({"user_id": str(current_user.id)}))
    else:
        session_id = session.get("session_id")
        runs = list(db.runs.find({"session_id": session_id})) if session_id else []

    formatted_runs = list(map(format_run, runs))
    return jsonify(formatted_runs), HTTPStatus.OK


@runs_bp.route("/api/runs/<ObjectId:run_id>", methods=["GET"])
def get_pipeline_run(run_id: ObjectId):
    """Get details of a specific pipeline run.

    Arguments:
        run_id {ObjectId} -- the run to fetch — ownership is enforced so
        users can only view their own runs.

    Returns:
        flask.Response -- the run, formatted for the frontend.
    """
    # Auth or session check
    run = get_run_or_404(run_id, require_ownership=True)
    formatted_run = format_run(run)
    return jsonify(formatted_run), HTTPStatus.OK


@runs_bp.route("/api/runs/<ObjectId:run_id>/files/<path:filename>", methods=["GET"])
def get_run_file(run_id: ObjectId, filename: str):
    """Download an output file for a run.

    Arguments:
        run_id {ObjectId} -- the run whose output directory to serve from —
        ownership is enforced.
        filename {str} -- possibly-nested path relative to the run's output
        directory (e.g. "annotation/example.fna").

    Notes:
        Only a fixed extension allowlist is permitted, and the path is
        resolved with safe_join_under, since filename comes straight from
        the URL and must not be able to escape the run's output directory
        (path traversal).

    Returns:
        flask.Response -- the file as an attachment.
    """
    ALLOWED_FILE_ENDINGS = (".yml", ".yaml", ".tsv", ".xlsx")

    # Auth or session check
    run = get_run_or_404(run_id, require_ownership=True)

    output_dir = deserialize_path(run.get("output_path"))
    if output_dir is None:
        current_app.logger.error(f"Output directory is missing for run {run_id}")
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Run output directory is missing")
    # Support subdirs (e.g. "annotation/example.fna"), but block path traversal.
    file_path = safe_join_under(output_dir, filename)
    if file_path is None:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid file path")

    if not file_path.exists():
        abort(HTTPStatus.NOT_FOUND, description="File not found")

    # Return correct mimetype
    if filename.endswith(ALLOWED_FILE_ENDINGS):
        return send_file(str(file_path), as_attachment=True)
    else:
        abort(HTTPStatus.BAD_REQUEST, description="Unsupported file type")


@runs_bp.route("/api/runs/<ObjectId:run_id>/config", methods=["GET"])
def get_run_config(run_id: ObjectId):
    """Get the saved pipeline configuration for a past run.

    Arguments:
        run_id {ObjectId} -- the run whose saved config to fetch — ownership
        is enforced.

    Notes:
        This lets the frontend re-populate a form from a past run (e.g.
        "rerun with same settings"). It 404s for older runs that predate
        this feature, since there's no config to return for them.

    Returns:
        flask.Response -- the saved PipelineConfigExport JSON.
    """
    run = get_run_or_404(run_id, require_ownership=True)

    pipeline_run_config = run.get("pipeline_run_config")
    if pipeline_run_config is None:
        abort(HTTPStatus.NOT_FOUND, description="No saved config for this run.")

    return jsonify(pipeline_run_config), HTTPStatus.OK


@runs_bp.route("/api/runs/<ObjectId:run_id>/status", methods=["GET"])
def get_run_status(run_id: ObjectId):
    """Get the current status of a pipeline run.

    Arguments:
        run_id {ObjectId} -- the run to check — ownership is enforced.

    Notes:
        This is a lightweight endpoint for the frontend to poll while a run
        is in progress, without pulling the full run document each time.

    Returns:
        flask.Response -- the run's current status.
    """
    run = get_run_or_404(run_id)

    return jsonify({"state": run["status"]}), HTTPStatus.OK
