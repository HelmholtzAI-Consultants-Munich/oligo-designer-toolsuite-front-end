import os
import traceback
from datetime import datetime
from typing import Any

from bson import ObjectId
from celery.result import AsyncResult
from extensions import celery_app, mongo
from flask_login import current_user
from flask_login.utils import LocalProxy

from flask import Blueprint, current_app, jsonify, request, session
from routes.validation_helpers import get_run_id

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


def create_context(pipeline_name: str, current_user: LocalProxy[Any | None]) -> dict[str, str | None]:
    if current_user.is_authenticated:
        # Authenticated user: use user-specific directory
        user_id = str(current_user.id)
        user_dir = os.path.join(current_app.config["USERDATA_PATH"], user_id)
        session_id = None
    else:
        # Anonymous user: use session-based directory
        user_id = None
        session_id = str(session.get("session_id"))
        if not session_id:
            raise ValueError("Anonymous session ID not found in session")
        user_dir = os.path.join(current_app.config["USERDATA_PATH"], "anon", session_id)

    if not os.path.exists(user_dir):
        raise RuntimeError(f"Expected user directory at {user_dir} to exist")

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_path = os.path.join(user_dir, f"output_{pipeline_name}_probe_designer_{timestamp}")

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
            "status": "pending",
            "pipeline": pipeline_name,
            "task_id": task_id,
        },
    )


def enqueue_pipeline(
    pipeline_name: str,
    form_data: dict[str, Any],
    upload_path: str,
    output_path: str,
) -> AsyncResult:
    return celery_app.send_task(
        "worker.tasks.run_pipeline",
        (pipeline_name, form_data, upload_path, output_path),
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
        return jsonify({"error": f'Pipeline "{pipeline_name}" does not exist'}), 400

    json = request.get_json(silent=True)
    if not json:
        return jsonify({"error": "Expected JSON"}), 415

    run_id_str = json.get("runid")  # Run ID from React
    run_id = get_run_id(run_id_str)

    form_data = json.get("formdata")  # Form data from React

    upload_path = os.path.join(current_app.config["UPLOAD_PATH"], run_id_str)

    # User Directory and Session / User ID Logic
    try:
        context = create_context(pipeline_name, current_user)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400

    if context["output_path"] is None:
        return jsonify({"error": "Could not infer output directory"}), 500

    result_promise = enqueue_pipeline(pipeline_name, form_data, upload_path, context["output_path"])

    # Mark Run as Enqueued in DB
    update_result = write_run_to_DB(pipeline_name, run_id, context, result_promise.id)
    if update_result.matched_count == 0:
        return jsonify({"error": "Run ID not found"}), 404

    # The task state can be polled using get_run_state(run_id_str).

    return jsonify({"run_id": run_id_str})
