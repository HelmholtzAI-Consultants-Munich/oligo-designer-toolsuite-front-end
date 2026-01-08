from bson import ObjectId
from extensions import mongo
from flask_login import current_user

from flask import Response, abort, session


def get_run_id(run_id_str: str) -> ObjectId:
    if not run_id_str:
        abort(Response("Error: Invalid run ID", 400))
    try:
        run_id = ObjectId(run_id_str)
    except Exception:
        abort(Response("Error: Invalid run ID", 400))
    return run_id


def get_run(run_id: ObjectId):
    if current_user.is_authenticated:
        query = {"_id": run_id, "user_id": str(current_user.id)}
    else:
        session_id = session.get("session_id")
        if not session_id:
            abort(Response("Error: Unauthorized", 403))
        query = {"_id": run_id, "session_id": session_id}
    run = mongo.db.runs.find_one(query)
    if not run:
        abort(Response("Error: Run not found", 404))
    return run


def get_task_id(run):
    task_id = run["task_id"]
    if not task_id:
        abort(Response("Corresponding task not found", 500))
    return task_id
