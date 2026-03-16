from unittest.mock import patch

import pytest
from bson import ObjectId
from werkzeug.security import generate_password_hash

from backend.extensions import mongo
from backend.utilities.legal import (
    PRIVACY_DOCUMENT_KEY,
    TERMS_DOCUMENT_KEY,
    get_published_legal_document,
)


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
    return {
        "_id": ObjectId(),
        "username": "testuser",
        "password": generate_password_hash("mypassword"),
        "role": "user",
    }


def test_login_success(client, monkeypatch, dummy_user):
    mongo.db.users.insert_one(dummy_user)

    def mock_find_one(query):
        if query.get("username") == dummy_user["username"]:
            return dummy_user
        if query.get("_id") == dummy_user["_id"]:
            return dummy_user
        return None

    monkeypatch.setattr("backend.extensions.mongo.db.users.find_one", mock_find_one)
    monkeypatch.setattr("werkzeug.security.check_password_hash", lambda hashed, plain: True)
    monkeypatch.setattr("flask_login.login_user", lambda user, remember=True: None)

    with patch("os.makedirs"), patch("backend.extensions.mongo.db.runs.update_many"):
        response = client.post(
            "/login",
            json={"username": dummy_user["username"], "password": "mypassword"},
        )
        assert response.status_code == 200
        assert response.get_json()["message"] == "Logged in successfully"


def test_login_invalid_credentials(client, monkeypatch):
    monkeypatch.setattr("backend.extensions.mongo.db.users.find_one", lambda q: None)
    response = client.post(
        "/login",
        json={"username": "nonexistent", "password": "wrongpass"},
    )
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
    assert data["legal"]["scope"] == "session"
    assert data["legal"]["requires_terms_acceptance"] is True


def test_check_auth_logged_in(client, monkeypatch, dummy_user):
    mongo.db.users.insert_one(dummy_user)

    class DummyCurrentUser:
        is_authenticated = True
        id = str(dummy_user["_id"])

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyCurrentUser())

    with client.session_transaction() as sess:
        sess["_user_id"] = str(dummy_user["_id"])

    response = client.get("/api/check_auth")
    data = response.get_json()
    assert data["authenticated"] is True
    assert data["user"]["id"] == str(dummy_user["_id"])
    assert data["user"]["username"] == dummy_user["username"]
    assert data["user"]["role"] == dummy_user["role"]
    assert (
        data["user"]["current_terms_version"] == get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]
    )
    assert data["user"]["accepted_terms_version"] is None
    assert data["legal"]["scope"] == "user"
    assert data["legal"]["requires_terms_acceptance"] is True


def test_logout(client, monkeypatch):
    monkeypatch.setattr("flask_login.logout_user", lambda: None)
    monkeypatch.setattr("flask_login.utils._get_user", lambda: type("User", (), {"is_authenticated": True})())

    client.post("/login", json={"username": "fake", "password": "fake"})
    with client.session_transaction() as sess:
        sess["_user_id"] = "123"

    response = client.post("/logout")
    assert response.status_code == 200
    assert response.get_json()["message"] == "Logged out"


def test_accept_terms_updates_current_user(client, monkeypatch, dummy_user):
    mongo.db.users.insert_one(dummy_user)

    class DummyCurrentUser:
        is_authenticated = True
        id = str(dummy_user["_id"])

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyCurrentUser())

    with client.session_transaction() as sess:
        sess["_user_id"] = str(dummy_user["_id"])

    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    data = response.get_json()
    assert data["accepted_terms_version"] == get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]
    assert data["terms_accepted_at"] is not None

    updated_user = mongo.db.users.find_one({"_id": dummy_user["_id"]})
    assert (
        updated_user["accepted_terms_version"] == get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]
    )
    assert updated_user["terms_accepted_at"] is not None


def test_accept_terms_updates_current_session(client):
    with client.session_transaction() as sess:
        sess["session_id"] = "anon-session-accept"

    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    data = response.get_json()
    assert data["accepted_terms_version"] == get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]
    assert data["legal"]["scope"] == "session"
    assert data["legal"]["requires_terms_acceptance"] is False


def test_public_terms_route(client):
    response = client.get("/api/legal/terms")

    assert response.status_code == 200
    data = response.get_json()
    assert data["document"] == TERMS_DOCUMENT_KEY
    assert data["title"] == "Terms of Service"
    assert data["version"] == get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]
    assert data["body"]


def test_public_privacy_policy_route(client):
    response = client.get("/api/legal/privacy-policy")

    assert response.status_code == 200
    data = response.get_json()
    assert data["document"] == PRIVACY_DOCUMENT_KEY
    assert data["title"] == "Data Protection Declaration"
    assert data["version"] == get_published_legal_document(PRIVACY_DOCUMENT_KEY)["version"]
    assert data["body"]


def test_terms_page_redirects_to_frontend(client, app):
    app.config["FRONTEND_URL"] = "http://localhost:3000"

    response = client.get("/terms")

    assert response.status_code == 307
    assert response.headers["Location"] == "http://localhost:3000/terms"


def test_privacy_policy_page_redirects_to_frontend(client, app):
    app.config["FRONTEND_URL"] = "http://localhost:3000"

    response = client.get("/privacy-policy")

    assert response.status_code == 307
    assert response.headers["Location"] == "http://localhost:3000/privacy-policy"
