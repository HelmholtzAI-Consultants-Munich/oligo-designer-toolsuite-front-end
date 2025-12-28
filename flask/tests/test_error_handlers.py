"""
Tests for error handler utility.

Tests that error messages are properly sanitized and user-friendly,
while ensuring sensitive information is never exposed.
"""

import os
import sys
from unittest.mock import patch

from bson.errors import InvalidId

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from routes.error_handlers import (
    create_user_error_response,
    sanitize_error_message_for_storage,
)


class TestErrorHandlerUtility:
    """Test error handler utility functions."""

    def test_invalid_id_exception(self, app):
        """Test InvalidId exception returns user-friendly message."""
        with app.app_context():
            response, status_code = create_user_error_response(InvalidId("invalid"), "submission")
            data = response.get_json()
            assert data["error"] == "Invalid run identifier"
            assert status_code == 400

    def test_value_error_session(self, app):
        """Test ValueError with session returns user-friendly message."""
        with app.app_context():
            error = ValueError("Anonymous session ID not found in session")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "Invalid session configuration"
            assert status_code == 400

    def test_value_error_directory(self, app):
        """Test ValueError with directory returns user-friendly message."""
        with app.app_context():
            error = ValueError("user_dir not found")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "User directory not found"
            assert status_code == 400

    def test_value_error_generic(self, app):
        """Test generic ValueError returns user-friendly message."""
        with app.app_context():
            error = ValueError("Some validation error")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "Invalid input provided"
            assert status_code == 400

    def test_runtime_error_directory(self, app):
        """Test RuntimeError with directory returns user-friendly message."""
        with app.app_context():
            error = RuntimeError("Directory /user_data/123 not found")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "User directory not found"
            assert status_code == 400

    def test_runtime_error_pipeline(self, app):
        """Test RuntimeError with pipeline returns user-friendly message."""
        with app.app_context():
            error = RuntimeError("Pipeline failed: subprocess error")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "Pipeline execution failed"
            assert status_code == 500

    def test_runtime_error_generic(self, app):
        """Test generic RuntimeError returns user-friendly message."""
        with app.app_context():
            error = RuntimeError("Some runtime error")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "An error occurred during pipeline execution"
            assert status_code == 500

    def test_file_not_found_error(self, app):
        """Test FileNotFoundError returns user-friendly message."""
        with app.app_context():
            error = FileNotFoundError("/path/to/file.txt")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "Required file is missing"
            assert status_code == 404

    def test_permission_error(self, app):
        """Test PermissionError returns user-friendly message (internal server error)."""
        with app.app_context():
            error = PermissionError("Permission denied")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert (
                data["error"]
                == "Something went wrong while accessing files. Please try again or contact support if the problem persists."
            )
            assert status_code == 500

    def test_key_error(self, app):
        """Test KeyError returns user-friendly message."""
        with app.app_context():
            error = KeyError("missing_key")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "Invalid configuration: Missing required parameter"
            assert status_code == 400

    def test_generic_exception(self, app):
        """Test generic exception returns user-friendly message."""
        with app.app_context():
            error = Exception("Some unexpected error")
            response, status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert data["error"] == "An error occurred while processing your request"
            assert status_code == 500

    def test_sensitive_patterns_sanitized(self, app):
        """Test that sensitive patterns are sanitized."""
        with app.app_context():
            # Test file path sanitization
            error = Exception("Error in /user_data/123/config.yaml")
            response, _status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert "/user_data/" not in data["error"]
            assert "config.yaml" not in data["error"]
            assert data["error"] == "An error occurred while processing your request"

            # Test traceback sanitization
            error2 = Exception("Traceback (most recent call last):")
            response2, _ = create_user_error_response(error2, "submission")
            data2 = response2.get_json()
            assert "Traceback" not in data2["error"]
            assert "traceback" not in data2["error"].lower()

    def test_long_error_message_truncated(self, app):
        """Test that very long error messages are sanitized."""
        with app.app_context():
            long_message = "A" * 300  # Very long error message
            error = Exception(long_message)
            response, _status_code = create_user_error_response(error, "submission")
            data = response.get_json()
            assert len(data["error"]) <= 200
            assert data["error"] == "An error occurred while processing your request"

    def test_error_logged_server_side(self, app):
        """Test that full error details are logged server-side."""
        with app.app_context():
            with patch("flask.current_app.logger.error") as mock_logger:
                error = ValueError("Test error with sensitive info")
                create_user_error_response(error, "submission")

                # Verify logger was called
                assert mock_logger.called
                # Verify full error details are in log
                call_args = mock_logger.call_args
                assert "Test error with sensitive info" in str(call_args)

    def test_sanitize_error_message_for_storage(self, app):
        """Test sanitize_error_message_for_storage returns same messages."""
        with app.app_context():
            error = ValueError("Invalid session configuration")
            sanitized = sanitize_error_message_for_storage(error)
            assert sanitized == "Invalid session configuration"

            error2 = RuntimeError("Pipeline execution failed")
            sanitized2 = sanitize_error_message_for_storage(error2)
            assert sanitized2 == "Pipeline execution failed"

    def test_error_type_parameter(self, app):
        """Test that error_type parameter is logged but doesn't affect message."""
        with app.app_context():
            with patch("flask.current_app.logger.error") as mock_logger:
                error = ValueError("Test error")

                # Both should return same message
                response1, _ = create_user_error_response(error, "submission")
                response2, _ = create_user_error_response(error, "run")
                assert response1.get_json()["error"] == response2.get_json()["error"]

                # But error_type should be logged (2 calls from above)
                assert mock_logger.call_count == 2
