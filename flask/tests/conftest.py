import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import create_app
from extensions import mongo


@pytest.fixture(autouse=True)
def mock_make_dir():
    """Auto-use fixture to mock os.makedirs across all tests"""
    with patch("os.makedirs"):
        yield


@pytest.fixture(autouse=True)
def mock_user_dir_exists(monkeypatch):
    """Auto-use fixture to mock user directory existence for authenticated users.

    This allows pipeline route tests to succeed without creating actual directories.
    Tests that specifically test missing directories can override this with their own patch.
    """
    import os
    import builtins

    original_exists = os.path.exists
    original_makedirs = os.makedirs
    original_open = builtins.open

    def mock_exists(path):
        path_str = str(path)
        # Allow user directories to exist for authenticated users
        # Pattern: .../user_data/test_user_id or .../user_data/dummy_user
        if "/user_data/" in path_str or path_str.endswith("user_data"):
            # Check if it's for a test user
            if any(user_id in path_str for user_id in ["test_user_id", "dummy_user", "anon"]):
                # Return True for directory existence checks
                # This allows PipelineRunner.create_context() to succeed
                return True
        # Use original behavior for other paths (files, etc.)
        return original_exists(path)

    def mock_makedirs(path, mode=0o777, exist_ok=False):
        """Mock makedirs to silently succeed for test user directories."""
        path_str = str(path)
        if "/user_data/" in path_str:
            if any(user_id in path_str for user_id in ["test_user_id", "dummy_user", "anon"]):
                # Silently succeed for test user directories
                return
        # Use original behavior for other paths
        return original_makedirs(path, mode=mode, exist_ok=exist_ok)

    def mock_open(file_path, mode="r", *args, **kwargs):
        """Mock open() to succeed for config files in test user directories."""
        from unittest.mock import MagicMock

        path_str = str(file_path)
        if "/user_data/" in path_str and any(
            user_id in path_str for user_id in ["test_user_id", "dummy_user", "anon"]
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
    monkeypatch.setattr("os.makedirs", mock_makedirs)
    monkeypatch.setattr("builtins.open", mock_open)


@pytest.fixture
def run_id():
    # Insert dummy run
    return mongo.db.runs.insert_one({"status": "created"}).inserted_id


@pytest.fixture
def mock_celery():
    class MockPendingAsyncResult:
        id = "123"
        state = "pending"
        def successful(self): return False
        def get(self): return False, b""

    class MockSuccessfulAsyncResult:
        id = "123"
        state = "success"
        def successful(self): return True
        def get(self): return True, b""


    with patch("routes.pipelines.enqueue_pipeline") as mock_pending:
        mock_pending.return_value = MockPendingAsyncResult()
        with patch("extensions.celery_app.AsyncResult") as mock_success:
            mock_success.return_value = MockSuccessfulAsyncResult()
            yield mock_success

@pytest.fixture
def mock_run():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""
        yield mock_run


@pytest.fixture
def app():
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


@pytest.fixture
def authenticated_user(monkeypatch):
    # Simulate an authenticated user
    class DummyUser:
        is_authenticated = True
        id = "test_user_id"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())


@pytest.fixture()
def session_user(client, monkeypatch):
    """Simulate an anonymous user with session (works for both HTTP requests and direct method calls)."""

    # Monkeypatch Flask-Login for anonymous user
    class AnonymousUser:
        is_authenticated = False

    monkeypatch.setattr("flask_login.utils._get_user", lambda: AnonymousUser())

    # Set up session for HTTP requests
    with client.session_transaction() as sess:
        sess["session_id"] = "anon-session-123"


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
    and the error message matches the expected InvalidId error message. Optionally verifies
    that the error is sanitized.

    Args:
        response: Flask test client response object
        check_sanitized: Whether to also check that error is sanitized (default: True)
    """
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "The run ID you provided is not valid. Please check and try again."
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
    from extensions import mongo

    run_doc = {
        "_id": run_id,
        "pipeline": kwargs.get("pipeline", "TestPipeline"),
        "status": kwargs.get("status", "completed"),
        "timestamp": kwargs.get("timestamp", "2025_08_20"),
        "output_path": kwargs.get("output_path", "/tmp/fake"),
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
            "dir_output": {"type": "string"},
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


@pytest.fixture
def pipeline_runner(mock_schema):
    """Create PipelineRunner instance for testing."""
    from routes.runners.pipeline_runner import PipelineRunner

    return PipelineRunner("test_pipeline", "test_probe_designer", mock_schema)
