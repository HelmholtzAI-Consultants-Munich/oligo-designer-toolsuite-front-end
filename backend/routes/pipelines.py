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
from glom import assign, glom
from pydantic import ValidationError
from werkzeug.datastructures import FileStorage, ImmutableMultiDict
from werkzeug.utils import secure_filename

from backend.config import CeleryConfig, Config
from backend.constants import (
    PIPELINE_FILE_INPUT,
    PIPELINE_GENOMIC_INPUT,
    PIPELINE_NON_EXPOSED_FIELDS,
)
from backend.extensions import celery_app, db
from backend.queue_accounting import add_pending_run, queue_accounting_lock
from backend.routes.route_helpers import (
    get_user_context_with_directory,
    require_terms_acceptance_for_current_context,
    update_run_in_DB,
    validate_turnstile,
)
from backend.types import RunStatus
from backend.utilities.pipeline import generate_single_region_forms, resolve_timeout
from backend.utilities.typed_values import (
    serialize_path,
)
from backend.utilities.validation import validate_genomic_form_data
from backend.utils import utc_now
from backend.worker.models import OligoSeqProbeDesignerConfig
from backend.worker.task_index import Callbacks, Tasks

# Blueprint for Merfish endpoints
pipelines_bp = Blueprint("pipelines", __name__)

# Pipelines other than oligoseq are disabled at the moment, since they do not have
# a pydantic integration
EXISTING_PIPELINES = frozenset(
    {
        # "scrinshot",
        # "seqfish",
        # "merfish",
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
        validate_genomic_form_data(region_generation_form_data)
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
        path: glom(form_data, path)
        for path in PIPELINE_GENOMIC_INPUT.get(pipeline_name, [])
        if len(glom(form_data, path)) > 0
    }

    for id, region_generation_forms in region_generation_forms_by_id.items():
        region_generation_list = unpack_genomic_form_data(region_generation_forms)
        generated_regions[id].extend(region_generation_list)

    return dict(generated_regions)


def init_run() -> ObjectId:
    """Initializes a pending run in the database.

    Notes:
        This needs to be called before `enqueue_pipeline()` since the pipeline task
        expects the run to already exist in the database.

    Returns:
        ObjectId -- The pipeline run's id
    """
    insert_result = db.runs.insert_one({"status": RunStatus.PENDING})
    if not insert_result.acknowledged:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Failed to create run in database")
    return insert_result.inserted_id


def update_run_with_context(
    run_id: ObjectId,
    pipeline_name: str,
    context: RunContext,
    priority: int = CeleryConfig.task_default_priority,
    queue_position: tuple[int, int] = (0, 0),  # (high priority runs ahead, low priority runs ahead)
    pipeline_run_config: dict | None = None,
) -> None:
    data: dict = {
        "pipeline": pipeline_name,
        "session_id": context.session_id,
        "user_id": context.user_id,
        "output_path": serialize_path(context.output_path),
        "created_at": context.timestamp,
        "timestamp": context.timestamp,  # TODO: redundant with "created_at"
        "priority": "high" if priority == CeleryConfig.task_high_priority else "default",
        "queue_position": queue_position,
    }
    if pipeline_run_config is not None:
        data["pipeline_run_config"] = pipeline_run_config

    update_run_in_DB(run_id, data)


def check_gene_threshold(form_data: dict[str, Any]):
    genes_string = glom(form_data, "target_probe.oligo_generation.file_region_ids")
    if genes_string is None:
        abort(HTTPStatus.BAD_REQUEST, description="Please login to analyse all genes. No gene list provided.")
    genes = genes_string.split(",")
    if len(genes) > Config.GENE_COUNT_THRESHOLD:
        abort(
            HTTPStatus.UNAUTHORIZED,
            description=f"Please login to analyse more than {Config.GENE_COUNT_THRESHOLD} genes.",
        )


def get_task_priority(form_data: dict[str, Any]) -> int:
    if not current_user.is_authenticated:
        check_gene_threshold(form_data)
        priority = CeleryConfig.task_default_priority
    else:
        priority = CeleryConfig.task_high_priority
    return priority


def prepare_pipeline_chord(
    run_id: ObjectId,
    pipeline_name: str,
    form_data: dict[str, Any],
    generated_regions: dict[str, list[dict[str, Any]]],
    priority: int,
    context: RunContext,
    is_authenticated: bool = False,
) -> Any:
    """
    Build a chord such that all region generation tasks finish before the pipeline starts.
    """
    soft_limit = resolve_timeout(is_authenticated)
    hard_limit = soft_limit + CeleryConfig.pipeline_timeout_hard_margin

    # the chord header tasks get executed simultaneously as a group
    region_generation_signatures = (
        celery_app.signature(Tasks.RUN_GENOMIC_REGION_GENERATOR, args=(form, id))
        for id, forms in generated_regions.items()
        for form in forms
    )

    # the chord body task gets executed once all header tasks finished
    # The soft limit is the normal interrupt path; the hard limit is a backstop
    # for worker processes that do not shut down after the soft timeout.
    pipeline_signature = celery_app.signature(
        Tasks.RUN_PIPELINE,
        task_id=str(run_id),
        args=(pipeline_name, form_data, str(context.output_path)),
        priority=priority,
        soft_time_limit=soft_limit,
        time_limit=hard_limit,
        headers={
            "enqueued_at": context.timestamp.isoformat(),
        },
    )

    error_handler = celery_app.signature(Callbacks.PIPELINE_CHORD_ERRBACK)

    pipeline_chord = chord(region_generation_signatures, pipeline_signature.on_error(error_handler))
    # Give every header and callback task a shared workflow identifier for whole-chord revocation.
    pipeline_chord.stamp(**{Config.CELERY_PIPELINE_RUN_STAMP: str(run_id)})
    return pipeline_chord


def enqueue_pipeline(pipeline_chord: Any) -> AsyncResult:
    """Send a prepared pipeline chord to Celery."""
    return pipeline_chord.apply_async()


def save_file(
    file_name: str, files: ImmutableMultiDict[str, FileStorage], saved_files: dict[FileStorage, Path]
):
    if file := files.get(file_name):
        # Step 1: Check if file was already saved
        if file in saved_files:
            return saved_files[file]

        # Step 2: Check if the user actually selected a file (filename should not be empty)
        if file.filename is None or file.filename == "":
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

    for path in PIPELINE_FILE_INPUT.get(pipeline_name, []):
        for file_name in glom(form_data, path):
            file_path = save_file(file_name, files, saved_files)
            if file_path is not None:
                if file_inputs.get(path) is None:
                    file_inputs[path] = []
                file_inputs[path].append(file_path)
    return file_inputs


def validate_pipeline_config(form_data: dict[str, Any], pipeline_name: str):

    match pipeline_name:
        case "oligoseq":
            pipeline_model = OligoSeqProbeDesignerConfig
        case _:
            abort(HTTPStatus.BAD_REQUEST, description="unknown pipeline")

    try:
        pipeline_model.model_validate(form_data)
    except ValidationError as v_err:
        current_app.logger.debug(v_err)
        abort(HTTPStatus.BAD_REQUEST, description=f"Invalid input: {v_err!s}")


def add_non_exposed_fields(form_data: dict[str, Any], pipline_name: str):
    """
    Adds fields that are needed by the pipeline schema, but not exposed to users and thus not existing in our
    front-end schemas.

    Arguments:
        form_data {dict[str, Any]} -- pipeline config
        pipline_name {str}
    """

    for field, value in PIPELINE_NON_EXPOSED_FIELDS.get(pipline_name, {}).items():
        form_data[field] = value


def enforce_concurrent_runs_limit(context: RunContext, is_authenticated: bool):
    """
    Abort the request with 429 if the number of currently running pipeline
    runs for the given user/session exceeds the configured maximum.
    Counts both `started` and `pending` runs as "in progress".
    """
    if is_authenticated:
        max_runs = Config.PIPELINE_MAX_CONCURRENT_AUTHENTICATED
        if context.user_id is None:
            return
        running_count = db.runs.count_documents(
            {
                "status": {"$in": ["started", "pending"]},
                "user_id": context.user_id,
            }
        )
    else:
        max_runs = Config.PIPELINE_MAX_CONCURRENT_ANONYMOUS
        if context.session_id is None:
            return
        running_count = db.runs.count_documents(
            {
                "status": {"$in": ["started", "pending"]},
                "session_id": context.session_id,
            }
        )

    if running_count >= max_runs:
        abort(
            HTTPStatus.TOO_MANY_REQUESTS,
            description=(
                f"Too many concurrent pipeline runs ({running_count}) in progress. "
                "Please wait for existing runs to finish before starting a new one."
            ),
        )


@pipelines_bp.route("/api/<pipeline_name>", methods=["POST"])
def start_pipeline(pipeline_name: str):
    """
    Handles the pipeline requests by preparing the execution context, updating the run information
    in the database and sending a pipeline task to the Celery cluster by adding it to the queue.

    Orchestrates the workflow for running the pipeline as follows:

    - Verifies the pipeline name
    - Verifies the turnstile token
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

    require_terms_acceptance_for_current_context()

    if request.form is None or len(request.form) == 0 or "payload" not in request.form:
        abort(
            HTTPStatus.BAD_REQUEST,
            description="Expected a Multipart form data with payload JSON field",
        )
    form = json.loads(request.form["payload"])

    if form is None or len(form) == 0:
        abort(HTTPStatus.BAD_REQUEST, description="Expected JSON")

    if not validate_turnstile(form.get("token", "")):
        abort(HTTPStatus.FORBIDDEN, description="We couldn't verify that you are human. Please try again.")

    form_data = form.get("formdata")  # Form data from React

    if not isinstance(form_data, dict):
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: formdata must be an object")

    add_non_exposed_fields(form_data, pipeline_name)

    validate_pipeline_config(form_data, pipeline_name)

    # genomic_region_generator
    generated_regions = parse_region_generation(form_data, pipeline_name)

    files = request.files

    try:
        file_inputs = save_files(form_data, pipeline_name, files)
    except KeyError:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: genomic input files are misformatted")

    for field_path, file_paths in file_inputs.items():
        assign(form_data, field_path, [str(file_path) for file_path in file_paths])

    # User Directory and Session / User ID Logic
    context = create_context(pipeline_name)

    # Enforce concurrent run limits (runs with status "started" or "pending")
    enforce_concurrent_runs_limit(context, current_user.is_authenticated)

    priority = get_task_priority(form_data)

    # Insert pending run into database
    run_id = init_run()

    pipeline_run_config = (
        form.get("pipeline_run_config") if isinstance(form.get("pipeline_run_config"), dict) else None
    )
    pipeline_chord = prepare_pipeline_chord(
        run_id,
        pipeline_name,
        form_data,
        generated_regions,
        priority,
        context,
        current_user.is_authenticated,
    )
    with queue_accounting_lock() as redis:
        enqueue_pipeline(pipeline_chord)
        high_priority_ahead, default_priority_ahead = add_pending_run(redis, db, priority)

    update_run_with_context(
        run_id,
        pipeline_name,
        context,
        priority,
        (high_priority_ahead, default_priority_ahead),
        pipeline_run_config,
    )

    return jsonify({"run_id": str(run_id), "queue_position": (high_priority_ahead, default_priority_ahead)})
