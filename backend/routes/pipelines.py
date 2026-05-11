import os
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from http import HTTPStatus
from pathlib import Path
from typing import Any

from bson import ObjectId
from celery import chord
from celery.result import AsyncResult
from flask import Blueprint, abort, current_app, jsonify, request
from flask_login import current_user

from backend.config import CeleryConfig, Config
from backend.constants import PIPELINE_NAMES
from backend.extensions import celery_app, mongo
from backend.routes.route_helpers import get_user_context_with_directory
from backend.routes.runs import delete_run
from backend.utilities.pipeline import extract_gene_count, generate_single_region_forms, resolve_timeout
from backend.utilities.typed_values import (
    sanitize_pipeline_form_paths,
    serialize_path,
    utc_now,
)
from backend.utilities.validation import parse_run_id, validate_file_key, validate_genomic_form_data
from backend.worker.task_index import Tasks

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

    if not user_dir.exists():
        current_app.logger.error(f"Expected user directory at {user_dir} to exist")
        abort(
            HTTPStatus.INTERNAL_SERVER_ERROR,
            description="Unable to access your data directory. Please try again or contact support.",
        )

    timestamp = utc_now()
    output_path = user_dir / f"output_{pipeline_name}_probe_designer_{uuid.uuid4().hex}"

    # To prevent overwriting a run, fail if the directory already exists
    os.makedirs(output_path, exist_ok=False)

    return RunContext(
        user_id=user_id,
        session_id=session_id,
        user_dir=user_dir,
        timestamp=timestamp,
        output_path=output_path,
    )


def unpack_genomic_form_data(region_generation_forms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    forms = []
    for region_generation_form_data in region_generation_forms:
        validate_genomic_form_data(region_generation_form_data, allowed_sources=["NCBI", "Ensembl"])
        region_generation_list = generate_single_region_forms(region_generation_form_data)
        if not region_generation_list:
            abort(HTTPStatus.BAD_REQUEST, description="Invalid input: no valid genomic regions specified")
        forms.extend(region_generation_list)
    return forms


def parse_region_generation(form_data: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """
    Parses the region_generation_forms field of the provided form.
    Returns a dict mapping ids to a list of dicts, each representing a single region form.
    """
    if "genomic_region_generation_forms" not in form_data:
        return {}

    generated_regions: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    region_generation_forms_by_id: dict[str, list[dict[str, Any]]] = form_data[
        "genomic_region_generation_forms"
    ]

    for id, region_generation_forms in region_generation_forms_by_id.items():
        validate_file_key(id)
        region_generation_list = unpack_genomic_form_data(region_generation_forms)
        generated_regions[id].extend(region_generation_list)

    return dict(generated_regions)


def update_run_in_DB(run_id: ObjectId, data: dict[Any, Any]):
    return mongo.db.runs.update_one({"_id": run_id}, {"$set": data})


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


def check_gene_threshold(form_data: dict[str, Any], run_id: ObjectId):
    gene_count = len(form_data["file_regions"].split(","))
    if gene_count > Config.GENE_COUNT_THRESHOLD:
        delete_run(run_id)
        abort(HTTPStatus.UNAUTHORIZED, description="Please login to analyse more than ten genes.")


def get_task_priority(form_data: dict[str, Any], run_id: ObjectId) -> int:
    if not current_user.is_authenticated:
        check_gene_threshold(form_data, run_id)
        priority = CeleryConfig.task_default_priority
    else:
        priority = CeleryConfig.task_high_priority
    return priority


def enqueue_pipeline(
    pipeline_name: str,
    form_data: dict[str, Any],
    generated_regions: dict[str, list[dict[str, Any]]],
    output_path: Path,
    priority: int,
    is_authenticated: bool,
    task_id: str,
    run_id: ObjectId,
    user_id: str | None,
    session_id: str | None,
    gene_count: int | None = None,
) -> AsyncResult:
    """
    Builds and enqueues a chord such that all region generation tasks
    finish executing before the pipeline is started.
    """
    soft_limit = resolve_timeout(pipeline_name, is_authenticated, gene_count)
    hard_limit = soft_limit + CeleryConfig.pipeline_timeout_hard_margin

    region_generation_signatures = (
        celery_app.signature(Tasks.RUN_GENOMIC_REGION_GENERATOR, args=(form, id))
        for id, forms in generated_regions.items()
        for form in forms
    )

    pipeline_signature = celery_app.signature(
        Tasks.RUN_PIPELINE,
        args=(pipeline_name, form_data, str(output_path)),
        priority=priority,
        task_id=task_id,
        soft_time_limit=soft_limit,
        time_limit=hard_limit,
        headers={
            "run_id": str(run_id),
            "pipeline": pipeline_name,
            "user_id": user_id,
            "session_id": session_id,
            "gene_count": gene_count,
            "publish_time": time.time(),
        },
    )

    return chord(region_generation_signatures)(pipeline_signature)


@pipelines_bp.route("/api/<pipeline_name>", methods=["POST"])
def start_pipeline(pipeline_name: str):
    """
    Handles the pipeline requests by preparing the execution context, updating the run information
    in the database and sending a pipeline task to the Celery cluster by adding it to the queue.

    Orchestrates the workflow for running the pipeline as follows:

    - Verifies the pipeline name
    - Loads and validates user/session context.
    - Extracts form data from the request, and ensures a valid MongoDB run ID is provided.
    - Parses and validates region generation form data.
    - Prepares output directory.
    - Builds chord of tasks, consisting of a group of region generation tasks  and the specified pipeline
        as their callback.
    - Adds chord to the Celery queue for execution.
    - Writes updated run information to database.
    - Returns the run ID as a JSON response.

    :returns: JSON response containing the run ID.
    :rtype: flask.Response

    Note: this endpoint only *enqueues* the pipeline run and returns immediately. The run ID in the
    response can then be used to poll the task status via ``GET /api/runs/<run_id>``.

    For more information on the input parameters and configuration options, refer to the pipeline documentation.
    For details on the genomic region generator, see 'Genomic Region Generator' and 'Caching FASTA Files'
    in the developer documentation.

    """
    if not validate_name(pipeline_name):
        abort(HTTPStatus.BAD_REQUEST, description=f'Pipeline "{pipeline_name}" does not exist')

    json = request.get_json(silent=True)
    if json is None:
        abort(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, description="Expected JSON")

    run_id_str = json.get("runid")  # Run ID from React
    run_id = parse_run_id(run_id_str)

    form_data = json.get("formdata")  # Form data from React
    if not isinstance(form_data, dict):
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: formdata must be an object")

    # TODO: the allowed paths shouldn't be defined here
    allowed_roots = [
        Path(current_app.config["UPLOAD_PATH"]),
        Path("/app/uploads"),
        Path(current_app.root_path) / "cache",
        Path(current_app.config["USERDATA_PATH"]),
    ]
    try:
        sanitized_form_data = sanitize_pipeline_form_paths(form_data, allowed_roots)
    except ValueError as error:
        abort(
            HTTPStatus.BAD_REQUEST, description=f"Invalid file path input: {error!s}"
        )  # TODO: investigate potential data leakage due to this plain error output

    # genomic_region_generator
    generated_regions = parse_region_generation(form_data)

    # User Directory and Session / User ID Logic
    context = create_context(pipeline_name)

    task_id = str(uuid.uuid4())

    # Pipeline timeout durations should be multiplied by number of genes in a run
    gene_count = extract_gene_count(sanitized_form_data)

    priority = get_task_priority(form_data, run_id)

    update_result = write_run_to_DB(pipeline_name, run_id, context, task_id, gene_count)
    if update_result.matched_count == 0:
        abort(HTTPStatus.NOT_FOUND, description="Run ID not found")

    is_authenticated = current_user.is_authenticated
    try:
        enqueue_pipeline(
            pipeline_name,
            sanitized_form_data,
            generated_regions,
            context.output_path,
            priority,
            is_authenticated,
            task_id,
            run_id,
            context.user_id,
            context.session_id,
            gene_count,
        )
    except Exception:
        update_run_in_DB(run_id, {"status": "failure"})
        current_app.logger.error("Failed to enqueue pipeline task")
        abort(
            HTTPStatus.INTERNAL_SERVER_ERROR, description="Failed to submit pipeline run. Please try again."
        )

    return jsonify({"run_id": run_id_str})
