from pathlib import Path

import pytest
from bson import ObjectId
from werkzeug.security import generate_password_hash

from backend.extensions import db
from backend.tests.conftest import get_with_check
from backend.utilities.legal import (
    PRIVACY_DOCUMENT_KEY,
    TERMS_DOCUMENT_KEY,
    get_published_legal_document,
)
from backend.utilities.typed_values import serialize_path, utc_now


@pytest.fixture
def legal_user_doc():
    return {
        "_id": ObjectId(),
        "username": "testuser",
        "password": generate_password_hash("mypassword"),
        "role": "user",
    }


def test_accept_terms_updates_current_user(client, authenticate_as_user, legal_user_doc):
    db.users.insert_one(legal_user_doc)
    authenticate_as_user(str(legal_user_doc["_id"]))

    with client.session_transaction() as sess:
        sess["_user_id"] = str(legal_user_doc["_id"])

    response = client.post("/api/legal/terms/accept")

    assert response.status_code == 200
    data = response.get_json()
    assert (
        data["legal"]["accepted_terms_version"] == get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]
    )
    assert data["legal"]["terms_accepted_at"] is not None

    updated_user = get_with_check({"_id": legal_user_doc["_id"]}, db.users)
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
    assert (
        data["legal"]["accepted_terms_version"] == get_published_legal_document(TERMS_DOCUMENT_KEY)["version"]
    )
    assert data["legal"]["accepted_terms_version"] == data["legal"]["current_terms_version"]


def test_delete_account_removes_user_data(client, authenticate_as_user, legal_user_doc, tmp_path):
    db.users.insert_one(legal_user_doc)
    authenticate_as_user(str(legal_user_doc["_id"]))

    upload_root = tmp_path / "uploads"
    upload_root.mkdir()
    userdata_root = tmp_path / "user_data"
    user_dir = userdata_root / str(legal_user_doc["_id"])
    user_dir.mkdir(parents=True)
    (user_dir / "profile.txt").write_text("sensitive")

    output_dir = user_dir / "output_scrinshot_probe_designer_test"
    output_dir.mkdir()
    (output_dir / "result.txt").write_text("output")

    upload_file = upload_root / "upload.txt"
    upload_file.write_text("upload")

    db.runs.insert_one(
        {
            "_id": ObjectId(),
            "user_id": str(legal_user_doc["_id"]),
            "pipeline": "scrinshot",
            "status": "success",
            "timestamp": utc_now(),
            "output_path": serialize_path(output_dir),
        }
    )
    db.uploads.insert_one({"user_id": str(legal_user_doc["_id"]), "path": str(upload_file)})
    db.feedback.insert_one(
        {"user_id": str(legal_user_doc["_id"]), "message": "feedback", "created_at": utc_now()}
    )
    db.legal_acceptances.insert_one(
        {
            "user_id": str(legal_user_doc["_id"]),
            "document": TERMS_DOCUMENT_KEY,
            "terms_version": get_published_legal_document(TERMS_DOCUMENT_KEY)["version"],
            "timestamp": utc_now(),
        }
    )

    client.application.config["UPLOAD_PATH"] = str(upload_root)
    client.application.config["USERDATA_PATH"] = str(userdata_root)

    with client.session_transaction() as sess:
        sess["_user_id"] = str(legal_user_doc["_id"])

    response = client.delete("/api/account")

    assert response.status_code == 200
    assert response.get_json()["message"] == "Your account and associated data have been deleted."
    assert db.users.find_one({"_id": legal_user_doc["_id"]}) is None
    assert db.runs.find_one({"user_id": str(legal_user_doc["_id"])}) is None
    assert db.uploads.find_one({"user_id": str(legal_user_doc["_id"])}) is None
    assert db.feedback.find_one({"user_id": str(legal_user_doc["_id"])}) is None
    assert db.legal_acceptances.find_one({"user_id": str(legal_user_doc["_id"])}) is None
    assert not Path(upload_file).exists()
    assert not user_dir.exists()


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
