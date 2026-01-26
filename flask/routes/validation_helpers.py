from bson import ObjectId
from bson.errors import InvalidId
from extensions import mongo
from flask_login import current_user

from flask import Response, abort, jsonify, session


def get_run_id(run_id_str: str | None) -> ObjectId:
    """Convert a run_id string from JSON body to ObjectId.

    Use this for validating run_id from request JSON body (e.g., pipelines.py).
    For URL path parameters, use the ObjectId URL converter instead:
        @app.route("/api/runs/<ObjectId:run_id>")

    :param run_id_str: The ObjectId string from request JSON
    :type run_id_str: str | None
    :returns: The validated ObjectId
    :rtype: ObjectId
    :raises InvalidId: If the string is empty or not a valid ObjectId format
    """
    if not run_id_str:
        raise InvalidId("Run ID is required")
    try:
        return ObjectId(run_id_str)
    except Exception as e:
        raise InvalidId(f"Invalid run ID format: {run_id_str}") from e


def get_run(run_id: ObjectId):
    """Fetch a run from the database with user/session authorization.

    :param run_id: The ObjectId of the run
    :type run_id: ObjectId
    :returns: The run document from MongoDB
    :raises: 403 if unauthorized, 404 if not found
    """
    if current_user.is_authenticated:
        query = {"_id": run_id, "user_id": str(current_user.id)}
    else:
        session_id = session.get("session_id")
        if not session_id:
            abort(
                Response(
                    jsonify({"error": "Unauthorized"}).get_data(), status=403, mimetype="application/json"
                )
            )
        query = {"_id": run_id, "session_id": session_id}

    run = mongo.db.runs.find_one(query)
    if not run:
        abort(
            Response(jsonify({"error": "Run not found"}).get_data(), status=404, mimetype="application/json")
        )
    return run


def get_task_id(run) -> str:
    """Extract task_id from a run document.

    :param run: The run document from MongoDB
    :returns: The Celery task ID
    :rtype: str
    :raises: 500 if task_id is not found
    """
    task_id = run.get("task_id")
    if not task_id:
        abort(
            Response(
                jsonify({"error": "Corresponding task not found"}).get_data(),
                status=500,
                mimetype="application/json",
            )
        )
    return task_id
