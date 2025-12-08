import pytest
import sys
import os
from unittest.mock import patch
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app
from extensions import mongo


@pytest.fixture(autouse=True)
def mock_make_dir():
    """Auto-use fixture to mock os.makedirs across all tests"""
    with patch("os.makedirs"):
        yield


@pytest.fixture
def run_id():
    # Insert dummy run
    return mongo.db.runs.insert_one({"status": "created"}).inserted_id

@pytest.fixture
def mock_run():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""
        yield mock_run

@pytest.fixture
def client(monkeypatch):
    """Base test client with anonymous user"""
    app = create_app()
    app.config['TESTING'] = True
    app.secret_key = 'test-key'

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
        id = "testuser123"
    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

@pytest.fixture()
def session_user(client):
    # Simulate an anonymous user with session
    with client.session_transaction() as sess:
        sess['session_id'] = 'anon-session-123'