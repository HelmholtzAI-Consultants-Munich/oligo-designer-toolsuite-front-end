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
    sanitize_input,
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
    """Fails fast with a clear 500 if the user directory is missing, and creates a fresh, unused output path.

    Arguments:
        pipeline_name {str} -- used to build a unique output directory name.

    Notes:
        Failing fast here avoids letting file writes fail deeper in the pipeline. Refusing to
        reuse an existing output path (exist_ok=False) ensures two runs can never silently
        overwrite each other's files.

    Returns:
        RunContext -- user/session identity plus the freshly created output path.
    """
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
    """Expands each submitted region-generation form into its concrete per-region forms up front.

    Arguments:
        region_generation_forms {list[dict[str, Any]]} -- raw forms as
        submitted by the user.

    Notes:
        This lets downstream pipeline code only ever deal with fully resolved regions rather
        than the various shorthand inputs users can submit (e.g. gene lists, ranges).

    Returns:
        list[dict[str, Any]] -- flattened list of single-region forms.
    """
    forms = []
    for region_generation_form_data in region_generation_forms:
        validate_genomic_form_data(region_generation_form_data)
        region_generation_list = generate_single_region_forms(region_generation_form_data)
        if not region_generation_list:
            abort(HTTPStatus.BAD_REQUEST, description="Invalid input: no valid genomic regions specified")
        forms.extend(region_generation_list)
    return forms


def parse_region_generation(form_data: dict[str, Any], pipeline_name: str) -> dict[str, list[dict[str, Any]]]:
    """Groups generated regions by their form path (id) rather than flattening everything together.

    Arguments:
        form_data {dict[str, Any]} -- the submitted pipeline form.
        pipeline_name {str} -- determines which form paths hold genomic
        input, since different pipelines expose different fields.

    Notes:
        enqueue_pipeline needs to know which region belongs to which genomic-input field when
        building region-generation tasks.

    Returns:
        dict[str, list[dict[str, Any]]] -- form-path id -> list of
        single-region forms.
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
    """Inserts a new pending run into the database.

    Notes:
        This must be called before enqueue_pipeline(), since the pipeline task looks up this
        run by id and expects it to already exist in the database.

    Returns:
        ObjectId -- the newly created run's id.
    """
    insert_result = db.runs.insert_one({"status": RunStatus.PENDING})
    if not insert_result.acknowledged:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Failed to create run in database")
    return insert_result.inserted_id


def update_run_with_context(
    run_id: ObjectId,
    run_name: str,
    pipeline_name: str,
    context: RunContext,
    priority: int = CeleryConfig.task_default_priority,
    queue_position: tuple[int, int] = (0, 0),  # (high priority runs ahead, low priority runs ahead)
    pipeline_run_config: dict | None = None,
) -> None:
    """Updates a run's database record with its context, priority, and queue position.

    Arguments:
        run_id {ObjectId} -- the run to update.
        pipeline_name {str} -- stored on the run for display/filtering.
        context {RunContext} -- output path and user/session identity.

    Keyword Arguments:
        priority {int} -- used to derive the "high"/"default" label stored
        on the run. (default: {CeleryConfig.task_default_priority})
        queue_position {tuple[int, int]} -- (high-priority ahead,
        default-priority ahead), for frontend queue-position display.
        (default: {(0, 0)})

    Notes:
        This should only be called after enqueue_pipeline() succeeds, so a run never shows
        context/queue info in the database unless it was actually queued.
    """
    data: dict = {
        "pipeline": pipeline_name,
        "session_id": context.session_id,
        "user_id": context.user_id,
        "output_path": serialize_path(context.output_path),
        "created_at": context.timestamp,
        "timestamp": context.timestamp,  # TODO: redundant with "created_at"
        "priority": "high" if priority == CeleryConfig.task_high_priority else "default",
        "queue_position": queue_position,
        "run_name": run_name,
    }
    if pipeline_run_config is not None:
        data["pipeline_run_config"] = pipeline_run_config

    update_run_in_DB(run_id, data)


def check_gene_threshold(form_data: dict[str, Any]):
    """Caps how many genes an anonymous request can analyze at once.

    Arguments:
        form_data {dict[str, Any]} -- the submitted pipeline form.

    Notes:
        Unauthenticated users have no account to rate-limit/ban if they abuse the full-genome
        case — logging in removes the cap.
    """
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
    """Determines the Celery task priority for a pipeline submission based on authentication status.

    Arguments:
        form_data {dict[str, Any]} -- the submitted pipeline form.

    Notes:
        Authenticated users get high priority as an incentive to log in. Anonymous users are
        also gene-capped here, since granting them high priority without that check would let
        them jump the queue for free.

    Returns:
        int -- the Celery task priority to enqueue with.
    """
    if not current_user.is_authenticated:
        check_gene_threshold(form_data)
        priority = CeleryConfig.task_default_priority
    else:
        priority = CeleryConfig.task_high_priority
    return priority


def prepare_pipeline_chord(
    run_id: ObjectId,
    run_name: str,
    pipeline_name: str,
    form_data: dict[str, Any],
    generated_regions: dict[str, list[dict[str, Any]]],
    priority: int,
    context: RunContext,
    is_authenticated: bool = False,
) -> Any:
    """
    Builds a Celery chord to run region-generation and pipeline tasks.

    Arguments:
        run_id {ObjectId} -- used as the pipeline task's id so its status
        can be looked up later.
        pipeline_name {str} -- which pipeline to run.
        form_data {dict[str, Any]} -- the submitted, validated pipeline config.
        generated_regions {dict[str, list[dict[str, Any]]]} -- regions to
        generate as the chord's header tasks.
        priority {int} -- Celery task priority.
        context {RunContext} -- output path and timestamp for the pipeline task.

    Keyword Arguments:
        is_authenticated {bool} -- determines the timeout budget
        (authenticated users get more time). (default: {False})

    Notes:
        Every region-generation task must finish before the pipeline task starts,
        since the pipeline needs all regions resolved up front rather than racing
        with generation.
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
    """Saves an uploaded file to disk, checking saved_files first so the same file isn't saved twice.

    Arguments:
        file_name {str} -- the form field name to look up in `files`.
        files {ImmutableMultiDict[str, FileStorage]} -- uploaded files from
        the request.
        saved_files {dict[FileStorage, Path]} -- already-saved files, shared
        across calls for one submission.

    Notes:
        If one file is used in more than one form field, the browser only sends its data once
        — trying to save it again would read an empty stream.

    Returns:
        Path | None -- where the file was saved, or None if no file was
        submitted for this field.
    """
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
    """Saves every file referenced by the pipeline's declared file-input fields.

    Arguments:
        form_data {dict[str, Any]} -- the submitted pipeline form, used to
        find which field names hold file references.
        pipeline_name {str} -- determines which form paths are file inputs
        for this pipeline.
        files {ImmutableMultiDict[str, FileStorage]} -- uploaded files from
        the request.

    Notes:
        One saved_files cache is shared across all of them so a file uploaded under multiple
        fields is only written to disk once.

    Returns:
        dict[str, list[Path]] -- form path -> saved file paths, ready to be
        written back into form_data in place of the original file names.
    """
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
    """Validates the submitted form against the pipeline's pydantic model before enqueueing.

    Arguments:
        form_data {dict[str, Any]} -- the submitted pipeline form.
        pipeline_name {str} -- selects which pydantic model to validate against.

    Notes:
        This rejects malformed input with a clear 400 here instead of letting it surface as an
        obscure failure deep inside the Celery worker.
    """
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
    """Fills in fields the pipeline schema requires but that aren't part of the user-facing form.

    Arguments:
        form_data {dict[str, Any]} -- mutated in place to add the missing fields.
        pipline_name {str} -- selects which fields to inject for this pipeline.

    Notes:
        This means the frontend schema doesn't need to expose internal/fixed configuration just
        to satisfy pydantic validation.
    """
    for field, value in PIPELINE_NON_EXPOSED_FIELDS.get(pipline_name, {}).items():
        form_data[field] = value


def enforce_concurrent_runs_limit(context: RunContext, is_authenticated: bool):
    """Caps concurrent runs per identity, with separate limits for authenticated and anonymous users.

    Arguments:
        context {RunContext} -- identifies which user/session to count runs for.
        is_authenticated {bool} -- selects which configured limit applies.

    Notes:
        This prevents one user/session from monopolizing worker capacity by queuing many runs
        at once. Anonymous users get a different (lower) limit since anonymous abuse is cheaper
        to attempt.
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
    """Entry point for submitting a pipeline run.

    Arguments:
        pipeline_name {str} -- which pipeline to run — checked against
        EXISTING_PIPELINES since only pipelines with pydantic integration
        are enabled.

    Notes:
        init_run() creates the DB entry before enqueue_pipeline() so the pipeline task can
        always find its run document; update_run_with_context() only writes queue/context info
        afterward, once enqueueing has actually succeeded.

    Returns:
        flask.Response -- the new run's id and its queue position.
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
    run_name = form.get("run_name")  # only used for UI display
    sanitized_run_name = sanitize_input(run_name)

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
        sanitized_run_name,
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
        sanitized_run_name,
        pipeline_name,
        context,
        priority,
        (high_priority_ahead, default_priority_ahead),
        pipeline_run_config,
    )

    return jsonify({"run_id": str(run_id), "queue_position": (high_priority_ahead, default_priority_ahead)})
