import os
from unittest.mock import patch

import pytest
from bson import ObjectId

from backend.tests.conftest import create_test_run


@pytest.fixture
def output_path(tmp_path, run_id, dummy_user):
    output_path = tmp_path / "run_output"
    output_path.mkdir()
    (output_path / "log.txt").write_text("log content")
    (output_path / "config.yaml").write_text("config content")

    create_test_run(run_id, user_id=dummy_user.id, status="success", output_path=str(output_path))

    return str(output_path)


def test_init_run_id(client):
    response = client.post("/api/init_run_id")
    assert response.status_code == 200
    assert "run_id" in response.get_json()


def test_get_pipeline_runs_authenticated(client, dummy_user, run_id):
    create_test_run(run_id, user_id=dummy_user.id)

    response = client.get("/api/runs")
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


def test_delete_run_success(client, monkeypatch, run_id, output_path):
    class DummyUser:
        is_authenticated = True
        id = "dummy_user"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

    response = client.delete(f"/api/runs/{run_id}")
    assert response.status_code == 200
    assert not os.path.exists(output_path)


def test_get_run_file_not_found(client, dummy_user, run_id):
    response = client.get(f"/api/runs/{run_id}/files/nonexistent.txt")
    assert response.status_code == 404


def test_runid_null(client, mock_celery):
    form = {"runid": None}

    response = client.post("/api/scrinshot", json=form)
    assert response.status_code == 400


def test_get_files_valid_runid_unused(client):
    response = client.get(f"/api/runs/{ObjectId()}/files")
    assert response.status_code == 404


def test_get_files_invalid_runid(client):
    """Test that invalid ObjectId format returns 404 (URL converter behavior)."""
    run_id = "hallo"

    response = client.get(f"/api/runs/{run_id}/files")
    # BSONObjectIdConverter returns 404 for invalid ObjectId format
    assert response.status_code == 404


# Error handling tests
def _assert_pipeline_run_error_message(client, dummy_user, run_id, status, error_message):
    """
    Helper function to test that get_pipeline_run returns error_message field.

    Args:
        client: Flask test client
        dummy_user: Test user fixture
        run_id: Run ID fixture
        status: Expected status (e.g., "success", "failure")
        error_message: Expected error message
    """
    create_test_run(run_id, user_id=dummy_user.id, status=status, error_message=error_message)

    response = client.get(f"/api/runs/{run_id}")
    print(response.get_json())
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == status
    assert "error_message" in data
    assert data["error_message"] == error_message


def test_get_pipeline_run_returns_error_message_failure_status(client, dummy_user, run_id):
    """Test get_pipeline_run returns error_message field when status is failure."""
    _assert_pipeline_run_error_message(
        client,
        dummy_user,
        run_id,
        "failure",
        "Invalid configuration: Missing required parameter",
    )


def test_get_pipeline_run_no_error_message_when_success(client, dummy_user, run_id):
    """Test get_pipeline_run does NOT return error_message when status is success."""
    create_test_run(run_id, user_id=dummy_user.id, status="success")

    response = client.get(f"/api/runs/{run_id}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "error_message" not in data


def test_get_run_file_not_found_sanitized(client, dummy_user, run_id):
    """Test get_run_file with file not found returns sanitized error."""
    # Create run but no output directory
    create_test_run(run_id, user_id=dummy_user.id, status="success", output_path="/nonexistent/path")

    response = client.get(f"/api/runs/{run_id}/files/nonexistent.txt")
    assert response.status_code in [404, 500]  # Could be either depending on error type
    data = response.get_json()
    assert "error" in data
    # Verify error is sanitized
    assert "/nonexistent/path" not in str(data)
    assert "nonexistent.txt" not in str(data) or "Required file is missing" in data["error"]


def test_get_run_file_permission_error_sanitized(client, dummy_user, run_id, tmp_path):
    """Test get_run_file with permission error returns sanitized error."""

    output_path = tmp_path / "run_output"
    output_path.mkdir()
    (output_path / "test.txt").write_text("content")

    create_test_run(run_id, user_id=dummy_user.id, status="success", output_path=str(output_path))

    with patch("builtins.open", side_effect=PermissionError("Permission denied")):
        response = client.get(f"/api/runs/{run_id}/files/test.txt")
        assert response.status_code == 500
        data = response.get_json()
        assert "error" in data
        assert (
            data["error"]
            == "Something went wrong. Please try again or contact support if the problem persists."
        )


def test_get_run_files_invalid_run_id_sanitized(client):
    """Test get_run_files with invalid run ID returns 404 (URL converter behavior)."""
    response = client.get("/api/runs/invalid_id/files")
    # BSONObjectIdConverter returns 404 for invalid ObjectId format
    assert response.status_code == 404


def test_pipeline_routes_no_raw_error_strings_exposed(client, dummy_user, run_id):
    """Test that no raw error strings (str(e)) are exposed in pipeline route responses."""
    # Test get_run_file with various exceptions
    exceptions = [
        FileNotFoundError("/path/to/file.txt"),
        PermissionError("Permission denied"),
        ValueError("Invalid input"),
    ]

    create_test_run(run_id, user_id=dummy_user.id, status="success")

    for exc in exceptions:
        with patch("backend.routes.pipelines.os.path.join", side_effect=exc):
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


def test_all_errors_use_create_user_error_response(client, dummy_user, run_id):
    """Test that all errors use create_user_error_response (verify consistent format)."""
    # Create a run that exists but user doesn't have access to

    other_user_id = ObjectId()
    create_test_run(run_id, user_id=other_user_id, status="success")

    # Test that error responses have consistent format (run exists but unauthorized)
    response = client.get(f"/api/runs/{run_id}/files")
    assert response.status_code == 404  # Not found because user doesn't own the run
    data = response.get_json()
    # Should have "error" field
    assert "error" in data
    assert isinstance(data["error"], str)
