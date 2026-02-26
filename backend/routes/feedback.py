"""
General feedback API. Not tied to pipelines; available from any page.
"""

from datetime import datetime
from http import HTTPStatus
from typing import Any

from flask import Blueprint, abort, jsonify, request, session
from flask_login import current_user

from backend.extensions import mongo
from backend.utilities.formatting import format_feedback

feedback_bp = Blueprint("feedback", __name__)


@feedback_bp.route("/api/feedbacks", methods=["POST"])
def create_feedback():
    """
    Create a general feedback entry. Can be submitted from any page.

    Accepts a JSON payload with:
    - message: Required feedback text
    - metadata: Optional dict (e.g. path, page). Frontend often sends current path.

    Works for logged-in users, anonymous users with a session, or fully anonymous.
    """
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    metadata = data.get("metadata") or {}

    if not message:
        abort(HTTPStatus.BAD_REQUEST, description="Message is required")

    user_id = None
    session_id = None
    if current_user.is_authenticated:
        user_id = str(current_user.id)
    else:
        session_id = session.get("session_id")

    doc: dict[str, Any] = {
        "message": message,
        "created_at": datetime.utcnow(),
        "metadata": metadata,
    }
    if user_id is not None:
        doc["user_id"] = user_id
    if session_id is not None:
        doc["session_id"] = session_id

    result = mongo.db.feedbacks.insert_one(doc)
    saved = mongo.db.feedbacks.find_one({"_id": result.inserted_id})

    return jsonify(format_feedback(saved)), HTTPStatus.CREATED
