"""
Tests for PipelineRunner error handling.

Tests that PipelineRunner properly handles errors and returns
sanitized, user-friendly error messages.
"""

import os
import sys
from unittest.mock import patch

from flask_login import current_user

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from extensions import mongo

# Import conftest helpers - use relative import to avoid pytest import issues
import conftest

assert_error_sanitized = conftest.assert_error_sanitized
create_test_run = conftest.create_test_run


class TestPipelineRunnerErrors:
    """Test PipelineRunner error handling."""

    def test_invalid_run_id_empty_string(self, app, pipeline_runner, authenticated_user, form_data):
        """Test empty run ID returns user-friendly error."""
        with app.app_context():
            response = pipeline_runner.run(current_user, form_data, "")
            data = response[0].get_json()
            assert response[1] == 400
            assert data["error"] == "Invalid run identifier"

    def test_invalid_run_id_malformed(self, app, pipeline_runner, authenticated_user, form_data):
        """Test malformed run ID returns sanitized error."""
        with app.app_context():
            response = pipeline_runner.run(current_user, form_data, "invalid_id")
            data = response[0].get_json()
            assert response[1] == 400
            assert data["error"] == "Invalid run identifier"
            # Verify no raw error strings exposed
            assert_error_sanitized(data)

    def test_missing_session_id(self, app, pipeline_runner, session_user, form_data, run_id):
        """Test missing session ID returns user-friendly error."""
        with app.app_context():
            with app.test_request_context():
                with patch("flask.session.get", return_value=None):
                    response = pipeline_runner.run(current_user, form_data, str(run_id))
                    data = response[0].get_json()
                    assert response[1] == 400
                    assert data["error"] == "Invalid session configuration"

    def test_missing_user_directory(
        self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
    ):
        """Test missing user directory returns user-friendly error."""
        with app.app_context():
            # Create run in DB first
            create_test_run(run_id, user_id="test_user_id", status="pending")

            with patch("os.path.exists", return_value=False):
                with patch("flask.current_app.root_path", str(tmp_path)):
                    response = pipeline_runner.run(current_user, form_data, str(run_id))
                    data = response[0].get_json()
                    assert response[1] == 400
                    assert data["error"] == "User directory not found"
                    # Verify no file paths exposed
                    assert "/user_data/" not in data["error"]
                    assert "test_user_id" not in data["error"]

    def test_config_generation_error(
        self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
    ):
        """Test config generation errors return sanitized error."""
        with app.app_context():
            # Create run in DB
            create_test_run(run_id, user_id="test_user_id", status="pending")

            # Create user directory
            user_dir = tmp_path / "user_data" / "test_user_id"
            user_dir.mkdir(parents=True)

            with patch("yaml.dump", side_effect=Exception("YAML write error")):
                with patch("flask.current_app.root_path", str(tmp_path)):
                    response = pipeline_runner.run(current_user, form_data, str(run_id))
                    data = response[0].get_json()
                    assert response[1] == 500
                    assert "error" in data
                    # Verify error is sanitized
                    assert "YAML write error" not in data["error"]
                    assert data["error"] == "An error occurred while processing your request"

    def test_subprocess_failure(self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path):
        """Test subprocess failures return user-friendly error."""
        with app.app_context():
            # Create run in DB
            create_test_run(run_id, user_id="test_user_id", status="pending")

            # Create user directory and config file
            user_dir = tmp_path / "user_data" / "test_user_id"
            user_dir.mkdir(parents=True)
            config_file = user_dir / "config_test_pipeline.yaml"
            config_file.write_text("test config")

            with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
                with patch("flask.current_app.root_path", str(tmp_path)):
                    response = pipeline_runner.run(current_user, form_data, str(run_id))
                    data = response[0].get_json()
                    assert response[1] == 500
                    assert data["error"] == "Pipeline execution failed"
                    # Verify run status updated to error
                    run = mongo.db.runs.find_one({"_id": run_id})
                    assert run["status"] == "error"

    def test_temp_file_creation_error(self, app, pipeline_runner, authenticated_user, run_id, tmp_path):
        """Test temp file creation errors return sanitized error."""
        with app.app_context():
            # Create run in DB
            create_test_run(run_id, user_id="test_user_id", status="pending")

            # Create user directory
            user_dir = tmp_path / "user_data" / "test_user_id"
            user_dir.mkdir(parents=True)

            form_data_with_regions = {
                "file_regions": {"value": "gene1,gene2,gene3"},
                "test_param": {"value": "123"},
            }

            with patch("tempfile.NamedTemporaryFile", side_effect=PermissionError("Cannot create temp file")):
                with patch("flask.current_app.root_path", str(tmp_path)):
                    response = pipeline_runner.run(current_user, form_data_with_regions, str(run_id))
                    data = response[0].get_json()
                    assert response[1] == 500
                    assert (
                        data["error"]
                        == "Something went wrong while accessing files. Please try again or contact support if the problem persists."
                    )

    def test_cleanup_errors_logged_but_dont_fail(
        self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
    ):
        """Test cleanup errors are logged but don't fail the request."""
        with app.app_context():
            # Create run in DB
            create_test_run(run_id, user_id="test_user_id", status="pending")

            # Create user directory
            user_dir = tmp_path / "user_data" / "test_user_id"
            user_dir.mkdir(parents=True)
            config_file = user_dir / "config_test_pipeline.yaml"
            config_file.write_text("test config")

            with patch("subprocess.run") as mock_subprocess:
                mock_subprocess.return_value.returncode = 0
                with patch("os.remove", side_effect=Exception("Cleanup error")):
                    with patch("flask.current_app.logger.warning") as mock_logger:
                        with patch("flask.current_app.root_path", str(tmp_path)):
                            response = pipeline_runner.run(current_user, form_data, str(run_id))
                            # Should still succeed despite cleanup error
                            assert response[1] == 200
                            # Verify cleanup error was logged
                            mock_logger.assert_called()

    def test_catch_all_exception_handler(
        self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
    ):
        """Test catch-all exception handler works."""
        with app.app_context():
            # Create run in DB
            create_test_run(run_id, user_id="test_user_id", status="pending")

            # Create user directory
            user_dir = tmp_path / "user_data" / "test_user_id"
            user_dir.mkdir(parents=True)

            with patch("flask.current_app.root_path", str(tmp_path)):
                with patch.object(
                    pipeline_runner, "create_context", side_effect=Exception("Unexpected error")
                ):
                    response = pipeline_runner.run(current_user, form_data, str(run_id))
                    data = response[0].get_json()
                    assert response[1] == 500
                    assert "error" in data
                    # Verify error is sanitized
                    assert "Unexpected error" not in data["error"]
                    assert data["error"] == "An error occurred while processing your request"

    def test_no_raw_error_strings_exposed(
        self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
    ):
        """Test that no raw error strings are exposed."""
        with app.app_context():
            # Create run in DB
            create_test_run(run_id, user_id="test_user_id", status="pending")

            # Create user directory
            user_dir = tmp_path / "user_data" / "test_user_id"
            user_dir.mkdir(parents=True)

            # Test with various error types
            error_scenarios = [
                (ValueError("Session ID not found"), "Invalid session configuration"),
                (RuntimeError("/user_data/123/config.yaml missing"), "User directory not found"),
                (FileNotFoundError("/path/to/file.txt"), "Required file is missing"),
            ]

            for error, expected_message in error_scenarios:
                with patch("flask.current_app.root_path", str(tmp_path)):
                    with patch.object(pipeline_runner, "create_context", side_effect=error):
                        response = pipeline_runner.run(current_user, form_data, str(run_id))
                        data = response[0].get_json()
                        # Verify no raw error strings
                        assert str(error) not in data["error"]
                        assert data["error"] == expected_message
