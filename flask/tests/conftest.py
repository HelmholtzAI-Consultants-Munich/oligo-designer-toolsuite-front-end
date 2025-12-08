from bson import ObjectId
import pytest
import sys
import os
from unittest.mock import patch

from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import create_app
from extensions import mongo as ext_mongo


# scope to module to allow registered_user fixture to only be executed once
@pytest.fixture(scope="session")
def dummy_user():
    """Dummy user dictionary with static id and password"""
    return {
        "_id": ObjectId(b"testuser1234"),  # 12-byte string for static id
        "email": "test@example.com",
        "name": "testuser1234",
        "password": generate_password_hash("mypassword"),
    }


@pytest.fixture
def dummy_current_user(dummy_user):
    """Dummy user object simulating an authenticated flask_login.current_user"""

    class DummyCurrentUser:
        is_authenticated = True
        id = str(dummy_user["_id"])
        email = dummy_user["email"]
        name = dummy_user["name"]

    return DummyCurrentUser()


@pytest.fixture
def mock_run():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""
        yield mock_run


@pytest.fixture(scope="session")
def app():
    app = create_app()
    app.config["TESTING"] = True
    app.secret_key = "test-key"
    return app


@pytest.fixture()
def client(app):
    with app.test_client() as client:
        yield client


@pytest.fixture(scope="session")
def mongo(app):
    # Initialize app before connecting to mongo
    assert ext_mongo.db is not None
    return ext_mongo


@pytest.fixture
def run_id(mongo):
    # Insert dummy run
    return mongo.db.runs.insert_one({"status": "created"}).inserted_id


@pytest.fixture
def authenticated_user(client, monkeypatch, dummy_current_user):
    # Simulate an authenticated user
    with client.session_transaction() as session:
        session["session_id"] = "test-session"  # static session id
    monkeypatch.setattr("flask_login.utils._get_user", lambda: dummy_current_user)


@pytest.fixture()
def session_user(client):
    # Simulate an anonymous user with session
    with client.session_transaction() as session:
        session["session_id"] = "anon-session-123"  # static session id
