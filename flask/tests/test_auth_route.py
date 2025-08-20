import pytest
from flask import session
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from unittest.mock import patch, MagicMock
from bson import ObjectId
from flask_login import logout_user
import pytest
from app import create_app
from extensions import mongo

@pytest.fixture
def client(monkeypatch):
    app = create_app()
    app.config['TESTING'] = True
    app.secret_key = 'test-key'

    # Patch current_user globally to avoid 'NoneType' errors in auth.py
    class AnonymousUser:
        is_authenticated = False

    monkeypatch.setattr("flask_login.utils._get_user", lambda: AnonymousUser())

    with app.test_client() as client:
        with app.app_context():
            yield client
@pytest.fixture
def dummy_user():
    return {
        "_id": ObjectId(),
        "email": "test@example.com",
        "password": "hashedpassword"
    }


def test_register_success(client, dummy_user):
    email = "newuser12@example.com"
    with patch("extensions.mongo.db.users.find_one", return_value=None), \
         patch("extensions.mongo.db.users.insert_one", return_value=MagicMock(inserted_id=dummy_user["_id"])), \
         patch("os.makedirs"), \
         patch("flask_login.login_user"):
        response = client.post("/register", json={"email": email, "password": "mypassword"})
        assert response.status_code == 201
        assert response.get_json()["message"] == "User registered successfully"

    # Clean up if not fully mocked (optional)
    mongo.db.users.delete_one({"email": email})


def test_register_existing_user(client, monkeypatch, dummy_user):
    monkeypatch.setattr("extensions.mongo.db.users.find_one", lambda q: dummy_user)

    response = client.post("/register", json={"email": dummy_user["email"], "password": "mypassword"})
    assert response.status_code == 409
    assert "error" in response.get_json()


def test_register_missing_fields(client):
    response = client.post("/register", json={"email": ""})
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_login_success(client, monkeypatch, dummy_user):
    monkeypatch.setattr("extensions.mongo.db.users.find_one", lambda q: dummy_user)
    monkeypatch.setattr("werkzeug.security.check_password_hash", lambda hashed, plain: True)
    monkeypatch.setattr("flask_login.login_user", lambda user: None)

    with patch("os.makedirs"), patch("extensions.mongo.db.runs.update_many"):
        response = client.post("/login", json={"email": dummy_user["email"], "password": "mypassword"})
        assert response.status_code == 200
        assert response.get_json()["message"] == "Logged in successfully"


def test_login_invalid_credentials(client, monkeypatch):
    monkeypatch.setattr("extensions.mongo.db.users.find_one", lambda q: None)
    response = client.post("/login", json={"email": "notfound@example.com", "password": "wrongpass"})
    assert response.status_code == 401
    assert "error" in response.get_json()


def test_check_auth_logged_out(client):
    response = client.get("/api/check_auth")
    data = response.get_json()
    assert data["authenticated"] is False


def test_check_auth_logged_in(client, monkeypatch, dummy_user):
    class DummyCurrentUser:
        is_authenticated = True
        id = str(dummy_user["_id"])
        email = dummy_user["email"]

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyCurrentUser())

    with client.session_transaction() as sess:
        sess["_user_id"] = str(dummy_user["_id"])

    response = client.get("/api/check_auth")
    data = response.get_json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == dummy_user["email"]


def test_logout(client, monkeypatch):
    monkeypatch.setattr("flask_login.logout_user", lambda: None)
    monkeypatch.setattr("flask_login.utils._get_user", lambda: type("User", (), {"is_authenticated": True})())

    # Mock authentication requirement
    client.post("/login", json={"email": "fake", "password": "fake"})
    with client.session_transaction() as sess:
        sess["_user_id"] = "123"

    response = client.post("/logout")
    assert response.status_code == 200
    assert response.get_json()["message"] == "Logged out"