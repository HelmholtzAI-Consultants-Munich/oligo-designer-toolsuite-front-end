"""Tests that Flask error handlers return sanitized JSON responses instead of leaking internal details."""

from unittest.mock import patch

import pytest

from backend.tests.conftest import assert_sanitized_error


def test_http_exception_returns_json_error(client, authenticated_user):
    """HTTP exceptions must return JSON instead of Flask's default HTML error page.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what creates the user and accepted terms the route requires

    Notes:
        This lets API clients parse errors programmatically.
    """
    response = client.post("/api/oligoseq", content_type="text/plain", data="not json")

    assert response.status_code == 400
    assert response.get_json() == {"error": "Expected a Multipart form data with payload JSON field"}


def test_404_unknown_route_returns_json_error(client):
    """Unknown routes must return JSON errors.

    Arguments:
        client {Any} -- anonymous Flask test client
    """
    response = client.get("/api/does/not/exist")

    assert response.status_code == 404
    assert "error" in response.get_json()


@pytest.mark.parametrize(
    ("exception_message", "forbidden_fragments"),
    [
        ("secret internal details /user_data/abc123", ["secret", "/user_data/"]),
        ("Error in /user_data/123/config.yaml", ["/user_data/", "config.yaml"]),
        ("Traceback (most recent call last):", ["Traceback"]),
        # InvalidId is special: PyMongo raises it for malformed ObjectIds and its
        # repr includes the raw bad input, which could expose user-supplied data.
        ("InvalidId('bad object id') /uploads/file", ["InvalidId", "/uploads/"]),
    ],
)
def test_unhandled_exception_returns_generic_500_without_sensitive_info(
    authenticated_user,
    pipeline_payload,
    multipart_post,
    exception_message,
    forbidden_fragments,
):
    """Unhandled exceptions must return a generic message.

    Arguments:
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what creates the user and accepted terms the route requires
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        exception_message {str} -- one of the parametrized sensitive exception messages
        forbidden_fragments {list} -- substrings that must not appear in the error response
    """
    payload = pipeline_payload("oligoseq_mock_form_data.json")

    with patch("backend.routes.pipelines.create_context", side_effect=RuntimeError(exception_message)):
        response = multipart_post("/api/oligoseq", payload)

    assert response.status_code == 500
    data = response.get_json()
    assert "Something went wrong" in data["error"]
    assert_sanitized_error(response)
    for fragment in forbidden_fragments:
        assert fragment not in data["error"]


def test_unhandled_exception_is_logged(app, authenticated_user, pipeline_payload, multipart_post):
    """Internal details must still reach the server logs even though they are stripped from the response.

    Arguments:
        app {Flask} -- Flask application instance for patching the logger
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what creates the user and accepted terms the route requires
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
    """
    payload = pipeline_payload("oligoseq_mock_form_data.json")

    with (
        patch("backend.routes.pipelines.create_context", side_effect=ValueError("sensitive detail")),
        patch.object(app.logger, "error") as logger,
    ):
        response = multipart_post("/api/oligoseq", payload)

    assert response.status_code == 500
    assert logger.called
    call_args = str(logger.call_args)
    assert "ValueError" in call_args
    assert "sensitive detail" in call_args
