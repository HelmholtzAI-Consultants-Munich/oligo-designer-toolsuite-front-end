"""Feedback route tests."""

from unittest.mock import patch

import pytest

from backend.extensions import db, limiter


@pytest.fixture(autouse=True)
def _reset_feedback_rate_limit(app):
    """Clear the feedback rate limiter's storage so tests never see a stale 429 from earlier requests.

    Arguments:
        app {Any} -- Flask application instance, ensuring the limiter is already initialized
    """
    limiter.reset()


def test_create_feedback_persists_and_returns_formatted_entry(client, authenticated_user):
    """A valid feedback submission is persisted and returned in format_feedback's shape.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
    """
    with patch("backend.routes.feedback.validate_turnstile", return_value=True):
        response = client.post(
            "/api/feedback",
            json={"message": "Great tool!", "metadata": {"path": "/dashboard"}, "token": "tok"},
        )

    assert response.status_code == 201
    body = response.get_json()
    assert body["message"] == "Great tool!"
    assert body["metadata"] == {"path": "/dashboard"}
    assert body["user_id"] == str(authenticated_user.id)

    doc = db.feedback.find_one({})
    assert doc["message"] == "Great tool!"
    assert doc["user_id"] == str(authenticated_user.id)
    assert doc["metadata"] == {"path": "/dashboard"}
    assert doc["created_at"] is not None


def test_create_feedback_rejects_missing_message(client, authenticated_user):
    """A request with no message field is rejected with 400.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what authenticates client, which the route requires
    """
    with patch("backend.routes.feedback.validate_turnstile", return_value=True):
        response = client.post("/api/feedback", json={"token": "tok"})

    assert response.status_code == 400
    assert db.feedback.count_documents({}) == 0


def test_create_feedback_rejects_empty_message(client, authenticated_user):
    """A blank/whitespace-only message is rejected with 400.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what authenticates client, which the route requires
    """
    with patch("backend.routes.feedback.validate_turnstile", return_value=True):
        response = client.post("/api/feedback", json={"message": "   ", "token": "tok"})

    assert response.status_code == 400
    assert db.feedback.count_documents({}) == 0


def test_create_feedback_rejects_message_over_max_length(app, client, authenticated_user):
    """A message longer than FEEDBACK_MAX_LENGTH is rejected with 400.

    Arguments:
        app {Any} -- Flask application instance whose FEEDBACK_MAX_LENGTH is lowered for this test
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what authenticates client, which the route requires
    """
    app.config["FEEDBACK_MAX_LENGTH"] = 10

    with patch("backend.routes.feedback.validate_turnstile", return_value=True):
        response = client.post("/api/feedback", json={"message": "x" * 11, "token": "tok"})

    assert response.status_code == 400
    assert db.feedback.count_documents({}) == 0


def test_create_feedback_rejects_failed_turnstile_validation(client, authenticated_user):
    """A failing Turnstile check is rejected with 403 and nothing is persisted.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what authenticates client, which the route requires
    """
    with patch("backend.routes.feedback.validate_turnstile", return_value=False):
        response = client.post("/api/feedback", json={"message": "Great tool!", "token": "bad"})

    assert response.status_code == 403
    assert db.feedback.count_documents({}) == 0


def test_create_feedback_requires_authentication(client):
    """An unauthenticated request is rejected before any feedback logic runs.

    Arguments:
        client {Any} -- Flask test client with no active session
    """
    response = client.post("/api/feedback", json={"message": "Great tool!", "token": "tok"})

    assert response.status_code in {401, 403}
