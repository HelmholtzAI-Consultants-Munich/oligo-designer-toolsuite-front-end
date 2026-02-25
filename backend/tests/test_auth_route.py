from unittest.mock import patch

import pytest
from bson import ObjectId
from werkzeug.security import generate_password_hash

from backend.extensions import mongo


@pytest.fixture(autouse=True)
def mock_make_dir():
    with patch("os.makedirs"):
        yield


@pytest.fixture
def client(monkeypatch, app):
    class AnonymousUser:
        is_authenticated = False

    monkeypatch.setattr("flask_login.utils._get_user", lambda: AnonymousUser())

    with app.test_client() as client:
        with app.app_context():
            yield client


@pytest.fixture
def dummy_user():
    return {"_id": ObjectId(), "email": "test@example.com", "password": generate_password_hash("mypassword")}


def test_register_success(client, dummy_user):
    mongo.db.users.delete_many({"email": dummy_user["email"]})
    response = client.post("/register", json={"email": dummy_user["email"], "password": "mypassword"})
    assert response.status_code == 201
    assert response.get_json()["message"] == "User registered successfully"


def test_register_existing_user(client, dummy_user):
    mongo.db.users.insert_one(dummy_user)
    response = client.post("/register", json={"email": dummy_user["email"], "password": "mypassword"})
    assert response.status_code == 409
    assert "error" in response.get_json()


def test_register_missing_fields(client):
    response = client.post("/register", json={"email": ""})
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_login_success(client, monkeypatch, dummy_user):
    mongo.db.users.insert_one(dummy_user)

    def mock_find_one(query):
        if query.get("email") == dummy_user["email"]:
            return dummy_user
        if query.get("_id") == dummy_user["_id"]:
            return dummy_user
        return None

    monkeypatch.setattr("backend.extensions.mongo.db.users.find_one", mock_find_one)
    monkeypatch.setattr("werkzeug.security.check_password_hash", lambda hashed, plain: True)
    monkeypatch.setattr("flask_login.login_user", lambda user: None)

    with patch("os.makedirs"), patch("backend.extensions.mongo.db.runs.update_many"):
        response = client.post("/login", json={"email": dummy_user["email"], "password": "mypassword"})
        assert response.status_code == 200
        assert response.get_json()["message"] == "Logged in successfully"


def test_login_invalid_credentials(client, monkeypatch):
    monkeypatch.setattr("backend.extensions.mongo.db.users.find_one", lambda q: None)
    response = client.post("/login", json={"email": "notfound@example.com", "password": "wrongpass"})
    assert response.status_code == 401
    assert "error" in response.get_json()


def test_login_get_rejects_external_redirect(client):
    response = client.get("/login?redirect=https://evil.example")
    assert response.status_code == 400
    assert response.get_json()["error"] == "Invalid redirect path"


def test_check_auth_logged_out(client):
    response = client.get("/api/check_auth")
    data = response.get_json()
    assert data["authenticated"] is False


def test_check_auth_logged_in(client, monkeypatch, dummy_user):
    class DummyCurrentUser:
        is_authenticated = True
        id = str(dummy_user["_id"])
        email = dummy_user["email"]
        name = ""

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

    client.post("/login", json={"email": "fake", "password": "fake"})
    with client.session_transaction() as sess:
        sess["_user_id"] = "123"

    response = client.post("/logout")
    assert response.status_code == 200
    assert response.get_json()["message"] == "Logged out"
