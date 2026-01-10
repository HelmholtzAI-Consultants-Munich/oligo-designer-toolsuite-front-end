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
)


class TestErrorHandlerUtility:
    """Test error handler utility functions."""

    def _assert_error_response(self, app, exception, expected_error_message, expected_status_code=None):
        """
        Helper method to test error response.

        Args:
            app: Flask app fixture
            exception: Exception to test
            expected_error_message: Expected error message in response
            expected_status_code: Expected HTTP status code (optional)

        Returns:
            Tuple of (response, data, status_code) for additional assertions if needed
        """
        with app.app_context():
            response, status_code = create_user_error_response(exception, "submission")
            data = response.get_json()
            assert data["error"] == expected_error_message
            if expected_status_code is not None:
                assert status_code == expected_status_code
            return response, data, status_code

    def test_invalid_id_exception(self, app):
        """Test InvalidId exception returns user-friendly message."""
        self._assert_error_response(
            app,
            InvalidId("invalid"),
            "The run ID you provided is not valid. Please check and try again.",
            400,
        )

    def test_value_error_session(self, app):
        """Test ValueError with session returns user-friendly message."""
        error = ValueError("Anonymous session ID not found in session")
        self._assert_error_response(
            app, error, "Your session has expired. Please refresh the page and try again.", 400
        )

    def test_value_error_directory(self, app):
        """Test ValueError with directory returns user-friendly message."""
        error = ValueError("user_dir not found")
        self._assert_error_response(
            app, error, "Unable to access your data directory. Please try again or contact support.", 400
        )

    def test_value_error_generic(self, app):
        """Test generic ValueError returns user-friendly message."""
        error = ValueError("Some validation error")
        self._assert_error_response(
            app,
            error,
            "The information you provided is not valid. Please check your input and try again.",
            400,
        )

    def test_runtime_error_directory(self, app):
        """Test RuntimeError with directory returns user-friendly message."""
        error = RuntimeError("Directory /user_data/123 not found")
        self._assert_error_response(
            app, error, "Unable to access your data directory. Please try again or contact support.", 400
        )

    def test_runtime_error_pipeline(self, app):
        """Test RuntimeError with pipeline returns user-friendly message."""
        error = RuntimeError("Pipeline failed: subprocess error")
        self._assert_error_response(
            app, error, "The pipeline failed to execute. Please check your input and try again.", 500
        )

    def test_runtime_error_generic(self, app):
        """Test generic RuntimeError returns user-friendly message."""
        error = RuntimeError("Some runtime error")
        self._assert_error_response(
            app, error, "An error occurred while running the pipeline. Please try again.", 500
        )

    def test_file_not_found_error(self, app):
        """Test FileNotFoundError returns user-friendly message."""
        error = FileNotFoundError("/path/to/file.txt")
        self._assert_error_response(
            app, error, "A required file is missing. Please check your input files and try again.", 404
        )

    def test_permission_error(self, app):
        """Test PermissionError returns user-friendly message (internal server error)."""
        error = PermissionError("Permission denied")
        self._assert_error_response(
            app,
            error,
            "Something went wrong while accessing files. Please try again or contact support if the problem persists.",
            500,
        )

    def test_key_error(self, app):
        """Test KeyError returns user-friendly message."""
        error = KeyError("missing_key")
        self._assert_error_response(
            app, error, "Some required information is missing. Please check your input and try again.", 400
        )

    def test_generic_exception(self, app):
        """Test generic exception returns user-friendly message."""
        error = Exception("Some unexpected error")
        self._assert_error_response(
            app,
            error,
            "Something went wrong. Please try again or contact support if the problem persists.",
            500,
        )

    def test_file_path_sanitized(self, app):
        """Test that file paths are sanitized from error messages."""
        error = Exception("Error in /user_data/123/config.yaml")
        _, data, _ = self._assert_error_response(
            app, error, "An error occurred while processing your request"
        )
        assert "/user_data/" not in data["error"]
        assert "config.yaml" not in data["error"]

    def test_traceback_sanitized(self, app):
        """Test that traceback information is sanitized from error messages."""
        error = Exception("Traceback (most recent call last):")
        _, data, _ = self._assert_error_response(
            app, error, "An error occurred while processing your request"
        )
        assert "Traceback" not in data["error"]
        assert "traceback" not in data["error"].lower()

    def test_long_error_message_truncated(self, app):
        """Test that very long error messages are sanitized."""
        long_message = "A" * 300  # Very long error message
        error = Exception(long_message)
        _, data, _ = self._assert_error_response(
            app, error, "An error occurred while processing your request"
        )
        assert len(data["error"]) <= 200

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
