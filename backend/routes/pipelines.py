import os
from dataclasses import dataclass
from datetime import datetime
from http import HTTPStatus
from pathlib import Path
from typing import Any

from bson import ObjectId
from celery.result import AsyncResult
from flask import Blueprint, abort, current_app, jsonify, request

from backend.config import CeleryConfig
from backend.extensions import celery_app, mongo
from backend.routes.route_helpers import get_user_context_with_directory
from backend.utilities.typed_values import (
    sanitize_pipeline_form_paths,
    serialize_path,
    timestamp_for_display,
    utc_now,
)
from backend.utilities.validation import parse_run_id

# Blueprint for Merfish endpoints
pipelines_bp = Blueprint("pipelines", __name__)


EXISTING_PIPELINES = frozenset(
    {
        "scrinshot",
        "seqfish",
        "merfish",
        "oligoseq",
    }
)


def validate_name(pipeline_name: str) -> bool:
    return pipeline_name in EXISTING_PIPELINES


@dataclass(frozen=True)
class RunContext:
    user_id: str | None
    session_id: str | None
    user_dir: Path
    timestamp: datetime
    output_path: Path


def create_context(pipeline_name: str) -> RunContext:
    # Get user context and directory
    user_id, session_id, user_dir = get_user_context_with_directory()

    if not os.path.exists(user_dir):
        current_app.logger.error(f"Expected user directory at {user_dir} to exist")
        abort(
            HTTPStatus.INTERNAL_SERVER_ERROR,
            description="Unable to access your data directory. Please try again or contact support.",
        )

    timestamp = utc_now()
    run_label = timestamp_for_display(timestamp, separator="_")
    output_path = user_dir / f"output_{pipeline_name}_probe_designer_{run_label}"

    # To prevent overwriting a run, fail if the directory already exists
    os.makedirs(output_path, exist_ok=False)

    return RunContext(
        user_id=user_id,
        session_id=session_id,
        user_dir=user_dir,
        timestamp=timestamp,
        output_path=output_path,
    )


def update_run_in_DB(run_id: ObjectId, data: dict[Any, Any]):
    return mongo.db.runs.update_one({"_id": run_id}, {"$set": data})


def write_run_to_DB(
    pipeline_name: str,
    run_id: ObjectId,
    context: RunContext,
    task_id: str | None,
):
    return update_run_in_DB(
        run_id,
        {
            "session_id": context.session_id,
            "user_id": context.user_id,
            "timestamp": context.timestamp,
            "output_path": serialize_path(context.output_path),
            "status": "pending",
            "pipeline": pipeline_name,
            "task_id": task_id,
        },
    )


def _get_heuristic_timeout(pipeline_name: str) -> int | None:
    """Look up cached p95 duration for this pipeline from MongoDB. Returns None if unavailable."""
    doc = mongo.db.cache.find_one({"_id": "pipeline_timeouts"})
    if doc:
        return doc.get("data", {}).get(pipeline_name)
    return None


def resolve_timeout(pipeline_name: str, is_authenticated: bool) -> int:
    """Return soft time limit in seconds for this pipeline run.

    In heuristic mode, uses the cached p95 duration (scaled by auth status) if available,
    otherwise falls back to the fixed config values.
    """
    if CeleryConfig.pipeline_timeout_mode == "heuristic":
        cached = _get_heuristic_timeout(pipeline_name)
        if cached is not None:
            return int(cached * (2 if is_authenticated else 1))
    return CeleryConfig.pipeline_timeout_auth if is_authenticated else CeleryConfig.pipeline_timeout_anon


def enqueue_pipeline(
    pipeline_name: str,
    form_data: dict[str, Any],
    upload_path: Path,
    output_path: Path,
    is_authenticated: bool,
) -> AsyncResult:
    soft_limit = resolve_timeout(pipeline_name, is_authenticated)
    hard_limit = soft_limit + CeleryConfig.pipeline_timeout_hard_margin
    return celery_app.send_task(
        "backend.worker.tasks.run_pipeline",
        (pipeline_name, form_data, str(upload_path), str(output_path)),
        soft_time_limit=soft_limit,
        time_limit=hard_limit,
    )


@pipelines_bp.route("/api/<pipeline_name>", methods=["POST"])
def start_pipeline(pipeline_name: str):
    """
    Handles the pipeline requests by preparing the execution context, updating the run information
    in the database and sending a pipeline task to the Celery cluster by adding it to the queue.

    Orchestrates the workflow for running the pipeline as follows:

    - Verifies the pipeline name
    - Loads and validates user/session context.
    - Extracts form data from the request, and ensures a valid MongoDB run ID is provided.
    - Prepares output directory.
    - Adds pipeline execution to the Celery queue.
    - Writes updated run information to database.
    - Returns the run ID as a JSON response.

    :returns: JSON response containing the run ID.
    :rtype: flask.Response

    For more information on the input parameters and configuration options, refer to the pipeline documentation.

    """
    if not validate_name(pipeline_name):
        abort(HTTPStatus.BAD_REQUEST, description=f'Pipeline "{pipeline_name}" does not exist')

    json = request.get_json(silent=True)
    if not json:
        abort(415, description="Expected JSON")

    run_id_str = json.get("runid")  # Run ID from React
    run_id = parse_run_id(run_id_str)

    form_data = json.get("formdata")  # Form data from React
    if not isinstance(form_data, dict):
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: formdata must be an object")

    upload_path = Path(current_app.config["UPLOAD_PATH"])
    allowed_roots = [
        upload_path,
        Path("/app/uploads"),
        Path(current_app.root_path) / "cache",
        Path(current_app.config["USERDATA_PATH"]),
    ]
    try:
        sanitized_form_data = sanitize_pipeline_form_paths(form_data, allowed_roots)
    except ValueError as error:
        abort(HTTPStatus.BAD_REQUEST, description=f"Invalid file path input: {error!s}")

    # User Directory and Session / User ID Logic
    context = create_context(pipeline_name)

    is_authenticated = context.user_id is not None
    result_promise = enqueue_pipeline(
        pipeline_name, sanitized_form_data, upload_path, context.output_path, is_authenticated
    )

    # Mark Run as Enqueued in DB
    update_result = write_run_to_DB(pipeline_name, run_id, context, result_promise.id)
    if update_result.matched_count == 0:
        abort(HTTPStatus.NOT_FOUND, description="Run ID not found")

    # The task state can be polled using get_run_state(run_id_str).

    return jsonify({"run_id": run_id_str})
