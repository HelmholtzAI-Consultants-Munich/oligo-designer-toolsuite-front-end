import os
import uuid
from dataclasses import dataclass
from datetime import datetime
from http import HTTPStatus
from pathlib import Path
from typing import Any

from bson import ObjectId
from celery.result import AsyncResult
from flask import Blueprint, abort, current_app, jsonify, request

from backend.config import PIPELINE_NAMES, CeleryConfig
from backend.extensions import celery_app, mongo
from backend.routes.route_helpers import get_user_context_with_directory
from backend.routes.runs import update_run_in_DB
from backend.utilities.typed_values import (
    sanitize_pipeline_form_paths,
    serialize_path,
    timestamp_for_display,
    utc_now,
)
from backend.utilities.validation import parse_run_id

# Blueprint for Merfish endpoints
pipelines_bp = Blueprint("pipelines", __name__)


def validate_name(pipeline_name: str) -> bool:
    return pipeline_name in PIPELINE_NAMES


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


def extract_gene_count(form_data: dict) -> int | None:
    """Extract the number of genes from form_data for heuristic timeout normalization.

    file_regions is either a comma-separated gene list or a path to an uploaded .txt file.
    Returns None if the count cannot be determined.
    """
    file_regions = form_data.get("file_regions", "")
    if not file_regions:
        return None
    if not file_regions.endswith(".txt"):
        # Inline comma-separated gene list
        genes = [g.strip() for g in file_regions.split(",") if g.strip()]
        return len(genes) if genes else None
    # Uploaded .txt file — count non-empty lines
    try:
        with open(file_regions) as f:
            count = sum(1 for line in f if line.strip())
        return count if count > 0 else None
    except OSError:
        current_app.logger.warning(f"Could not read gene count from file_regions path: {file_regions}")
        return None


def write_run_to_DB(
    pipeline_name: str,
    run_id: ObjectId,
    context: RunContext,
    task_id: str,
    gene_count: int | None = None,
):
    data: dict[str, Any] = {
        "session_id": context.session_id,
        "user_id": context.user_id,
        "timestamp": context.timestamp,
        "output_path": serialize_path(context.output_path),
        "status": "pending",
        "pipeline": pipeline_name,
        "task_id": task_id,
    }
    if gene_count is not None:
        data["gene_count"] = gene_count
    return update_run_in_DB(run_id, data)


def _get_heuristic_rate(pipeline_name: str) -> dict | None:
    """Look up cached p95 seconds-per-gene rate for this pipeline from MongoDB.

    Returns a dict with key 'seconds_per_gene', or None if unavailable.
    """
    doc = mongo.db.cache.find_one({"_id": "pipeline_timeouts"})
    if doc:
        return doc.get("data", {}).get(pipeline_name)
    return None


def resolve_timeout(pipeline_name: str, is_authenticated: bool, gene_count: int | None) -> int:
    """Return soft time limit in seconds for this pipeline run.

    In heuristic mode, multiplies the cached p95 seconds-per-gene rate by the current
    run's gene count and the configured safety factor. Falls back to fixed config values
    if no cache data exists or gene count is unavailable.
    """
    if CeleryConfig.pipeline_timeout_mode == "heuristic":
        cached = _get_heuristic_rate(pipeline_name)
        if cached is not None and gene_count:
            multiplier = 2 if is_authenticated else 1
            return int(
                cached["seconds_per_gene"]
                * gene_count
                * CeleryConfig.pipeline_timeout_heuristic_factor
                * multiplier
            )
    return CeleryConfig.pipeline_timeout_auth if is_authenticated else CeleryConfig.pipeline_timeout_anon


def enqueue_pipeline(
    pipeline_name: str,
    form_data: dict[str, Any],
    upload_path: Path,
    output_path: Path,
    is_authenticated: bool,
    task_id: str,
    gene_count: int | None = None,
) -> AsyncResult:
    soft_limit = resolve_timeout(pipeline_name, is_authenticated, gene_count)
    hard_limit = soft_limit + CeleryConfig.pipeline_timeout_hard_margin
    return celery_app.send_task(
        "backend.worker.tasks.run_pipeline",
        (pipeline_name, form_data, str(upload_path), str(output_path)),
        task_id=task_id,
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

    # Pre-generate task_id so we can write it to DB before publishing to RabbitMQ.
    # This closes the race window where the worker's task_prerun signal could fire
    # before write_run_to_DB has stored the task_id in the run document.
    task_id = str(uuid.uuid4())

    # Extract gene count for heuristic timeout normalization and duration tracking.
    gene_count = extract_gene_count(sanitized_form_data)

    # Mark Run as Enqueued in DB FIRST — worker prerun will now always find the document
    update_result = write_run_to_DB(pipeline_name, run_id, context, task_id, gene_count)
    if update_result.matched_count == 0:
        abort(HTTPStatus.NOT_FOUND, description="Run ID not found")

    is_authenticated = context.user_id is not None
    try:
        enqueue_pipeline(
            pipeline_name,
            sanitized_form_data,
            upload_path,
            context.output_path,
            is_authenticated,
            task_id,
            gene_count,
        )
    except Exception:
        # If publishing to the queue fails after the run doc is already written,
        # mark it as failed so the user isn't left with a permanently pending run.
        update_run_in_DB(run_id, {"status": "failure"})
        current_app.logger.exception("Failed to enqueue pipeline task")
        abort(
            HTTPStatus.INTERNAL_SERVER_ERROR, description="Failed to submit pipeline run. Please try again."
        )

    # The task state can be polled using get_run_state(run_id_str).

    return jsonify({"run_id": run_id_str})
