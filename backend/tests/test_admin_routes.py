from datetime import datetime
from unittest.mock import patch

import pytest
from bson import ObjectId

from backend.extensions import mongo


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
    mongo.db.users.insert_one(user)
    yield user
    mongo.db.users.delete_one({"_id": user_id})


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
    mongo.db.users.insert_one(user)
    yield user
    mongo.db.users.delete_one({"_id": user_id})


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
        "timestamp": "2025-01-01_12-00-00",
        "created_at": datetime.now(),
        "output_path": "/tmp/test_output",
        "session_id": None,
        "transferred_from_anon": False,
    }
    mongo.db.runs.insert_one(run)
    yield run
    mongo.db.runs.delete_one({"_id": run_id})


@pytest.fixture
def feedback_document(client):
    """Create a feedback document for testing"""
    feedback_id = ObjectId()
    doc = {
        "_id": feedback_id,
        "message": "Test feedback message",
        "user_id": None,
    }
    mongo.db.feedback.insert_one(doc)
    yield doc
    mongo.db.feedback.delete_one({"_id": feedback_id})


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
    mongo.db.users.update_one(
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
    response = admin_client.delete(f"/api/admin/users/{regular_user['_id']}")
    assert response.status_code == 200
    assert "deleted successfully" in response.get_json()["message"]

    # Verify user is deleted
    user = mongo.db.users.find_one({"_id": regular_user["_id"]})
    assert user is None


def test_delete_user_self(admin_client, admin_user):
    """Test that admin cannot delete their own account"""
    response = admin_client.delete(f"/api/admin/users/{admin_user['_id']}")
    assert response.status_code == 400
    assert "Cannot delete your own account" in response.get_json()["error"]


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
        mongo.db.users.insert_one(user)
        return user_id

    return _create_user


def test_bulk_delete_users_success(admin_client, regular_user, create_test_user):
    """Test bulk deleting users"""
    # Create additional users
    user2_id = create_test_user()

    try:
        response = admin_client.post(
            "/api/admin/users/bulk-delete", json={"user_ids": [str(regular_user["_id"]), str(user2_id)]}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["deleted_count"] == 2
    finally:
        mongo.db.users.delete_one({"_id": user2_id})


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
        mongo.db.users.delete_one({"_id": user2_id})


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
        updated_user = mongo.db.users.find_one({"_id": regular_user["_id"]})
        assert updated_user["role"] == "admin"
    finally:
        mongo.db.users.delete_one({"_id": user2_id})


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
        mongo.db.runs.insert_one(run)
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
        mongo.db.runs.delete_one({"_id": run2_id})


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
        updated_run = mongo.db.runs.find_one({"_id": pipeline_run["_id"]})
        assert updated_run["status"] == "success"
    finally:
        mongo.db.runs.delete_one({"_id": run2_id})


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
