"""Authentication route tests.

Notes:
    OAuth boundaries are patched here. Filesystem assertions still use real temp
    user-data directories.
"""

from unittest.mock import MagicMock, patch

import pytest
from bson import ObjectId

from backend.extensions import db
from backend.tests.conftest import TEST_USER_ID

pytestmark = pytest.mark.filterwarnings(
    "ignore:datetime\\.datetime\\.utcnow\\(\\) is deprecated.*:DeprecationWarning"
)


def test_login_rejects_external_redirect(client):
    """External redirects must be blocked.

    Arguments:
        client {Any} -- anonymous Flask test client

    Notes:
        Allowing them turns the login endpoint into an open redirector usable for phishing.
    """
    response = client.get("/login?redirect=https://evil.example/path")

    assert response.status_code == 400


def test_logout_calls_logout_user(client, authenticated_user):
    """Logout must delegate to Flask-Login's logout_user.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session to log out

    Notes:
        This ensures the session is properly invalidated server-side.
    """
    with patch("backend.routes.auth.logout_user") as logout_user:
        response = client.post("/logout")

    assert response.status_code == 200
    logout_user.assert_called_once()


# TODO: Test OAuth callbacks for accepted Helmholtz-member entitlements, rejection of non-members,
# disabled entitlement restriction, and multiple configured required VOs.


def test_check_auth_logged_out(client):
    """The check_auth endpoint must report unauthenticated when there is no session.

    Arguments:
        client {Any} -- anonymous Flask test client with no active session

    Notes:
        This lets the frontend show the anonymous UI state.
    """
    response = client.get("/api/check_auth")

    assert response.status_code == 200
    assert response.get_json()["authenticated"] is False


def test_check_auth_logged_in(client, authenticated_user):
    """The check_auth endpoint must return the user id for an authenticated session.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session

    Notes:
        This lets the frontend associate UI state with the correct account.
    """
    response = client.get("/api/check_auth")

    assert response.status_code == 200
    data = response.get_json()
    assert data["authenticated"] is True
    assert data["user"]["id"] == TEST_USER_ID


def test_current_user_missing_db_record_returns_logged_in_payload(client, authenticate_as):
    """A missing DB row is treated as logged in with default values instead of forcing a logout.

    Arguments:
        client {Any} -- Flask test client
        authenticate_as {Callable} -- factory that patches current_user to the given id

    Notes:
        Forcing a logout mid-session would be unexpected.
    """
    missing_user_id = str(ObjectId())
    authenticate_as(missing_user_id)

    response = client.get("/api/check_auth")

    assert response.status_code == 200
    assert response.get_json()["authenticated"] is True
    assert response.get_json()["user"]["role"] == "user"


def test_helmholtz_callback_creates_new_user(client, test_data_roots):
    """The first Helmholtz login creates the user document and data directory.

    Arguments:
        client {Any} -- anonymous Flask test client
        test_data_roots {DataRoots} -- per-test temp filesystem roots for asserting user dir creation

    Notes:
        Helmholtz AAI has no separate registration step, so the first login is registration.
    """
    token = {
        "access_token": "token",
        "userinfo": {"sub": "sub-1", "entitlements": ["urn:geant:helmholtz.de:group:Helmholtz-member"]},
    }
    with patch("backend.routes.auth.oauth.helmholtz.authorize_access_token", return_value=token):
        response = client.get("/auth/callback")

    assert response.status_code == 302
    user = db.users.find_one({"helmholtz_sub": "sub-1"})
    assert user is not None
    assert user["role"] == "user"
    assert (test_data_roots.user_data / str(user["_id"])).is_dir()


def test_helmholtz_callback_reuses_existing_user(client):
    """Repeated logins must reuse the existing account instead of creating duplicates.

    Arguments:
        client {Any} -- anonymous Flask test client

    Notes:
        helmholtz_sub is the unique identifier that links logins to the same user.
    """
    user_id = db.users.insert_one({"helmholtz_sub": "sub-1", "role": "user"}).inserted_id
    token = {"access_token": "token", "userinfo": {"sub": "sub-1"}}

    with patch("backend.routes.auth.oauth.helmholtz.authorize_access_token", return_value=token):
        response = client.get("/auth/callback")

    assert response.status_code == 302
    assert db.users.count_documents({"helmholtz_sub": "sub-1"}) == 1
    assert db.users.find_one({"helmholtz_sub": "sub-1"})["_id"] == user_id


def test_helmholtz_callback_fetches_userinfo_when_missing_from_token(client):
    """The callback must fall back to the userinfo endpoint to get the subject when it is missing from the token.

    Arguments:
        client {Any} -- anonymous Flask test client

    Notes:
        Some OAuth providers don't embed userinfo in the token itself.
    """
    response_mock = MagicMock()
    response_mock.json.return_value = {
        "sub": "sub-2",
        "entitlements": ["urn:geant:helmholtz.de:group:Helmholtz-member"],
    }

    with (
        patch(
            "backend.routes.auth.oauth.helmholtz.authorize_access_token",
            return_value={"access_token": "token"},
        ),
        patch("backend.routes.auth.oauth.helmholtz.get", return_value=response_mock),
    ):
        response = client.get("/auth/callback")

    assert response.status_code == 302
    assert db.users.find_one({"helmholtz_sub": "sub-2"}) is not None
