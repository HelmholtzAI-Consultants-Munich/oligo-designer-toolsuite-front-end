from datetime import datetime
import os

import shutil
import tempfile
import traceback

from typing import Any
from bson import ObjectId

from flask import Blueprint, current_app, jsonify, request, session
from flask_login import current_user

from flask_login.utils import LocalProxy
from celery.result import AsyncResult


from extensions import celery_app, mongo


# Blueprint for Merfish endpoints
pipelines_bp = Blueprint("pipelines", __name__)


EXISTING_PIPELINES = {
    "scrinshot",
    "seqfish",
    "merfish",
    "oligoseq",
}


def validate_name(pipeline_name: str) -> bool:
    return pipeline_name in EXISTING_PIPELINES


def parse_run_id(run_id_str: str) -> ObjectId | None:
    # Convert run ID string to ObjectId
    if not run_id_str:
        return None
    try:
        return ObjectId(run_id_str)
    except Exception:
        return None


# TODO: extract together with similar thing in pipeline_runner
# there might be a better way to load multiple files into memory
# than creating an archive on disk and reading that again
def make_upload_archive(upload_path: str, run_id_str: str) -> bytes | None:
    if not os.path.exists(upload_path):
        return None

    archive_base_path = os.path.join(
        tempfile.gettempdir(), f"upload-archive-{run_id_str}"
    )
    current_app.logger.warning(f"Writing archive to {archive_base_path}")
    archive_path = shutil.make_archive(
        base_name=archive_base_path,
        format="zip",
        root_dir=current_app.config["UPLOAD_FOLDER"],
        base_dir=run_id_str,
    )

    with open(archive_path, "br") as f:
        current_app.logger.warning(f"Reading archive from {archive_path}")
        archive = f.read()

    # Delete created archive locally
    os.remove(archive_path)

    # Delete all uploaded files locally
    shutil.rmtree(upload_path)

    return archive


def create_context(
    pipeline_name: str, current_user: LocalProxy[Any | None]
) -> dict[str, str | None]:
    if current_user.is_authenticated:
        # Authenticated user: use user-specific directory
        user_id = str(current_user.id)
        user_dir = os.path.join(current_app.root_path, "user_data", user_id)
        session_id = None
    else:
        # Anonymous user: use session-based directory
        user_id = None
        session_id = str(session.get("session_id"))
        if not session_id:
            raise ValueError("Anonymous session ID not found in session")
        user_dir = os.path.join(current_app.root_path, "user_data", "anon", session_id)

    if not os.path.exists(user_dir):
        raise RuntimeError(f"Expected user directory at {user_dir} to exist")

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_path = os.path.join(
        user_dir, f"output_{pipeline_name}_probe_designer_{timestamp}"
    )

    # To prevent overwriting a run, fail if the directory already exists
    os.makedirs(output_path, exist_ok=False)

    context = {
        "user_id": user_id,
        "session_id": session_id,
        "user_dir": user_dir,
        "timestamp": timestamp,
        "output_path": output_path,
    }

    return context


def update_run_in_DB(run_id: ObjectId, data: dict[Any, Any]):
    return mongo.db.runs.update_one({"_id": run_id}, {"$set": data})


def write_run_to_DB(
    pipeline_name: str,
    run_id: ObjectId,
    context: dict[str, str | None],
    task_id: str | None,
):
    return update_run_in_DB(
        run_id,
        {
            "session_id": context.get("session_id"),
            "user_id": context.get("user_id"),
            "timestamp": context.get("timestamp"),
            "output_path": context.get("output_path"),
            "status": "PENDING",
            "pipeline": pipeline_name,
            "task_id": task_id,
        },
    )


def enqueue_pipeline(
    pipeline_name: str,
    form_data: dict[str, Any],
    upload_path: str,
    uploaded_files: bytes | None,
) -> AsyncResult:
    # TODO: install callbacks for metadata update
    return celery_app.send_task(
        "worker.tasks.run_pipeline",
        (pipeline_name, form_data, upload_path, uploaded_files),
    )


@pipelines_bp.route("/api/<pipeline_name>", methods=["POST"])
def start_pipeline(pipeline_name: str):
    if not validate_name(pipeline_name):
        return jsonify({"error": f'Pipeline "{pipeline_name}" does not exist'}), 400

    json = request.get_json(silent=True)
    if not json:
        return jsonify({"error": "Expected JSON"}), 415

    run_id_str = json.get("runid")  # Run ID from React
    run_id = parse_run_id(run_id_str)
    if not run_id:
        return jsonify({"error": "Invalid run ID format"}), 400

    form_data = json.get("formdata")  # Form data from React

    upload_path = upload_path = os.path.join(
        current_app.config["UPLOAD_FOLDER"], run_id_str
    )
    uploaded_files = make_upload_archive(upload_path, run_id_str)

    # User Directory and Session / User ID Logic
    try:
        context = create_context(pipeline_name, current_user)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400

    result_promise = enqueue_pipeline(
        pipeline_name, form_data, current_app.config["UPLOAD_FOLDER"], uploaded_files
    )
    current_app.logger.warning(result_promise.id)

    # Mark Run as Enqueued in DB
    update_result = write_run_to_DB(pipeline_name, run_id, context, result_promise.id)
    if update_result.matched_count == 0:
        return jsonify(
            {"error": "Run ID not found"}
        ), 404

    # The task state can be polled using get_run_state(run_id_str).
    # If ready, the output will be written to our local filesystem.

    return jsonify({"run_id": run_id_str})
