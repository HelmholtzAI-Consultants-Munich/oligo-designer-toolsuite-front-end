"""Authentication route tests.

OAuth boundaries are patched here. Filesystem assertions still use real temp
user-data directories.
"""

from unittest.mock import MagicMock, patch

import pytest
from bson import ObjectId

from backend.extensions import mongo
from backend.tests.conftest import TEST_USER_ID

pytestmark = pytest.mark.filterwarnings(
    "ignore:datetime\\.datetime\\.utcnow\\(\\) is deprecated.*:DeprecationWarning"
)


def test_login_rejects_external_redirect(client):
    response = client.get("/login?redirect=https://evil.example/path")

    assert response.status_code == 400


def test_logout_calls_logout_user(client, authenticated_user):
    with patch("backend.routes.auth.logout_user") as logout_user:
        response = client.post("/logout")

    assert response.status_code == 200
    logout_user.assert_called_once()


def test_check_auth_logged_out(client):
    response = client.get("/api/check_auth")

    assert response.status_code == 200
    assert response.get_json()["authenticated"] is False


def test_check_auth_logged_in(client, authenticated_user):
    response = client.get("/api/check_auth")

    assert response.status_code == 200
    data = response.get_json()
    assert data["authenticated"] is True
    assert data["user"]["id"] == TEST_USER_ID


def test_current_user_missing_db_record_returns_logged_in_payload(client, authenticate_as):
    """Current implementation treats a missing DB row as logged in with defaults."""
    missing_user_id = str(ObjectId())
    authenticate_as(missing_user_id)

    response = client.get("/api/check_auth")

    assert response.status_code == 200
    assert response.get_json()["authenticated"] is True
    assert response.get_json()["user"]["role"] == "user"


def test_helmholtz_callback_creates_new_user(client, test_data_roots):
    """OAuth callback creates a new Helmholtz user and user-data directory."""
    token = {"access_token": "token", "userinfo": {"sub": "sub-1"}}
    with patch("backend.routes.auth.oauth.helmholtz.authorize_access_token", return_value=token):
        response = client.get("/auth/callback")

    assert response.status_code == 302
    user = mongo.db.users.find_one({"helmholtz_sub": "sub-1"})
    assert user is not None
    assert user["role"] == "user"
    assert (test_data_roots.user_data / str(user["_id"])).is_dir()


def test_helmholtz_callback_reuses_existing_user(client):
    user_id = mongo.db.users.insert_one({"helmholtz_sub": "sub-1", "role": "user"}).inserted_id
    token = {"access_token": "token", "userinfo": {"sub": "sub-1"}}

    with patch("backend.routes.auth.oauth.helmholtz.authorize_access_token", return_value=token):
        response = client.get("/auth/callback")

    assert response.status_code == 302
    assert mongo.db.users.count_documents({"helmholtz_sub": "sub-1"}) == 1
    assert mongo.db.users.find_one({"helmholtz_sub": "sub-1"})["_id"] == user_id


def test_helmholtz_callback_fetches_userinfo_when_missing_from_token(client):
    response_mock = MagicMock()
    response_mock.json.return_value = {"sub": "sub-2"}

    with (
        patch(
            "backend.routes.auth.oauth.helmholtz.authorize_access_token",
            return_value={"access_token": "token"},
        ),
        patch("backend.routes.auth.oauth.helmholtz.get", return_value=response_mock),
    ):
        response = client.get("/auth/callback")

    assert response.status_code == 302
    assert mongo.db.users.find_one({"helmholtz_sub": "sub-2"}) is not None
