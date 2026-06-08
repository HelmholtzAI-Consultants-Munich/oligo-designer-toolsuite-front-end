"""
Note: Currently disabled because we don't test the Celery worker yet.

Tests for PipelineRunner error handling.

Tests that PipelineRunner properly handles errors and returns
sanitized, user-friendly error messages.
"""

# import os
# import sys
# from unittest.mock import patch

# from flask_login import current_user

# sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
# from extensions import db

# # Import conftest helpers - use relative import to avoid pytest import issues
# import conftest

# assert_error_sanitized = conftest.assert_error_sanitized
# create_test_run = conftest.create_test_run


# class TestPipelineRunnerErrors:
#     """Test PipelineRunner error handling."""

#     def _assert_pipeline_runner_error(
#         self, response, expected_status_code, expected_error_message, check_sanitized=False
#     ):
#         """
#         Helper function to assert pipeline runner error response.

#         Args:
#             response: Tuple from pipeline_runner.run() - (response_object, status_code)
#             expected_status_code: Expected HTTP status code
#             expected_error_message: Expected error message
#             check_sanitized: Whether to also check that error is sanitized (default: False)
#         """
#         data = response[0].get_json()
#         assert response[1] == expected_status_code
#         assert "error" in data
#         assert data["error"] == expected_error_message
#         if check_sanitized:
#             assert_error_sanitized(data)

#     def test_invalid_run_id_empty_string(self, app, pipeline_runner, authenticated_user, form_data):
#         """Test empty run ID returns user-friendly error."""
#         with app.app_context():
#             response = pipeline_runner.run(current_user, form_data, "")
#             self._assert_pipeline_runner_error(
#                 response, 400, "The run ID you provided is not valid. Please check and try again."
#             )

#     def test_invalid_run_id_malformed(self, app, pipeline_runner, authenticated_user, form_data):
#         """Test malformed run ID returns sanitized error."""
#         with app.app_context():
#             response = pipeline_runner.run(current_user, form_data, "invalid_id")
#             self._assert_pipeline_runner_error(
#                 response,
#                 400,
#                 "The run ID you provided is not valid. Please check and try again.",
#                 check_sanitized=True,
#             )

#     def test_missing_session_id(self, app, pipeline_runner, session_user, form_data, run_id):
#         """Test missing session ID returns user-friendly error."""
#         with app.app_context():
#             with app.test_request_context():
#                 with patch("flask.session.get", return_value=None):
#                     response = pipeline_runner.run(current_user, form_data, str(run_id))
#                     self._assert_pipeline_runner_error(
#                         response, 400, "Your session has expired. Please refresh the page and try again."
#                     )

#     def test_missing_user_directory(
#         self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
#     ):
#         """Test missing user directory returns user-friendly error."""
#         with app.app_context():
#             # Create run in DB first
#             create_test_run(run_id, user_id="test_user_id", status="pending")

#             with patch("os.path.exists", return_value=False):
#                 with patch("flask.current_app.root_path", str(tmp_path)):
#                     response = pipeline_runner.run(current_user, form_data, str(run_id))
#                     self._assert_pipeline_runner_error(
#                         response,
#                         400,
#                         "Unable to access your data directory. Please try again or contact support.",
#                     )
#                     # Verify no file paths exposed
#                     data = response[0].get_json()
#                     assert "/user_data/" not in data["error"]
#                     assert "test_user_id" not in data["error"]

#     def test_config_generation_error(
#         self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
#     ):
#         """Test config generation errors return sanitized error."""
#         with app.app_context():
#             # Create run in DB
#             create_test_run(run_id, user_id="test_user_id", status="pending")

#             # Create user directory
#             user_dir = tmp_path / "user_data" / "test_user_id"
#             user_dir.mkdir(parents=True)

#             with patch("yaml.dump", side_effect=Exception("YAML write error")):
#                 with patch("flask.current_app.root_path", str(tmp_path)):
#                     response = pipeline_runner.run(current_user, form_data, str(run_id))
#                     self._assert_pipeline_runner_error(
#                         response,
#                         500,
#                         "Something went wrong. Please try again or contact support if the problem persists.",
#                     )

#     def test_subprocess_failure(self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path):
#         """Test subprocess failures return user-friendly error."""
#         with app.app_context():
#             # Create run in DB
#             create_test_run(run_id, user_id="test_user_id", status="pending")

#             # Create user directory and config file
#             user_dir = tmp_path / "user_data" / "test_user_id"
#             user_dir.mkdir(parents=True)
#             config_file = user_dir / "config_test_pipeline.yaml"
#             config_file.write_text("test config")

#             with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
#                 with patch("flask.current_app.root_path", str(tmp_path)):
#                     response = pipeline_runner.run(current_user, form_data, str(run_id))
#                     self._assert_pipeline_runner_error(
#                         response,
#                         500,
#                         "The pipeline failed to execute. Please check your input and try again.",
#                     )
#                     # Verify run status updated to error
#                     run = db.runs.find_one({"_id": run_id})
#                     assert run["status"] == "error"

#     def test_temp_file_creation_error(self, app, pipeline_runner, authenticated_user, run_id, tmp_path):
#         """Test temp file creation errors return sanitized error."""
#         with app.app_context():
#             # Create run in DB
#             create_test_run(run_id, user_id="test_user_id", status="pending")

#             # Create user directory
#             user_dir = tmp_path / "user_data" / "test_user_id"
#             user_dir.mkdir(parents=True)

#             form_data_with_regions = {
#                 "file_regions": "gene1,gene2,gene3",
#                 "test_param": "123",
#             }

#             with patch("tempfile.NamedTemporaryFile", side_effect=PermissionError("Cannot create temp file")):
#                 with patch("flask.current_app.root_path", str(tmp_path)):
#                     response = pipeline_runner.run(current_user, form_data_with_regions, str(run_id))
#                     self._assert_pipeline_runner_error(
#                         response,
#                         500,
#                         "Something went wrong while accessing files. Please try again or contact support if the problem persists.",
#                     )

#     def test_cleanup_errors_logged_but_dont_fail(
#         self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
#     ):
#         """Test cleanup errors are logged but don't fail the request."""
#         with app.app_context():
#             # Create run in DB
#             create_test_run(run_id, user_id="test_user_id", status="pending")

#             # Create user directory
#             user_dir = tmp_path / "user_data" / "test_user_id"
#             user_dir.mkdir(parents=True)
#             config_file = user_dir / "config_test_pipeline.yaml"
#             config_file.write_text("test config")

#             with patch("subprocess.run") as mock_subprocess:
#                 mock_subprocess.return_value.returncode = 0
#                 with patch("os.remove", side_effect=Exception("Cleanup error")):
#                     with patch("flask.current_app.logger.warning") as mock_logger:
#                         with patch("flask.current_app.root_path", str(tmp_path)):
#                             response = pipeline_runner.run(current_user, form_data, str(run_id))
#                             # Should still succeed despite cleanup error
#                             assert response[1] == 200
#                             # Verify cleanup error was logged
#                             mock_logger.assert_called()

#     def test_catch_all_exception_handler(
#         self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
#     ):
#         """Test catch-all exception handler works."""
#         with app.app_context():
#             # Create run in DB
#             create_test_run(run_id, user_id="test_user_id", status="pending")

#             # Create user directory
#             user_dir = tmp_path / "user_data" / "test_user_id"
#             user_dir.mkdir(parents=True)

#             with patch("flask.current_app.root_path", str(tmp_path)):
#                 with patch.object(
#                     pipeline_runner, "create_context", side_effect=Exception("Unexpected error")
#                 ):
#                     response = pipeline_runner.run(current_user, form_data, str(run_id))
#                     self._assert_pipeline_runner_error(
#                         response,
#                         500,
#                         "Something went wrong. Please try again or contact support if the problem persists.",
#                     )

#     def test_no_raw_error_strings_exposed(
#         self, app, pipeline_runner, authenticated_user, form_data, run_id, tmp_path
#     ):
#         """Test that no raw error strings are exposed."""
#         with app.app_context():
#             # Create run in DB
#             create_test_run(run_id, user_id="test_user_id", status="pending")

#             # Create user directory
#             user_dir = tmp_path / "user_data" / "test_user_id"
#             user_dir.mkdir(parents=True)

#             # Test with various error types
#             error_scenarios = [
#                 (
#                     ValueError("Session ID not found"),
#                     "Your session has expired. Please refresh the page and try again.",
#                 ),
#                 (
#                     RuntimeError("/user_data/123/config.yaml missing"),
#                     "Unable to access your data directory. Please try again or contact support.",
#                 ),
#                 (
#                     FileNotFoundError("/path/to/file.txt"),
#                     "A required file is missing. Please check your input files and try again.",
#                 ),
#             ]

#             for error, expected_message in error_scenarios:
#                 with patch("flask.current_app.root_path", str(tmp_path)):
#                     with patch.object(pipeline_runner, "create_context", side_effect=error):
#                         response = pipeline_runner.run(current_user, form_data, str(run_id))
#                         data = response[0].get_json()
#                         # Verify no raw error strings
#                         assert str(error) not in data["error"]
#                         assert data["error"] == expected_message
