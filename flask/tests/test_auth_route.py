import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from unittest.mock import patch


@pytest.fixture(autouse=True)
def mock_make_dir():
    with patch("os.makedirs"):
        yield


@pytest.fixture(scope="session")
def registered_user(mongo, dummy_user):
    """Authenticated dummy user dictionary that is present in the database"""
    mongo.db.users.delete_many({"_id": dummy_user["_id"]})
    mongo.db.users.insert_one(dummy_user)
    return dummy_user


def test_register_success(client, mongo, dummy_user):
    mongo.db.users.delete_many({"email": dummy_user["email"]})
    response = client.post("/register", json={"email": dummy_user["email"], "password": "mypassword"})
    assert response.status_code == 201
    assert response.get_json()["message"] == "User registered successfully"


def test_register_existing_user(client, registered_user):
    response = client.post("/register", json={"email": registered_user["email"], "password": "mypassword"})
    assert response.status_code == 409
    assert "error" in response.get_json()


def test_register_missing_fields(client):
    response = client.post("/register", json={"email": ""})
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_login_success(client, monkeypatch, registered_user):
    monkeypatch.setattr("werkzeug.security.check_password_hash", lambda hashed, plain: True)
    monkeypatch.setattr("flask_login.login_user", lambda user: None)

    with patch("extensions.mongo.db.runs.update_many"):
        response = client.post("/login", json={"email": registered_user["email"], "password": "mypassword"})
        assert response.status_code == 200
        assert response.get_json()["message"] == "Logged in successfully"


def test_login_inexistant_user(client, monkeypatch):
    monkeypatch.setattr("extensions.mongo.db.users.find_one", lambda q: None)
    response = client.post("/login", json={"email": "notfound@example.com", "password": "wrongpass"})
    assert response.status_code == 401
    assert "error" in response.get_json()


def test_login_invalid_credentials(client, monkeypatch, registered_user):
    monkeypatch.setattr("extensions.mongo.db.users.find_one", lambda q: None)
    response = client.post("/login", json={"email": registered_user["email"], "password": "wrongpass"})
    assert response.status_code == 401
    assert "error" in response.get_json()


def test_check_auth_logged_out(client):
    response = client.get("/api/check_auth")
    data = response.get_json()
    assert data["authenticated"] is False


def test_check_auth_logged_in(client, monkeypatch, dummy_current_user):
    monkeypatch.setattr("flask_login.utils._get_user", lambda: dummy_current_user)

    with client.session_transaction() as sess:
        sess["_user_id"] = str(dummy_current_user.id)

    response = client.get("/api/check_auth")
    data = response.get_json()
    assert data["authenticated"] is True
    assert data["user"]["email"] == dummy_current_user.email
    assert data["user"]["name"] == dummy_current_user.name


def test_logout(client, monkeypatch, authenticated_user):
    response = client.post("/logout")
    assert response.status_code == 200
    assert response.get_json()["message"] == "Logged out"
