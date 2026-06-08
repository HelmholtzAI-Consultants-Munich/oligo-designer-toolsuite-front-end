"""Central Flask error-handler tests."""

from unittest.mock import patch

import pytest

from backend.tests.conftest import assert_sanitized_error


def test_http_exception_returns_json_error(client, authenticated_user):
    response = client.post("/api/oligoseq", content_type="text/plain", data="not json")

    assert response.status_code == 400
    assert response.get_json() == {"error": "Expected a Multipart form data with payload JSON field"}


def test_404_unknown_route_returns_json_error(client):
    response = client.get("/api/does/not/exist")

    assert response.status_code == 404
    assert "error" in response.get_json()


@pytest.mark.parametrize(
    ("exception_message", "forbidden_fragments"),
    [
        ("secret internal details /user_data/abc123", ["secret", "/user_data/"]),
        ("Error in /user_data/123/config.yaml", ["/user_data/", "config.yaml"]),
        ("Traceback (most recent call last):", ["Traceback"]),
        ("InvalidId('bad object id') /uploads/file", ["InvalidId", "/uploads/"]),
    ],
)
def test_unhandled_exception_returns_generic_500_without_sensitive_info(
    client,
    authenticated_user,
    pipeline_payload,
    multipart_post,
    exception_message,
    forbidden_fragments,
):
    """Unhandled exceptions return a generic 500 without leaking internal details."""
    payload = pipeline_payload("oligoseq_mock_form_data.json")

    with patch("backend.routes.pipelines.create_context", side_effect=RuntimeError(exception_message)):
        response = multipart_post("/api/oligoseq", payload)

    assert response.status_code == 500
    data = response.get_json()
    assert "Something went wrong" in data["error"]
    assert_sanitized_error(response)
    for fragment in forbidden_fragments:
        assert fragment not in data["error"]


def test_unhandled_exception_is_logged(app, client, authenticated_user, pipeline_payload, multipart_post):
    """Full exception information is still logged server-side for diagnosis."""
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
