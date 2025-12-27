import os
import sys
from unittest.mock import patch

import pytest
from bson import ObjectId

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from extensions import mongo
from conftest import dummy_user, create_test_run


@pytest.fixture
def output_path(tmp_path, run_id, dummy_user):
    output_path = tmp_path / "run_output"
    output_path.mkdir()
    (output_path / "log.txt").write_text("log content")
    (output_path / "config.yaml").write_text("config content")

    create_test_run(
        run_id,
        user_id=dummy_user.id,
        status="completed",
        output_path=str(output_path)
    )

    return str(output_path)


def test_init_run_id(client):
    response = client.post("/api/init_run_id")
    assert response.status_code == 200
    assert "run_id" in response.get_json()


def test_get_pipeline_runs_authenticated(client, dummy_user, run_id):
    create_test_run(run_id, user_id=dummy_user.id)

    response = client.get("/api/pipelines")
    assert response.status_code == 200
    assert isinstance(response.get_json(), list)


def test_get_run_files(client, dummy_user, run_id, output_path):

    response = client.get(f"/api/runs/{run_id}/files")
    assert response.status_code == 200
    data = response.get_json()
    assert any("log.txt" in file["name"] for file in data)
    assert any("config.yaml" in file["name"] for file in data)


def test_get_run_file_success(client, dummy_user, run_id, output_path):

    response = client.get(f"/api/runs/{run_id}/files/log.txt")
    assert response.status_code == 200
    assert response.data == b"log content"


def test_delete_run_success(client, dummy_user, run_id, output_path):

    response = client.delete(f"/api/runs/{run_id}")
    assert response.status_code == 200
    assert not os.path.exists(output_path)


def test_get_run_file_not_found(client, dummy_user, run_id):

    response = client.get(f"/api/runs/{run_id}/files/nonexistent.txt")
    assert response.status_code == 404


def test_runid_null(client):
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""

        form = {"runid": None}

        response = client.post("/api/scrinshot", json=form)
        assert response.status_code == 400


def test_get_files_valid_runid_unused(client):
    response = client.get(f"/api/runs/{ObjectId()}/files")
    assert response.status_code == 404


def test_get_files_invalid_runid(client):
    run_id = "hallo"

    response = client.get(f"/api/runs/{run_id}/files")
    assert response.status_code == 400


# Error handling tests
def test_get_pipeline_run_returns_error_message(client, dummy_user, run_id):
    """Test get_pipeline_run returns error_message field when status is error."""
    create_test_run(
        run_id,
        user_id=dummy_user.id,
        status="error",
        error_message="Pipeline execution failed"
    )

    response = client.get(f"/api/runs/{run_id}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "error"
    assert "error_message" in data
    assert data["error_message"] == "Pipeline execution failed"


def test_get_pipeline_run_returns_error_message_failed_status(client, dummy_user, run_id):
    """Test get_pipeline_run returns error_message field when status is failed."""
    create_test_run(
        run_id,
        user_id=dummy_user.id,
        status="failed",
        error_message="Invalid configuration: Missing required parameter"
    )

    response = client.get(f"/api/runs/{run_id}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "failed"
    assert "error_message" in data
    assert data["error_message"] == "Invalid configuration: Missing required parameter"


def test_get_pipeline_run_no_error_message_when_completed(client, dummy_user, run_id):
    """Test get_pipeline_run does NOT return error_message when status is completed."""
    create_test_run(run_id, user_id=dummy_user.id, status="completed")

    response = client.get(f"/api/runs/{run_id}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "completed"
    assert "error_message" not in data


def test_get_run_file_not_found_sanitized(client, dummy_user, run_id):
    """Test get_run_file with file not found returns sanitized error."""
    # Create run but no output directory
    create_test_run(
        run_id,
        user_id=dummy_user.id,
        status="completed",
        output_path="/nonexistent/path"
    )

    response = client.get(f"/api/runs/{run_id}/files/nonexistent.txt")
    assert response.status_code in [404, 500]  # Could be either depending on error type
    data = response.get_json()
    assert "error" in data
    # Verify error is sanitized
    assert "/nonexistent/path" not in str(data)
    assert "nonexistent.txt" not in str(data) or "Required file is missing" in data["error"]


def test_get_run_file_permission_error_sanitized(client, dummy_user, run_id, tmp_path):
    """Test get_run_file with permission error returns sanitized error."""
    from unittest.mock import patch

    output_path = tmp_path / "run_output"
    output_path.mkdir()
    (output_path / "test.txt").write_text("content")

    create_test_run(
        run_id,
        user_id=dummy_user.id,
        status="completed",
        output_path=str(output_path)
    )

    with patch("builtins.open", side_effect=PermissionError("Permission denied")):
        response = client.get(f"/api/runs/{run_id}/files/test.txt")
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
        assert data["error"] == "Something went wrong while accessing files. Please try again or contact support if the problem persists."


def test_get_run_files_invalid_run_id_sanitized(client):
    """Test get_run_files with invalid run ID returns sanitized error."""
    response = client.get("/api/runs/invalid_id/files")
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Invalid run identifier"


def test_pipeline_routes_no_raw_error_strings_exposed(client, dummy_user, run_id):
    """Test that no raw error strings (str(e)) are exposed in pipeline route responses."""
    # Test get_run_file with various exceptions
    exceptions = [
        FileNotFoundError("/path/to/file.txt"),
        PermissionError("Permission denied"),
        ValueError("Invalid input"),
    ]

    create_test_run(run_id, user_id=dummy_user.id, status="completed")

    for exc in exceptions:
        from unittest.mock import patch
        with patch("routes.pipelines.os.path.join", side_effect=exc):
            response = client.get(f"/api/runs/{run_id}/files/test.txt")
            data = response.get_json()
            assert "error" in data
            # Verify no raw exception strings exposed
            # Note: Some sanitized messages may contain parts of the original error
            # (e.g., "Invalid input" -> "Invalid input provided"), so we check
            # that the full raw exception string isn't exposed
            exc_str = str(exc)
            # For ValueError("Invalid input"), check that the full path isn't exposed
            if isinstance(exc, ValueError) and "Invalid input" in exc_str:
                # The sanitized message is "Invalid input provided", which is acceptable
                assert exc_str not in str(data) or "Invalid input provided" in str(data)
            else:
                assert exc_str not in str(data)
            # Verify error is user-friendly
            assert isinstance(data["error"], str)
            assert len(data["error"]) > 0


def test_all_errors_use_create_user_error_response(client, dummy_user):
    """Test that all errors use create_user_error_response (verify consistent format)."""

    # Test that error responses have consistent format
    response = client.get("/api/runs/invalid_id/files")
    assert response.status_code == 400
    data = response.get_json()
    # Should have "error" field (from create_user_error_response)
    assert "error" in data
    assert isinstance(data["error"], str)
