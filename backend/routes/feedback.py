"""
General feedback API. Not tied to pipelines; available from any page.
"""

import re
import unicodedata
from http import HTTPStatus
from typing import Any

import bleach
from flask import Blueprint, abort, current_app, jsonify, request
from flask_login import current_user, login_required

from backend.extensions import db, limiter
from backend.routes.route_helpers import validate_turnstile
from backend.utilities.formatting import format_feedback
from backend.utils import utc_now

feedback_bp = Blueprint("feedback", __name__)
FEEDBACK_RATE_LIMIT = "10 per hour"


def _feedback_rate_limit_key() -> str:
    """Key the rate limit by user rather than IP.

    Notes:
        This endpoint requires login anyway, and per-IP limiting would
        unfairly throttle multiple users behind the same NAT/proxy.

    Returns:
        str -- rate-limit bucket key for the current user.
    """
    return f"user:{current_user.get_id()}"


def sanitize_feedback_message(raw_message: str) -> str:
    """Strip HTML/control characters and normalize Unicode before storage.

    Arguments:
        raw_message {str} -- the raw message submitted by the client.

    Notes:
        Feedback text is later rendered in the admin panel and must not be
        able to inject markup or invisible/spoofing characters.

    Returns:
        str -- sanitized, storage-safe message.
    """
    normalized = unicodedata.normalize("NFKC", raw_message)
    sanitized = bleach.clean(
        normalized,
        tags=[],
        attributes={},
        protocols=[],
        strip=True,
        strip_comments=True,
    )
    sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", sanitized)
    return sanitized.replace("\r\n", "\n").replace("\r", "\n").strip()


@feedback_bp.route("/api/feedback", methods=["POST"])
@login_required
@limiter.limit(
    FEEDBACK_RATE_LIMIT,
    key_func=_feedback_rate_limit_key,
    error_message="You have reached the feedback limit. Please wait before submitting again.",
)
def create_feedback():
    """Create a feedback entry for the current logged-in user.

    Returns:
        flask.Response -- the saved feedback entry.
    """
    data = request.get_json(silent=True) or {}
    message = sanitize_feedback_message(str(data.get("message") or ""))
    metadata = data.get("metadata") or {}
    if not validate_turnstile(data.get("token", "")):
        abort(HTTPStatus.FORBIDDEN, description="We couldn't verify that you are human. Please try again.")
    feedback_max_length = current_app.config.get("FEEDBACK_MAX_LENGTH", 2000)

    if not message:
        abort(HTTPStatus.BAD_REQUEST, description="Message is required")
    if len(message) > feedback_max_length:
        abort(
            HTTPStatus.BAD_REQUEST,
            description=f"Message is too long (max {feedback_max_length} characters)",
        )

    user_id = str(current_user.id)

    doc: dict[str, Any] = {
        "message": message,
        "created_at": utc_now(),
        "metadata": metadata,
        "user_id": user_id,
    }

    result = db.feedback.insert_one(doc)
    saved = db.feedback.find_one({"_id": result.inserted_id})

    return jsonify(format_feedback(saved)), HTTPStatus.CREATED
