"""
This file configures reusable code blocks ("fixtures") that can be used by tests for setup and utility functions.

Important Note:
    Pytest currently only tests code that is part of the Flask server.
    The Celery worker, including the actual pipeline execution using ODT, is not being tested.
    Instead, the function calls used to start tasks on Celery workers is mocked.
"""

import builtins
import json
import os
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from backend.app import create_app
from backend.constants import PIPELINE_FILE_INPUT
from backend.extensions import mongo
from backend.utilities.legal_acceptance import get_current_terms_version
from backend.utilities.typed_values import serialize_path, utc_now
from backend.utils import retrieve_form_data_value

# Temporarily disabled - see issue for better directory mocking solution
# @pytest.fixture(autouse=True)
# def mock_make_dir():
#     """Auto-use fixture to mock os.makedirs across all tests"""
#     with patch("os.makedirs"):
#         yield


def post(client, link: str, data: dict[str, Any]):
    print("Modifying data")
    pipeline = link.split("/")[-1]
    file_uploads = {}
    if "formdata" in data:
        form_data = data["formdata"]
        for path in PIPELINE_FILE_INPUT.get(pipeline, []):
            field = retrieve_form_data_value(path, form_data)
            if field is not None:
                for file in field:
                    file_uploads[file] = open(os.path.join(os.path.dirname(__file__), str(file)), "rb")

    return client.post(
        link, data={**file_uploads, "payload": json.dumps(data)}, content_type="multipart/form-data"
    )


@pytest.fixture(autouse=True)
def mock_user_dir_exists(monkeypatch):
    """Auto-use fixture to mock user directory existence for authenticated users.

    This allows pipeline route tests to succeed without creating actual directories.
    Tests that specifically test missing directories can override this with their own patch.
    """
    original_exists = os.path.exists
    original_makedirs = os.makedirs
    original_open = builtins.open

    def mock_exists(path):
        path_str = str(path)
        # Allow user directories to exist for authenticated users
        # Pattern: .../user_data/507f1f77bcf86cd799439011 or .../user_data/dummy_user
        # 507f1f77bcf86cd799439011 is a test user id
        if "/user_data/" in path_str or "cache" in path_str or path_str.endswith("user_data"):
            # Check if it's for a test user
            if any(user_id in path_str for user_id in ["507f1f77bcf86cd799439011", "dummy_user", "anon"]):
                # Return True for directory existence checks
                # This allows PipelineRunner.create_context() to succeed
                return True
        # Use original behavior for other paths (files, etc.)
        return original_exists(path)

    def mock_makedirs(path, mode=0o777, exist_ok=False):
        """Mock makedirs to silently succeed for test user directories."""
        path_str = str(path)
        if "/user_data/" in path_str:
            if any(user_id in path_str for user_id in ["507f1f77bcf86cd799439011", "dummy_user", "anon"]):
                # Silently succeed for test user directories
                return
        if "cache" in path_str:
            return
        # Use original behavior for other paths
        return original_makedirs(path, mode=mode, exist_ok=exist_ok)

    def mock_open(file_path, mode="r", *args, **kwargs):
        """Mock open() to succeed for config files in test user directories."""
        path_str = str(file_path)
        if "/user_data/" in path_str and any(
            user_id in path_str for user_id in ["507f1f77bcf86cd799439011", "dummy_user", "anon"]
        ):
            if "config" in path_str and mode == "w":
                # For config files, return a mock file object that can be written to
                # MagicMock can be used as a context manager and supports write()
                mock_file = MagicMock()
                mock_file.__enter__ = MagicMock(return_value=mock_file)
                mock_file.__exit__ = MagicMock(return_value=False)
                return mock_file
        # Use original behavior for other files - use saved reference to avoid recursion
        return original_open(file_path, mode, *args, **kwargs)

    monkeypatch.setattr("os.path.exists", mock_exists)
    monkeypatch.setattr("pathlib.Path.exists", mock_exists)
    monkeypatch.setattr("os.makedirs", mock_makedirs)
    monkeypatch.setattr("builtins.open", mock_open)


@pytest.fixture
def run_id(app):
    # Insert dummy run - needs app context for mongo to be initialized
    with app.app_context():
        return mongo.db.runs.insert_one({"status": "created"}).inserted_id


@pytest.fixture
def mock_celery():
    """This was impossible to do properly, leaving this up to #197"""

    class MockPendingAsyncResult:
        id = "123"
        state = "pending"

    with patch("backend.routes.pipelines.enqueue_pipeline") as mock_pending:
        mock_pending.return_value = MockPendingAsyncResult()
        yield mock_pending


@pytest.fixture
def mock_run():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""
        yield mock_run


@pytest.fixture(scope="session")
def mock_initial():
    with patch("backend.app.initial_dropdown_prefetch"):
        yield


@pytest.fixture(scope="session")
def app(mock_initial):
    """Create Flask app for testing (for direct function testing)."""
    app = create_app()
    app.config["TESTING"] = True
    app.secret_key = "test-key"
    return app


@pytest.fixture
def client(app, monkeypatch):
    """Base test client with anonymous user"""

    class AnonymousUser:
        is_authenticated = False

    monkeypatch.setattr("flask_login.utils._get_user", lambda: AnonymousUser())

    with app.test_client() as client:
        with app.app_context():
            yield client


class TestAuthenticatedUser:
    is_authenticated = True

    def __init__(self, user_id: str):
        self.id = user_id


def _insert_terms_acceptance(**query):
    mongo.db.legal_acceptances.insert_one(
        {
            **query,
            "document": "terms",
            "terms_version": get_current_terms_version(),
            "timestamp": utc_now(),
        }
    )


def _delete_terms_acceptance(**query):
    mongo.db.legal_acceptances.delete_many(query)


@pytest.fixture
def authenticated_user(app, monkeypatch):
    # Simulate an authenticated user
    class DummyUser:
        is_authenticated = True
        id = "507f1f77bcf86cd799439011"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())
    with app.app_context():
        _insert_terms_acceptance(user_id=DummyUser.id)
    yield
    with app.app_context():
        _delete_terms_acceptance(user_id=DummyUser.id)


@pytest.fixture
def authenticate_as_user(monkeypatch):
    def _authenticate(user_id: str) -> TestAuthenticatedUser:
        user = TestAuthenticatedUser(user_id)
        monkeypatch.setattr("flask_login.utils._get_user", lambda: user)
        return user

    return _authenticate


@pytest.fixture()
def session_user(client, app, monkeypatch):
    """Simulate an anonymous user with session (works for both HTTP requests and direct method calls)."""

    # Monkeypatch Flask-Login for anonymous user
    class AnonymousUser:
        is_authenticated = False

    monkeypatch.setattr("flask_login.utils._get_user", lambda: AnonymousUser())

    # Set up session for HTTP requests
    with client.session_transaction() as sess:
        sess["session_id"] = "anon-session-123"
    with app.app_context():
        _insert_terms_acceptance(session_id="anon-session-123")
    yield
    with app.app_context():
        _delete_terms_acceptance(session_id="anon-session-123")


def assert_error_sanitized(response_data):
    """
    Helper function to verify that error responses are sanitized.

    Checks that common raw error strings (like exception class names,
    file paths, etc.) are not exposed in the response.

    Args:
        response_data: The response data (dict or response object with get_json())
    """
    if hasattr(response_data, "get_json"):
        data = response_data.get_json()
    else:
        data = response_data

    data_str = str(data)
    # Verify no raw error strings exposed
    assert "InvalidId" not in data_str, "Raw InvalidId exception name should not be exposed"
    assert "invalid_id" not in data_str, "Raw invalid_id should not be exposed"
    assert "Traceback" not in data_str, "Stack traces should not be exposed"
    assert "/user_data/" not in data_str, "File paths should not be exposed"


def assert_invalid_run_id_error(response, check_sanitized=True):
    """
    Helper function to assert standard invalid run ID error response.

    Checks that the response has status code 400, contains an error field,
    and the error message indicates a run ID validation failure. Optionally verifies
    that the error is sanitized.

    Args:
        response: Flask test client response object
        check_sanitized: Whether to also check that error is sanitized (default: True)
    """
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    # Accepts either "Run ID is required" or "Invalid run ID format: ..."
    assert "run id" in data["error"].lower() or "Run ID" in data["error"]
    if check_sanitized:
        assert_error_sanitized(data)


@pytest.fixture
def dummy_user(monkeypatch):
    """Fixture for a test user with id='dummy_user' (used in test_pipeline_routes.py)."""

    class DummyUser:
        is_authenticated = True
        id = "dummy_user"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())
    return DummyUser


def create_test_run(run_id, user_id="dummy_user", **kwargs):
    """
    Helper function to create a test run in MongoDB.

    Args:
        run_id: The run ID (ObjectId or string)
        user_id: The user ID (default: "dummy_user"). Set to None for anonymous sessions.
        **kwargs: Additional fields to include in the run document (e.g., session_id)

    Returns:
        The inserted/updated document
    """
    output_path = kwargs.get("output_path", Path("/tmp/fake"))
    if isinstance(output_path, str):
        output_path = Path(output_path)

    run_doc = {
        "_id": run_id,
        "pipeline": kwargs.get("pipeline", "TestPipeline"),
        "status": kwargs.get("status", "success"),
        "timestamp": kwargs.get("timestamp", utc_now()),
        "output_path": serialize_path(output_path),
        **{k: v for k, v in kwargs.items() if k not in ["pipeline", "status", "timestamp", "output_path"]},
    }

    # Only set user_id if provided (None means anonymous session)
    if user_id is not None:
        run_doc["user_id"] = user_id

    # Use replace_one to handle existing runs (from run_id fixture)
    return mongo.db.runs.replace_one({"_id": run_id}, run_doc, upsert=True)


@pytest.fixture
def mock_schema():
    """Mock schema for PipelineRunner."""
    return {
        "properties": {
            "test_param": {"type": "integer"},
        }
    }


@pytest.fixture
def form_data():
    """Create test form data for PipelineRunner tests."""
    return {
        "file_regions": "",
        "test_param": "123",
    }
