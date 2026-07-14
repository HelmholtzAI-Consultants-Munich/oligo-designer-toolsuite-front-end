"""Legal routes must be publicly accessible and consent must be persisted correctly
so users can read terms before agreeing and the system can enforce compliance.

Notes:
    Account deletion cascades across all related collections in a single test because
    partial cleanup would leave orphaned data and violate user privacy expectations.
"""

from unittest.mock import patch

import pytest
from bson import ObjectId

from backend.extensions import db
from backend.tests.conftest import TEST_SESSION_ID, TEST_USER_ID
from backend.utilities.legal import (
    PRIVACY_DOCUMENT_KEY,
    TERMS_DOCUMENT_KEY,
    get_published_legal_document,
)
from backend.utilities.legal_acceptance import get_current_terms_version
from backend.utilities.typed_values import serialize_path


@pytest.mark.parametrize(
    ("path", "document_key", "title"),
    [
        ("/api/legal/terms", TERMS_DOCUMENT_KEY, "Terms of Service"),
        ("/api/legal/privacy-policy", PRIVACY_DOCUMENT_KEY, "Data Protection Declaration"),
    ],
)
def test_public_legal_document_route(client, path, document_key, title):
    """Legal documents must be publicly accessible without authentication so users can read terms before consenting.

    Arguments:
        client {Any} -- anonymous Flask test client
        path {str} -- one of the parametrized legal document route paths
        document_key {str} -- expected document key in the response
        title {str} -- expected document title in the response
    """
    response = client.get(path)

    assert response.status_code == 200
    data = response.get_json()
    assert data["document"] == document_key
    assert data["title"] == title
    assert data["version"] == get_published_legal_document(document_key)["version"]
    assert data["body"]


def test_accept_terms_for_authenticated_user(client, authenticate_as):
    """Authenticated consent must be stored by user_id and reflected on the user row so acceptance history and user profile stay in sync.

    Arguments:
        client {Any} -- Flask test client
        authenticate_as {Callable} -- factory that patches current_user to the given id
    """
    authenticate_as(TEST_USER_ID)
    db.users.insert_one({"_id": ObjectId(TEST_USER_ID), "role": "user"})

    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    acceptance = db.legal_acceptances.find_one({"user_id": TEST_USER_ID})
    assert acceptance["terms_version"] == get_current_terms_version()
    assert (
        db.users.find_one({"_id": ObjectId(TEST_USER_ID)})["accepted_terms_version"]
        == acceptance["terms_version"]
    )


def test_accept_terms_for_anonymous_session(client):
    """Anonymous consent must be stored by session_id rather than user_id so it can be transferred when the user later registers.

    Arguments:
        client {Any} -- anonymous Flask test client
    """
    with client.session_transaction() as sess:
        sess["session_id"] = TEST_SESSION_ID

    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    assert db.legal_acceptances.find_one({"session_id": TEST_SESSION_ID}) is not None


def test_accept_terms_auto_creates_session_for_anonymous_client(client):
    """Consent must work even on a brand-new client with no prior session so the before-request hook creates one automatically.

    Arguments:
        client {Any} -- anonymous Flask test client that has never made a prior request
    """
    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    assert db.legal_acceptances.count_documents({"session_id": {"$exists": True}}) == 1


def test_delete_account_removes_user_and_related_data(client, authenticated_user, test_data_roots):
    """Cascading deletion must cover all related collections so partial cleanup cannot leave orphaned files or DB records consuming storage.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session for the user being deleted
        test_data_roots {DataRoots} -- per-test temp filesystem roots for asserting file removal
    """
    upload_file = test_data_roots.uploads / "upload.fna"
    upload_file.write_text(">x\nAC\n")
    output_dir = test_data_roots.user_dir / "output"
    output_dir.mkdir()
    db.runs.insert_one(
        {"_id": ObjectId(), "user_id": TEST_USER_ID, "output_path": serialize_path(output_dir)}
    )
    db.uploads.insert_one({"_id": ObjectId(), "user_id": TEST_USER_ID, "path": str(upload_file)})
    db.feedback.insert_one({"_id": ObjectId(), "user_id": TEST_USER_ID})

    with patch("backend.routes.auth.logout_user"):
        response = client.delete("/api/account")

    assert response.status_code == 200
    assert db.users.find_one({"_id": ObjectId(TEST_USER_ID)}) is None
    assert db.runs.count_documents({"user_id": TEST_USER_ID}) == 0
    assert db.uploads.count_documents({"user_id": TEST_USER_ID}) == 0
    assert db.feedback.count_documents({"user_id": TEST_USER_ID}) == 0
    assert not upload_file.exists()
    assert not output_dir.exists()


def test_delete_account_requires_authentication(client):
    """Unauthenticated account deletion must be rejected to prevent anyone from deleting accounts without a valid session.

    Arguments:
        client {Any} -- anonymous Flask test client with no active session
    """
    response = client.delete("/api/account")

    assert response.status_code in {401, 403}
