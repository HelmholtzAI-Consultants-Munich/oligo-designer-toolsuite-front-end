"""Legal and account-deletion route tests."""

from unittest.mock import patch

import pytest
from bson import ObjectId

from backend.extensions import mongo
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
    response = client.get(path)

    assert response.status_code == 200
    data = response.get_json()
    assert data["document"] == document_key
    assert data["title"] == title
    assert data["version"] == get_published_legal_document(document_key)["version"]
    assert data["body"]


def test_accept_terms_for_authenticated_user(client, authenticate_as):
    """Authenticated consent is stored by user id and reflected on the user row."""
    authenticate_as(TEST_USER_ID)
    mongo.db.users.insert_one({"_id": ObjectId(TEST_USER_ID), "role": "user"})

    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    acceptance = mongo.db.legal_acceptances.find_one({"user_id": TEST_USER_ID})
    assert acceptance["terms_version"] == get_current_terms_version()
    assert (
        mongo.db.users.find_one({"_id": ObjectId(TEST_USER_ID)})["accepted_terms_version"]
        == acceptance["terms_version"]
    )


def test_accept_terms_for_anonymous_session(client):
    with client.session_transaction() as sess:
        sess["session_id"] = TEST_SESSION_ID

    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    assert mongo.db.legal_acceptances.find_one({"session_id": TEST_SESSION_ID}) is not None


def test_accept_terms_auto_creates_session_for_anonymous_client(client):
    """The app's before-request hook creates anonymous sessions before consent."""
    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    assert mongo.db.legal_acceptances.count_documents({"session_id": {"$exists": True}}) == 1


def test_delete_account_removes_user_and_related_data(client, authenticated_user, test_data_roots):
    """Account deletion removes user-owned DB records and tracked files."""
    upload_file = test_data_roots.uploads / "upload.fna"
    upload_file.write_text(">x\nAC\n")
    output_dir = test_data_roots.user_dir / "output"
    output_dir.mkdir()
    mongo.db.runs.insert_one(
        {"_id": ObjectId(), "user_id": TEST_USER_ID, "output_path": serialize_path(output_dir)}
    )
    mongo.db.uploads.insert_one({"_id": ObjectId(), "user_id": TEST_USER_ID, "path": str(upload_file)})
    mongo.db.feedback.insert_one({"_id": ObjectId(), "user_id": TEST_USER_ID})

    with patch("backend.routes.auth.logout_user"):
        response = client.delete("/api/account")

    assert response.status_code == 200
    assert mongo.db.users.find_one({"_id": ObjectId(TEST_USER_ID)}) is None
    assert mongo.db.runs.count_documents({"user_id": TEST_USER_ID}) == 0
    assert mongo.db.uploads.count_documents({"user_id": TEST_USER_ID}) == 0
    assert mongo.db.feedback.count_documents({"user_id": TEST_USER_ID}) == 0
    assert not upload_file.exists()
    assert not output_dir.exists()


def test_delete_account_requires_authentication(client):
    response = client.delete("/api/account")

    assert response.status_code in {401, 403}
