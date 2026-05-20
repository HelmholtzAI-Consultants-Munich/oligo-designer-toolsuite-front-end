import json
import os
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
from redis import Redis
from werkzeug.datastructures import FileStorage, ImmutableMultiDict
from werkzeug.utils import secure_filename

from backend.config import CeleryConfig, Config
from backend.constants import PIPELINE_GENOMIC_INPUT
from backend.extensions import celery_app, mongo
from backend.routes.route_helpers import get_user_context_with_directory
from backend.routes.runs import delete_run
from backend.utilities.pipeline import generate_single_region_forms
from backend.utilities.typed_values import (
    serialize_path,
    utc_now,
)
from backend.utilities.validation import parse_run_id, validate_file_key, validate_genomic_form_data
from backend.worker.task_index import Callbacks, Tasks

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


def parse_region_generation(form_data: dict[str, Any], pipeline_name: str) -> dict[str, list[dict[str, Any]]]:
    """
    Parses the region_generation_forms field of the provided form.
    Returns a dict mapping ids to a list of dicts, each representing a single region form.
    """

    generated_regions: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    region_generation_forms_by_id: dict[str, list[dict[str, Any]]] = {
        field: form_data[field]["fasta_form"]
        for field in PIPELINE_GENOMIC_INPUT[pipeline_name]
        if len(form_data[field]["fasta_form"]) > 0
    }

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
    task_id: str | None,
    priority: int = CeleryConfig.task_default_priority,
    queue_position: tuple[int, int] = (0, 0),  # (high priority runs ahead, low priority runs ahead)
    ui_config: dict | None = None,
):
    data: dict = {
        "session_id": context.session_id,
        "user_id": context.user_id,
        "timestamp": context.timestamp,
        "output_path": serialize_path(context.output_path),
        "status": "pending",
        "pipeline": pipeline_name,
        "task_id": task_id,
        "priority": "high" if priority == CeleryConfig.task_high_priority else "default",
        "queue_position": queue_position,
    }
    if ui_config is not None:
        data["ui_config"] = ui_config
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
    run_id: ObjectId,
    pipeline_name: str,
    form_data: dict[str, Any],
    generated_regions: dict[str, list[dict[str, Any]]],
    output_path: Path,
    priority: int,
) -> AsyncResult:
    """
    Builds and enqueues a chord such that all region generation tasks
    finish executing before the pipeline is started.
    """

    # the chord header tasks get executed simultaneously as a group
    region_generation_signatures = (
        celery_app.signature(Tasks.RUN_GENOMIC_REGION_GENERATOR, args=(form, id))
        for id, forms in generated_regions.items()
        for form in forms
    )

    # the chord body task gets executed once all header tasks finished
    pipeline_signature = celery_app.signature(
        Tasks.RUN_PIPELINE, args=(pipeline_name, form_data, str(output_path)), priority=priority
    )

    error_handler = celery_app.signature(Callbacks.PIPELINE_CHORD_ERRBACK, kwargs={"run_id_str": str(run_id)})

    return chord(region_generation_signatures)(pipeline_signature.on_error(error_handler))


def calculate_queue_position(priority: int) -> tuple[int, int]:
    """Calculate the number of tasks ahead in the queue for both high and default priority levels."""
    redis = Redis.from_url(Config.REDIS_URI)

    # Initialize queue lengths if not present, then fetch and convert to int
    redis.hsetnx(Config.REDIS_QUEUE_LENGTH_KEY, "default", 0)
    redis.hsetnx(Config.REDIS_QUEUE_LENGTH_KEY, "high", 0)
    default_priority_queue_length, high_priority_queue_length = map(
        int, redis.hmget(Config.REDIS_QUEUE_LENGTH_KEY, ["default", "high"])
    )
    high_priority_ahead = high_priority_queue_length

    if priority == CeleryConfig.task_high_priority:
        default_priority_ahead = 0
        # add one high priority run ahead for all low priority runs
        mongo.db.runs.update_many(
            {"status": "pending", "priority": "default"},
            {"$inc": {"queue_position.0": 1}},
        )
        redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, "high", 1)
    else:
        default_priority_ahead = default_priority_queue_length
        redis.hincrby(Config.REDIS_QUEUE_LENGTH_KEY, "default", 1)

    return high_priority_ahead, default_priority_ahead


def save_file(
    file_name: str, files: ImmutableMultiDict[str, FileStorage], saved_files: dict[FileStorage, Path]
):
    if file := files.get(file_name):
        # Step 1: Check if file was already saved
        if file in saved_files:
            return saved_files[file]

        # Step 2: Check if the user actually selected a file (filename should not be empty)
        if file.filename == "":
            abort(HTTPStatus.BAD_REQUEST, description="No selected file")

        # Step 3: Sanitize the filename to prevent path traversal attacks
        safe_filename = secure_filename(file.filename)
        if not safe_filename:
            abort(HTTPStatus.BAD_REQUEST, description="Invalid filename")

        # Step 4: Generate a unique filename by prefixing with a UUID and append to upload root
        upload_root = Path(current_app.config["UPLOAD_PATH"]).resolve()
        unique_filename = Path(f"{uuid.uuid4().hex}_{safe_filename}")
        file_path = (upload_root / unique_filename).resolve()

        # Step 6: Save the file to disk and write file path into form_data
        file.save(file_path)
        saved_files[file] = file_path
        return file_path


def save_files(form_data: dict[str, Any], pipeline_name: str, files: ImmutableMultiDict[str, FileStorage]):
    file_inputs: dict[str, list[Path]] = {}
    # Because duplicated File Objects only get uploaded once via the browser we need to map the Filestorage object
    # to the corresponding path to avoid reading an empty stream
    saved_files: dict[FileStorage, Path] = {}

    for field in PIPELINE_GENOMIC_INPUT[pipeline_name]:
        file_inputs[field] = [
            save_file(file_name, files, saved_files) for file_name in form_data[field]["files"]
        ]

    return file_inputs


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
    - Calculate the queue position and update queue lengths in Redis.
    - Writes updated run information to database.
    - Returns the run ID as a JSON response.

    :returns: JSON response containing the run ID.
    :rtype: flask.Response

    For more information on the input parameters and configuration options, refer to the pipeline documentation.
    For details on the genomic region generator, see 'Genomic Region Generator' and 'Caching FASTA Files'
    in the developer documentation.

    """
    if not validate_name(pipeline_name):
        abort(HTTPStatus.BAD_REQUEST, description=f'Pipeline "{pipeline_name}" does not exist')

    if request.form is None or len(request.form) == 0 or "payload" not in request.form:
        abort(
            HTTPStatus.BAD_REQUEST,
            description="Expected a Multipart form data with payload JSON field",
        )
    form = json.loads(request.form["payload"])

    if form is None or len(form) == 0:
        abort(HTTPStatus.BAD_REQUEST, description="Expected JSON")

    run_id_str = form.get("runid")  # Run ID from React
    run_id = parse_run_id(run_id_str)

    form_data = form.get("formdata")  # Form data from React

    if not isinstance(form_data, dict):
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: formdata must be an object")

    # genomic_region_generator
    generated_regions = parse_region_generation(form_data, pipeline_name)

    files = request.files

    try:
        file_inputs = save_files(form_data, pipeline_name, files)
    except KeyError:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: genomic input files are misformatted")

    for field, file_paths in file_inputs.items():
        form_data[field]["files"] = [str(file_path) for file_path in file_paths]

    # User Directory and Session / User ID Logic
    context = create_context(pipeline_name)

    priority = get_task_priority(form_data, run_id)

    result_promise = enqueue_pipeline(
        run_id, pipeline_name, form_data, generated_regions, context.output_path, priority
    )

    high_priority_ahead, default_priority_ahead = calculate_queue_position(priority)

    # mark run as enqueued in DB
    ui_config = form.get("ui_config") if isinstance(form.get("ui_config"), dict) else None
    update_result = write_run_to_DB(
        pipeline_name,
        run_id,
        context,
        result_promise.id,
        priority,
        (high_priority_ahead, default_priority_ahead),
        ui_config,
    )
    if update_result.matched_count == 0:
        abort(HTTPStatus.NOT_FOUND, description="Run ID not found")

    # The task state can be polled using get_run_state(run_id_str).

    return jsonify({"run_id": run_id_str, "queue_position": (high_priority_ahead, default_priority_ahead)})
