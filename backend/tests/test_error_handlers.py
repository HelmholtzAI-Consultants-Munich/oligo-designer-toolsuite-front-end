"""
Tests for error handler registration.

Tests that:
- HTTPException (abort) errors return proper JSON with the description.
- Genomic endpoints get a special response envelope.
- Unexpected (non-HTTP) exceptions return a generic 500 with no sensitive info.
"""

from unittest.mock import patch


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
        assert data["error"] == "Expected JSON"

    def test_abort_returns_json_with_error_key(self, client):
        """All abort responses have a consistent {"error": "..."} shape."""
        response = client.get("/api/runs/000000000000000000000000/files")
        # Anonymous user without session -> triggers abort in route helpers
        data = response.get_json()
        assert "error" in data
        assert isinstance(data["error"], str)


class TestGenomicEndpointFormatting:
    """Test that genomic endpoints get the special response envelope."""

    def test_genomic_abort_returns_special_envelope(self, client, authenticated_user):
        """Genomic route validation error returns {status, message, error}."""
        response = client.post("/api/genomic/cascaded/custom", json={"source": "Invalid"})
        assert response.status_code == 400
        data = response.get_json()
        assert data["status"] == "error"
        assert "Invalid input" in data["message"]
        assert "Invalid input" in data["error"]

    def test_genomic_unhandled_exception_returns_special_envelope(self, client, authenticated_user):
        """Unhandled exception on a genomic endpoint still uses the genomic envelope."""
        with patch(
            "backend.routes.genomic._validate_genomic_form_data",
            side_effect=RuntimeError("unexpected"),
        ):
            response = client.post("/api/genomic/cascaded/custom", json={"source": "NCBI"})
            assert response.status_code == 500
            data = response.get_json()
            assert data["status"] == "error"
            assert "error" in data
            assert "message" in data

    def test_non_genomic_abort_returns_standard_envelope(self, client, authenticated_user):
        """Non-genomic route errors do NOT have the {status, message} wrapper."""
        response = client.post("/api/merfish", content_type="text/plain", data="not json")
        assert response.status_code == 415
        data = response.get_json()
        assert data == {"error": "Expected JSON"}
        assert "status" not in data
        assert "message" not in data


class TestGenericExceptionHandler:
    """Test that unexpected exceptions return a generic 500 with no sensitive info."""

    def test_unhandled_exception_returns_generic_500(self, client, authenticated_user):
        """An unexpected exception is caught and returns a safe generic message."""
        with patch(
            "backend.routes.genomic._validate_genomic_form_data",
            side_effect=RuntimeError("secret internal details /user_data/abc123"),
        ):
            response = client.post("/api/genomic/cascaded/custom", json={"source": "NCBI"})
            assert response.status_code == 500
            data = response.get_json()
            assert "Something went wrong" in data["error"]
            # Sensitive info must not leak
            assert "/user_data/" not in data["error"]
            assert "secret" not in data["error"]

    def test_unhandled_exception_is_logged(self, app, client, authenticated_user):
        """Full exception details are logged server-side for debugging."""
        with patch(
            "backend.routes.genomic._validate_genomic_form_data",
            side_effect=ValueError("sensitive error details"),
        ):
            with patch.object(app.logger, "error") as mock_logger:
                client.post("/api/genomic/cascaded/custom", json={"source": "NCBI"})
                assert mock_logger.called
                call_args = str(mock_logger.call_args)
                assert "sensitive error details" in call_args
                assert "ValueError" in call_args

    def test_file_paths_never_exposed(self, client, authenticated_user):
        """Internal file paths are never returned to the client."""
        with patch(
            "backend.routes.genomic._validate_genomic_form_data",
            side_effect=Exception("Error in /user_data/123/config.yaml"),
        ):
            response = client.post("/api/genomic/cascaded/ncbi", json={"source": "NCBI"})
            data = response.get_json()
            assert "/user_data/" not in data["error"]
            assert "config.yaml" not in data["error"]

    def test_traceback_never_exposed(self, client, authenticated_user):
        """Stack traces are never returned to the client."""
        with patch(
            "backend.routes.genomic._validate_genomic_form_data",
            side_effect=Exception("Traceback (most recent call last):"),
        ):
            response = client.post("/api/genomic/cascaded/ncbi", json={"source": "NCBI"})
            data = response.get_json()
            assert "Traceback" not in data["error"]
