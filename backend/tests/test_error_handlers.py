"""
Tests for error handler registration.

Tests that:
- HTTPException (abort) errors return proper JSON with the description.
- Genomic endpoints get a special response envelope.
- Unexpected (non-HTTP) exceptions return a generic 500 with no sensitive info.
"""

import json
import os
from unittest.mock import patch

import pytest


@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for oligoseq API
    form_path = os.path.join(os.path.dirname(__file__), "data/oligoseq_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    form["runid"] = str(run_id)
    return form


class TestHTTPExceptionHandler:
    """Test that abort() errors return the description as JSON."""

    def test_abort_400_returns_description(self, client):
        """Pipeline route with invalid name triggers abort(400)."""
        response = client.post("/api/nonexistent_pipeline", json={"formdata": {}, "runid": "abc"})
        assert response.status_code == 400
        data = response.get_json()
        assert "error" in data
        assert "does not exist" in data["error"]

    def test_abort_404_for_unknown_url(self, client):
        """Hitting a completely unknown URL returns 404 JSON."""
        response = client.get("/api/this/does/not/exist")
        assert response.status_code == 404
        data = response.get_json()
        assert "error" in data

    def test_abort_415_missing_json(self, client, authenticated_user):
        """Pipeline route with no JSON body triggers abort(415)."""
        response = client.post("/api/merfish", content_type="text/plain", data="not json")
        assert response.status_code == 415
        data = response.get_json()
        assert data["error"] == "Expected a Multipart form data with payload JSON field"

    def test_abort_returns_json_with_error_key(self, client):
        """All abort responses have a consistent {"error": "..."} shape."""
        response = client.get("/api/runs/000000000000000000000000/files")
        # Anonymous user without session -> triggers abort in route helpers
        data = response.get_json()
        assert "error" in data
        assert isinstance(data["error"], str)


class TestGenericExceptionHandler:
    """Test that unexpected exceptions return a generic 500 with no sensitive info."""

    def test_unhandled_exception_returns_generic_500(self, client, authenticated_user, dummy_form):
        """An unexpected exception is caught and returns a safe generic message."""
        with patch(
            "backend.routes.pipelines.validate_name",
            side_effect=RuntimeError("secret internal details /user_data/abc123"),
        ):
            response = client.post("/api/oligoseq", json=dummy_form)
            assert response.status_code == 500
            data = response.get_json()
            assert "Something went wrong" in data["error"]
            # Sensitive info must not leak
            assert "/user_data/" not in data["error"]
            assert "secret" not in data["error"]

    def test_unhandled_exception_is_logged(self, app, client, authenticated_user, dummy_form):
        """Full exception details are logged server-side for debugging."""
        with patch(
            "backend.routes.pipelines.validate_name",
            side_effect=ValueError("sensitive error details"),
        ):
            with patch.object(app.logger, "error") as mock_logger:
                client.post("/api/oligoseq", json=dummy_form)
                assert mock_logger.called
                call_args = str(mock_logger.call_args)
                assert "sensitive error details" in call_args
                assert "ValueError" in call_args

    def test_file_paths_never_exposed(self, client, authenticated_user, dummy_form):
        """Internal file paths are never returned to the client."""
        with patch(
            "backend.routes.pipelines.validate_name",
            side_effect=Exception("Error in /user_data/123/config.yaml"),
        ):
            response = client.post("/api/oligoseq", json=dummy_form)
            data = response.get_json()
            assert "/user_data/" not in data["error"]
            assert "config.yaml" not in data["error"]

    def test_traceback_never_exposed(self, client, authenticated_user, dummy_form):
        """Stack traces are never returned to the client."""
        with patch(
            "backend.routes.pipelines.validate_name",
            side_effect=Exception("Traceback (most recent call last):"),
        ):
            response = client.post("/api/oligoseq", json=dummy_form)
            data = response.get_json()
            assert "Traceback" not in data["error"]
