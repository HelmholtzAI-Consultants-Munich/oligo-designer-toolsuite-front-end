"""
General feedback API. Not tied to pipelines; available from any page.
"""

from datetime import datetime
from http import HTTPStatus
from typing import Any

from flask import Blueprint, abort, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import mongo
from backend.utilities.formatting import format_feedback

feedback_bp = Blueprint("feedback", __name__)
FEEDBACK_MAX_LENGTH = 2000


@feedback_bp.route("/api/feedbacks", methods=["POST"])
@login_required
def create_feedback():
    """
    Create a general feedback entry for logged-in users.

    Accepts a JSON payload with:
    - message: Required feedback text
    - metadata: Optional dict (e.g. path, page). Frontend often sends current path.
    """
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    metadata = data.get("metadata") or {}

    if not message:
        abort(HTTPStatus.BAD_REQUEST, description="Message is required")
    if len(message) > FEEDBACK_MAX_LENGTH:
        abort(
            HTTPStatus.BAD_REQUEST,
            description=f"Message is too long (max {FEEDBACK_MAX_LENGTH} characters)",
        )

    user_id = str(current_user.id)

    doc: dict[str, Any] = {
        "message": message,
        "created_at": datetime.utcnow(),
        "metadata": metadata,
        "user_id": user_id,
    }

    result = mongo.db.feedbacks.insert_one(doc)
    saved = mongo.db.feedbacks.find_one({"_id": result.inserted_id})

    return jsonify(format_feedback(saved)), HTTPStatus.CREATED
