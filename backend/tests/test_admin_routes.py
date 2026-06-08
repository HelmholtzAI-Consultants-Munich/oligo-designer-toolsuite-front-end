from datetime import datetime
from unittest.mock import patch

import pytest
from bson import ObjectId

from backend.extensions import db
from backend.utilities.legal import (
    PRIVACY_DOCUMENT_KEY,
    TERMS_DOCUMENT_KEY,
    get_published_legal_document,
)


@pytest.fixture
def admin_user(client):
    """Create an admin user for testing"""
    user_id = ObjectId()
    user = {
        "_id": user_id,
        "username": "admin_user",
        "role": "admin",
        "password": "hashed_password",
    }
    db.users.insert_one(user)
    yield user
    db.users.delete_one({"_id": user_id})


@pytest.fixture
def regular_user(client):
    """Create a regular user for testing"""
    user_id = ObjectId()
    user = {
        "_id": user_id,
        "username": "regular_user",
        "role": "user",
        "password": "hashed_password",
    }
    db.users.insert_one(user)
    yield user
    db.users.delete_one({"_id": user_id})


@pytest.fixture
def admin_client(client, monkeypatch, admin_user):
    """Test client with authenticated admin user"""

    class AdminUser:
        is_authenticated = True
        id = str(admin_user["_id"])

    monkeypatch.setattr("flask_login.utils._get_user", lambda: AdminUser())
    yield client


@pytest.fixture
def regular_client(client, monkeypatch, regular_user):
    """Test client with authenticated regular user"""

    class RegularUser:
        is_authenticated = True
        id = str(regular_user["_id"])

    monkeypatch.setattr("flask_login.utils._get_user", lambda: RegularUser())
    yield client


@pytest.fixture
def unauthenticated_client(client):
    """Test client without authentication (same as base client)"""
    yield client


@pytest.fixture
def pipeline_run(client):
    """Create a pipeline run for testing"""
    run_id = ObjectId()
    user_id = ObjectId()
    run = {
        "_id": run_id,
        "user_id": str(user_id),
        "pipeline": "test_pipeline",
        "status": "pending",
        "timestamp": datetime.now(),
        "created_at": datetime.now(),
        "output_path": "/tmp/test_output",
        "session_id": None,
        "transferred_from_anon": False,
    }
    db.runs.insert_one(run)
    yield run
    db.runs.delete_one({"_id": run_id})


@pytest.fixture
def feedback_document(client):
    """Create a feedback document for testing"""
    feedback_id = ObjectId()
    doc = {
        "_id": feedback_id,
        "message": "Test feedback message",
        "user_id": None,
    }
    db.feedback.insert_one(doc)
    yield doc
    db.feedback.delete_one({"_id": feedback_id})


@pytest.fixture(autouse=True)
def cleanup_legal_documents(client):
    db.legal_documents.delete_many({})
    yield
    db.legal_documents.delete_many({})


# ==================== User Management Tests ====================


def test_get_users_success(admin_client, admin_user, regular_user):
    """Test getting all users as admin"""
    response = admin_client.get("/api/admin/users")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 2
    # Users have id and either username or helmholtz_sub (no longer email-only)
    ids = [u["id"] for u in data]
    assert str(admin_user["_id"]) in ids
    assert str(regular_user["_id"]) in ids


def test_get_users_unauthorized(regular_client):
    """Test that regular users cannot access user list"""
    response = regular_client.get("/api/admin/users")
    assert response.status_code == 403


def test_get_users_unauthenticated(unauthenticated_client):
    """Test that unauthenticated users cannot access user list"""
    response = unauthenticated_client.get("/api/admin/users")
    assert response.status_code == 401 or response.status_code == 403


def test_get_user_success(admin_client, regular_user):
    """Test getting a single user by ID"""
    response = admin_client.get(f"/api/admin/users/{regular_user['_id']}")
    assert response.status_code == 200
    data = response.get_json()
    assert data["id"] == str(regular_user["_id"])
    assert data["role"] == regular_user["role"]
    assert "password" not in data
    # Response includes id, role; may include username and/or helmholtz_sub


def test_get_user_not_found(admin_client):
    """Test getting a non-existent user"""
    fake_id = ObjectId()
    response = admin_client.get(f"/api/admin/users/{fake_id}")
    assert response.status_code == 404


def test_update_user_success(admin_client, regular_user):
    """Test updating a user (username and role; CLI users have username)"""
    # Give regular_user a username so we can update it (CLI user)
    db.users.update_one(
        {"_id": regular_user["_id"]},
        {"$set": {"username": "original_user"}},
    )
    response = admin_client.put(
        f"/api/admin/users/{regular_user['_id']}",
        json={"username": "updated_user", "role": "admin"},
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data.get("username") == "updated_user"
    assert data["role"] == "admin"


def test_update_user_invalid_role(admin_client, regular_user):
    """Test updating user with invalid role"""
    response = admin_client.put(f"/api/admin/users/{regular_user['_id']}", json={"role": "invalid_role"})
    assert response.status_code == 400
    assert "Invalid role" in response.get_json()["error"]


def test_update_user_no_fields(admin_client, regular_user):
    """Test updating user with no fields"""
    response = admin_client.put(f"/api/admin/users/{regular_user['_id']}", json={})
    assert response.status_code == 400


def test_delete_user_success(admin_client, regular_user):
    """Test deleting a user"""
    db.feedback.insert_one(
        {
            "_id": ObjectId(),
            "user_id": str(regular_user["_id"]),
            "message": "Feedback to remove",
        }
    )

    response = admin_client.delete(f"/api/admin/users/{regular_user['_id']}")
    assert response.status_code == 200
    assert "deleted successfully" in response.get_json()["message"]

    # Verify user is deleted
    user = db.users.find_one({"_id": regular_user["_id"]})
    assert user is None
    assert db.feedback.find_one({"user_id": str(regular_user["_id"])}) is None


def test_delete_user_self(admin_client, admin_user):
    """Test that admin cannot delete their own account"""
    response = admin_client.delete(f"/api/admin/users/{admin_user['_id']}")
    assert response.status_code == 400
    assert "Cannot delete your own account" in response.get_json()["error"]


# ==================== Legal Document Tests ====================


def test_get_legal_documents_success(admin_client):
    response = admin_client.get("/api/admin/legal-documents")

    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    document_keys = {item["document"] for item in data}
    assert TERMS_DOCUMENT_KEY in document_keys
    assert PRIVACY_DOCUMENT_KEY in document_keys
    assert all(item["published"] is not None for item in data)


def test_get_legal_document_detail_success(admin_client):
    response = admin_client.get(f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}")

    assert response.status_code == 200
    data = response.get_json()
    assert data["document"] == TERMS_DOCUMENT_KEY
    assert len(data["history"]) >= 1
    assert data["history"][0]["id"] == data["published"]["id"]
    assert "status" not in data["published"]


def test_publish_legal_document_success(admin_client):
    response = admin_client.post(
        f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}/publish",
        json={
            "body": "# Terms of Service\n\n## Scope\n\nUpdated legal paragraph.",
        },
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["published"]["version"] is not None
    assert "Updated legal paragraph." in data["published"]["body"]
    assert len(data["history"]) >= 2
    assert data["history"][0]["id"] == data["published"]["id"]
    assert all("status" not in item for item in data["history"])


def test_publish_legal_document_requires_new_content(admin_client):
    response = admin_client.post(
        f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}/publish",
        json={
            "body": get_published_legal_document(TERMS_DOCUMENT_KEY)["body"],
        },
    )

    assert response.status_code == 400
    assert "currently published version" in response.get_json()["error"]


def test_legal_document_admin_routes_unauthorized(regular_client):
    response = regular_client.get("/api/admin/legal-documents")
    assert response.status_code == 403


# ==================== Pipeline Management Tests ====================


def test_get_pipeline_runs_success(admin_client, pipeline_run):
    """Test getting all pipeline runs"""
    response = admin_client.get("/api/admin/pipelines")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1
    run_ids = [run["id"] for run in data]
    assert str(pipeline_run["_id"]) in run_ids


def test_update_pipeline_status_success(admin_client, pipeline_run):
    """Test updating pipeline run status"""
    response = admin_client.put(f"/api/admin/pipelines/{pipeline_run['_id']}", json={"status": "success"})
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"


def test_update_pipeline_status_invalid(admin_client, pipeline_run):
    """Test updating pipeline run with invalid status"""
    response = admin_client.put(
        f"/api/admin/pipelines/{pipeline_run['_id']}", json={"status": "invalid_status"}
    )
    assert response.status_code == 400
    assert "Invalid status" in response.get_json()["error"]


def test_update_pipeline_status_missing_field(admin_client, pipeline_run):
    """Test updating pipeline run without status field"""
    response = admin_client.put(f"/api/admin/pipelines/{pipeline_run['_id']}", json={})
    assert response.status_code == 400


def test_delete_pipeline_run_success(admin_client, pipeline_run):
    """Test deleting a pipeline run"""
    with patch("shutil.rmtree"):
        response = admin_client.delete(f"/api/admin/pipelines/{pipeline_run['_id']}")
        assert response.status_code == 200
        assert "deleted successfully" in response.get_json()["message"]


def test_delete_pipeline_run_not_found(admin_client):
    """Test deleting a non-existent pipeline run"""
    fake_id = ObjectId()
    response = admin_client.delete(f"/api/admin/pipelines/{fake_id}")
    assert response.status_code == 404


def test_get_pipeline_runs_unauthorized(regular_client):
    """Test that regular users cannot access pipeline runs list"""
    response = regular_client.get("/api/admin/pipelines")
    assert response.status_code == 403


def test_get_pipeline_runs_unauthenticated(unauthenticated_client):
    """Test that unauthenticated users cannot access pipeline runs list"""
    response = unauthenticated_client.get("/api/admin/pipelines")
    assert response.status_code == 401 or response.status_code == 403


def test_update_pipeline_status_unauthorized(regular_client, pipeline_run):
    """Test that regular users cannot update pipeline run status"""
    response = regular_client.put(f"/api/admin/pipelines/{pipeline_run['_id']}", json={"status": "success"})
    assert response.status_code == 403


def test_update_pipeline_status_unauthenticated(unauthenticated_client, pipeline_run):
    """Test that unauthenticated users cannot update pipeline run status"""
    response = unauthenticated_client.put(
        f"/api/admin/pipelines/{pipeline_run['_id']}", json={"status": "success"}
    )
    assert response.status_code == 401 or response.status_code == 403


def test_delete_pipeline_run_unauthorized(regular_client, pipeline_run):
    """Test that regular users cannot delete pipeline runs"""
    response = regular_client.delete(f"/api/admin/pipelines/{pipeline_run['_id']}")
    assert response.status_code == 403


def test_delete_pipeline_run_unauthenticated(unauthenticated_client, pipeline_run):
    """Test that unauthenticated users cannot delete pipeline runs"""
    response = unauthenticated_client.delete(f"/api/admin/pipelines/{pipeline_run['_id']}")
    assert response.status_code == 401 or response.status_code == 403


# ==================== Dashboard Tests ====================


def test_get_dashboard_stats_success(admin_client, admin_user, regular_user, pipeline_run):
    """Test getting dashboard statistics"""
    response = admin_client.get("/api/admin/dashboard")
    assert response.status_code == 200
    data = response.get_json()

    assert "users" in data
    assert data["users"]["total"] >= 2
    assert data["users"]["admin"] >= 1
    assert data["users"]["regular"] >= 1

    assert "pipeline_runs" in data
    assert data["pipeline_runs"]["total"] >= 1
    assert "by_status" in data["pipeline_runs"]
    assert "pending" in data["pipeline_runs"]["by_status"]


def test_get_dashboard_stats_unauthorized(regular_client):
    """Test that regular users cannot access dashboard statistics"""
    response = regular_client.get("/api/admin/dashboard")
    assert response.status_code == 403


def test_get_dashboard_stats_unauthenticated(unauthenticated_client):
    """Test that unauthenticated users cannot access dashboard statistics"""
    response = unauthenticated_client.get("/api/admin/dashboard")
    assert response.status_code == 401 or response.status_code == 403


# ==================== Feedback Tests ====================


def test_get_feedback_success(admin_client, feedback_document):
    """Test getting all feedback entries"""
    response = admin_client.get("/api/admin/feedback")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1
    ids = [item["id"] for item in data]
    assert str(feedback_document["_id"]) in ids


def test_get_feedback_unauthorized(regular_client):
    """Test that regular users cannot access feedback list"""
    response = regular_client.get("/api/admin/feedback")
    assert response.status_code == 403


def test_get_feedback_unauthenticated(unauthenticated_client):
    """Test that unauthenticated users cannot access feedback list"""
    response = unauthenticated_client.get("/api/admin/feedback")
    assert response.status_code == 401 or response.status_code == 403


# ==================== Monthly Report Tests ====================


def test_trigger_monthly_report_success(admin_client):
    """Test triggering monthly report generation for a specific month."""
    with patch("backend.routes.admin.celery_app.send_task") as mock_send_task:
        response = admin_client.post("/api/admin/reports/generate", json={"year": 2026, "month": 3})

    assert response.status_code == 202
    mock_send_task.assert_called_once_with(
        "backend.worker.tasks.generate_monthly_report",
        kwargs={"target_year": 2026, "target_month": 3},
    )


def test_trigger_monthly_report_without_payload_uses_default_schedule(admin_client):
    """Test triggering monthly report generation without an explicit period."""
    with patch("backend.routes.admin.celery_app.send_task") as mock_send_task:
        response = admin_client.post("/api/admin/reports/generate", json={})

    assert response.status_code == 202
    mock_send_task.assert_called_once_with("backend.worker.tasks.generate_monthly_report", kwargs={})


def test_trigger_monthly_report_rejects_invalid_month(admin_client):
    """Test invalid month values are rejected before queueing a task."""
    with patch("backend.routes.admin.celery_app.send_task") as mock_send_task:
        response = admin_client.post("/api/admin/reports/generate", json={"year": 2026, "month": 13})

    assert response.status_code == 400
    assert "Month must be between 1 and 12" in response.get_json()["error"]
    mock_send_task.assert_not_called()


def test_trigger_monthly_report_rejects_current_month(admin_client):
    """Test current-month report generation is rejected."""
    today = datetime.now()
    with patch("backend.routes.admin.celery_app.send_task") as mock_send_task:
        response = admin_client.post(
            "/api/admin/reports/generate",
            json={"year": today.year, "month": today.month},
        )

    assert response.status_code == 400
    assert "Cannot generate reports for the current or future month" in response.get_json()["error"]
    mock_send_task.assert_not_called()


def test_trigger_monthly_report_rejects_non_integer_values(admin_client):
    """Test malformed year/month values return a validation error."""
    with patch("backend.routes.admin.celery_app.send_task") as mock_send_task:
        response = admin_client.post(
            "/api/admin/reports/generate", json={"year": "two thousand", "month": "3"}
        )

    assert response.status_code == 400
    assert "Year and month must be valid integers" in response.get_json()["error"]
    mock_send_task.assert_not_called()


def test_trigger_monthly_report_requires_both_year_and_month(admin_client):
    """Test partial monthly report payloads are rejected."""
    with patch("backend.routes.admin.celery_app.send_task") as mock_send_task:
        response = admin_client.post("/api/admin/reports/generate", json={"year": 2026})

    assert response.status_code == 400
    assert "Year and month must both be provided" in response.get_json()["error"]
    mock_send_task.assert_not_called()


# ==================== Bulk Operations Tests ====================


@pytest.fixture
def create_test_user(client):
    """Factory fixture to create test users"""

    def _create_user(user_id=None, role="user"):
        """Helper function to create a test user"""
        if user_id is None:
            user_id = ObjectId()
        user = {
            "_id": user_id,
            "username": f"user{user_id}",
            "role": role,
            "password": "hashed",
        }
        db.users.insert_one(user)
        return user_id

    return _create_user


def test_bulk_delete_users_success(admin_client, regular_user, create_test_user):
    """Test bulk deleting users"""
    # Create additional users
    user2_id = create_test_user()
    db.feedback.insert_many(
        [
            {"_id": ObjectId(), "user_id": str(regular_user["_id"]), "message": "Feedback 1"},
            {"_id": ObjectId(), "user_id": str(user2_id), "message": "Feedback 2"},
        ]
    )

    try:
        response = admin_client.post(
            "/api/admin/users/bulk-delete", json={"user_ids": [str(regular_user["_id"]), str(user2_id)]}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["deleted_count"] == 2
        assert db.feedback.find_one({"user_id": str(regular_user["_id"])}) is None
        assert db.feedback.find_one({"user_id": str(user2_id)}) is None
    finally:
        db.users.delete_one({"_id": user2_id})


def test_bulk_delete_users_empty_array(admin_client):
    """Test bulk delete with empty array"""
    response = admin_client.post("/api/admin/users/bulk-delete", json={"user_ids": []})
    assert response.status_code == 400


def test_bulk_delete_users_invalid_format(admin_client):
    """Test bulk delete with invalid format"""
    response = admin_client.post("/api/admin/users/bulk-delete", json={"user_ids": "not_an_array"})
    assert response.status_code == 400


def test_bulk_delete_users_self(admin_client, admin_user, create_test_user):
    """Test bulk delete including self (should skip)"""
    user2_id = create_test_user()

    try:
        response = admin_client.post(
            "/api/admin/users/bulk-delete", json={"user_ids": [str(admin_user["_id"]), str(user2_id)]}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["deleted_count"] == 1
        assert "skipped" in data
    finally:
        db.users.delete_one({"_id": user2_id})


def test_bulk_update_user_role_success(admin_client, regular_user, create_test_user):
    """Test bulk updating user roles"""
    user2_id = create_test_user()

    try:
        response = admin_client.post(
            "/api/admin/users/bulk-update-role",
            json={"user_ids": [str(regular_user["_id"]), str(user2_id)], "role": "admin"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["updated_count"] == 2

        # Verify roles were updated
        updated_user = db.users.find_one({"_id": regular_user["_id"]})
        assert updated_user["role"] == "admin"
    finally:
        db.users.delete_one({"_id": user2_id})


def test_bulk_update_user_role_invalid_role(admin_client, regular_user):
    """Test bulk update with invalid role"""
    response = admin_client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [str(regular_user["_id"])], "role": "invalid"}
    )
    assert response.status_code == 400


def test_bulk_update_user_role_self_demotion(admin_client, admin_user):
    """Test bulk update preventing self-demotion"""
    response = admin_client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [str(admin_user["_id"])], "role": "user"}
    )
    # When trying to demote yourself and you're the only user, filtered_user_ids is empty
    # so the endpoint returns 400
    assert response.status_code == 400
    assert "Cannot demote your own admin account" in response.get_json()["error"]


def test_bulk_delete_users_unauthorized(regular_client, regular_user):
    """Test that regular users cannot bulk delete users"""
    response = regular_client.post(
        "/api/admin/users/bulk-delete", json={"user_ids": [str(regular_user["_id"])]}
    )
    assert response.status_code == 403


def test_bulk_delete_users_unauthenticated(unauthenticated_client):
    """Test that unauthenticated users cannot bulk delete users"""
    fake_id = ObjectId()
    response = unauthenticated_client.post("/api/admin/users/bulk-delete", json={"user_ids": [str(fake_id)]})
    assert response.status_code == 401 or response.status_code == 403


def test_bulk_update_user_role_unauthorized(regular_client, regular_user):
    """Test that regular users cannot bulk update user roles"""
    response = regular_client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [str(regular_user["_id"])], "role": "admin"}
    )
    assert response.status_code == 403


def test_bulk_update_user_role_unauthenticated(unauthenticated_client):
    """Test that unauthenticated users cannot bulk update user roles"""
    fake_id = ObjectId()
    response = unauthenticated_client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [str(fake_id)], "role": "admin"}
    )
    assert response.status_code == 401 or response.status_code == 403


@pytest.fixture
def create_test_run(client):
    """Factory fixture to create test pipeline runs"""

    def _create_run(run_id=None, pipeline="test_pipeline2", status="pending"):
        """Helper function to create a test pipeline run"""
        if run_id is None:
            run_id = ObjectId()
        run = {
            "_id": run_id,
            "pipeline": pipeline,
            "status": status,
            "output_path": f"/tmp/test_output_{run_id}",
        }
        db.runs.insert_one(run)
        return run_id

    return _create_run


def test_bulk_delete_pipeline_runs_success(admin_client, pipeline_run, create_test_run):
    """Test bulk deleting pipeline runs"""
    run2_id = create_test_run()

    try:
        with patch("shutil.rmtree"):
            response = admin_client.post(
                "/api/admin/pipelines/bulk-delete", json={"run_ids": [str(pipeline_run["_id"]), str(run2_id)]}
            )
            assert response.status_code == 200
            data = response.get_json()
            assert data["deleted_count"] == 2
    finally:
        db.runs.delete_one({"_id": run2_id})


def test_bulk_delete_pipeline_runs_invalid_ids(admin_client):
    """Test bulk delete with invalid IDs"""
    response = admin_client.post(
        "/api/admin/pipelines/bulk-delete", json={"run_ids": ["invalid_id", "another_invalid"]}
    )
    # When all IDs are invalid, object_ids is empty, so the endpoint returns 400
    assert response.status_code == 400
    assert "No valid run IDs provided" in response.get_json()["error"]


def test_bulk_delete_pipeline_runs_unauthorized(regular_client, pipeline_run):
    """Test that regular users cannot bulk delete pipeline runs"""
    response = regular_client.post(
        "/api/admin/pipelines/bulk-delete", json={"run_ids": [str(pipeline_run["_id"])]}
    )
    assert response.status_code == 403


def test_bulk_delete_pipeline_runs_unauthenticated(unauthenticated_client):
    """Test that unauthenticated users cannot bulk delete pipeline runs"""
    fake_id = ObjectId()
    response = unauthenticated_client.post(
        "/api/admin/pipelines/bulk-delete", json={"run_ids": [str(fake_id)]}
    )
    assert response.status_code == 401 or response.status_code == 403


def test_bulk_update_pipeline_status_success(admin_client, pipeline_run, create_test_run):
    """Test bulk updating pipeline run status"""
    run2_id = create_test_run()

    try:
        response = admin_client.post(
            "/api/admin/pipelines/bulk-update-status",
            json={"run_ids": [str(pipeline_run["_id"]), str(run2_id)], "status": "success"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["updated_count"] == 2

        # Verify statuses were updated
        updated_run = db.runs.find_one({"_id": pipeline_run["_id"]})
        assert updated_run["status"] == "success"
    finally:
        db.runs.delete_one({"_id": run2_id})


def test_bulk_update_pipeline_status_invalid_status(admin_client, pipeline_run):
    """Test bulk update with invalid status"""
    response = admin_client.post(
        "/api/admin/pipelines/bulk-update-status",
        json={"run_ids": [str(pipeline_run["_id"])], "status": "invalid_status"},
    )
    assert response.status_code == 400


def test_bulk_update_pipeline_status_missing_status(admin_client, pipeline_run):
    """Test bulk update without status field"""
    response = admin_client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [str(pipeline_run["_id"])]}
    )
    assert response.status_code == 400


def test_bulk_update_pipeline_status_empty_run_ids(admin_client):
    """Test bulk update with empty run_ids"""
    response = admin_client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [], "status": "success"}
    )
    assert response.status_code == 400


def test_bulk_update_pipeline_status_unauthorized(regular_client, pipeline_run):
    """Test that regular users cannot bulk update pipeline run status"""
    response = regular_client.post(
        "/api/admin/pipelines/bulk-update-status",
        json={"run_ids": [str(pipeline_run["_id"])], "status": "success"},
    )
    assert response.status_code == 403


def test_bulk_update_pipeline_status_unauthenticated(unauthenticated_client):
    """Test that unauthenticated users cannot bulk update pipeline run status"""
    fake_id = ObjectId()
    response = unauthenticated_client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [str(fake_id)], "status": "success"}
    )
    assert response.status_code == 401 or response.status_code == 403
