"""Admin route tests.

The fixtures in this module are intentionally role-specific: admin endpoints
read the persisted user role from MongoDB, so tests need real admin and regular
user documents rather than only a patched Flask-Login user.
"""

import datetime
from unittest.mock import patch

import pytest
from bson import ObjectId

from backend.extensions import mongo
from backend.tests.conftest import TEST_USER_ID
from backend.utilities.legal import TERMS_DOCUMENT_KEY
from backend.utilities.typed_values import serialize_path, utc_now


@pytest.fixture
def admin_user(authenticate_as):
    """Create a persisted admin and authenticate the Flask test client as it."""
    user_id = ObjectId(TEST_USER_ID)
    mongo.db.users.insert_one({"_id": user_id, "username": "admin", "role": "admin", "password": "hash"})
    authenticate_as(str(user_id))
    return {"_id": user_id, "id": str(user_id)}


@pytest.fixture
def regular_user():
    """Create a persisted non-admin user for authorization and mutation tests."""
    user_id = ObjectId()
    mongo.db.users.insert_one({"_id": user_id, "username": "regular", "role": "user", "password": "hash"})
    return {"_id": user_id, "id": str(user_id)}


@pytest.fixture
def regular_client(client, authenticate_as, regular_user):
    """Return the Flask test client authenticated as a non-admin user."""
    authenticate_as(regular_user["id"])
    return client


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/admin/users"),
        ("get", "/api/admin/dashboard"),
        ("get", "/api/admin/pipelines"),
        ("get", "/api/admin/feedback"),
    ],
)
def test_admin_endpoint_requires_admin(regular_client, method, path):
    response = getattr(regular_client, method)(path)

    assert response.status_code == 403


def test_admin_get_users_success(client, admin_user, regular_user):
    response = client.get("/api/admin/users")

    assert response.status_code == 200
    assert {item["id"] for item in response.get_json()} == {admin_user["id"], regular_user["id"]}


def test_admin_get_users_unauthenticated(client):
    response = client.get("/api/admin/users")

    assert response.status_code in {401, 403}


def test_admin_get_user_success(client, admin_user, regular_user):
    response = client.get(f"/api/admin/users/{regular_user['id']}")

    assert response.status_code == 200
    assert response.get_json()["id"] == regular_user["id"]
    assert "password" not in response.get_json()


def test_admin_get_user_not_found(client, admin_user):
    response = client.get(f"/api/admin/users/{ObjectId()}")

    assert response.status_code == 404


def test_admin_update_user_role_success(client, admin_user, regular_user):
    response = client.put(f"/api/admin/users/{regular_user['id']}", json={"role": "admin"})

    assert response.status_code == 200
    assert response.get_json()["role"] == "admin"


def test_admin_update_user_rejects_invalid_role(client, admin_user, regular_user):
    response = client.put(f"/api/admin/users/{regular_user['id']}", json={"role": "owner"})

    assert response.status_code == 400


def test_admin_update_user_rejects_empty_payload(client, admin_user, regular_user):
    response = client.put(f"/api/admin/users/{regular_user['id']}", json={})

    assert response.status_code == 400


def test_admin_delete_user_success(client, admin_user, regular_user, test_data_roots):
    """Deleting a user removes the account plus tracked upload/run files."""
    user_dir = test_data_roots.user_data / regular_user["id"]
    # regular_user has a random id, so create its directory explicitly to prove deletion removes it.
    user_dir.mkdir()
    upload_file = test_data_roots.uploads / "upload.txt"
    upload_file.write_text("upload")
    output_dir = user_dir / "output"
    output_dir.mkdir()
    mongo.db.uploads.insert_one({"_id": ObjectId(), "user_id": regular_user["id"], "path": str(upload_file)})
    mongo.db.runs.insert_one(
        {"_id": ObjectId(), "user_id": regular_user["id"], "output_path": serialize_path(output_dir)}
    )

    response = client.delete(f"/api/admin/users/{regular_user['id']}")

    assert response.status_code == 200
    assert mongo.db.users.find_one({"_id": regular_user["_id"]}) is None
    assert not upload_file.exists()
    assert not user_dir.exists()


def test_admin_delete_user_rejects_self_delete(client, admin_user):
    response = client.delete(f"/api/admin/users/{admin_user['id']}")

    assert response.status_code == 400


def test_admin_legal_documents_list_success(client, admin_user):
    response = client.get("/api/admin/legal-documents")

    assert response.status_code == 200
    assert {item["document"] for item in response.get_json()} >= {"terms", "privacy-policy"}


def test_admin_legal_document_detail_success(client, admin_user):
    response = client.get(f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}")

    assert response.status_code == 200
    assert response.get_json()["document"] == TERMS_DOCUMENT_KEY


def test_admin_publish_legal_document_success(client, admin_user):
    response = client.post(
        f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}/publish",
        json={"body": "# Terms\n\nNew body"},
    )

    assert response.status_code == 200
    assert "New body" in response.get_json()["published"]["body"]


def test_admin_publish_legal_document_requires_new_content(client, admin_user):
    current = client.get(f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}").get_json()["published"]["body"]

    response = client.post(f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}/publish", json={"body": current})

    assert response.status_code == 400


def test_admin_get_pipeline_runs_success(client, admin_user):
    run_id = mongo.db.runs.insert_one(
        {"pipeline": "merfish", "status": "pending", "created_at": utc_now()}
    ).inserted_id

    response = client.get("/api/admin/pipelines")

    assert response.status_code == 200
    assert response.get_json()[0]["id"] == str(run_id)


def test_admin_update_pipeline_status_success(client, admin_user):
    run_id = mongo.db.runs.insert_one({"status": "pending", "pipeline": "merfish"}).inserted_id

    response = client.put(f"/api/admin/pipelines/{run_id}", json={"status": "success"})

    assert response.status_code == 200
    assert mongo.db.runs.find_one({"_id": run_id})["status"] == "success"


def test_admin_update_pipeline_status_rejects_invalid_status(client, admin_user):
    run_id = mongo.db.runs.insert_one({"status": "pending"}).inserted_id

    response = client.put(f"/api/admin/pipelines/{run_id}", json={"status": "bogus"})

    assert response.status_code == 400


def test_admin_delete_pipeline_run_success(client, admin_user, tmp_path):
    """Admin run deletion removes both MongoDB state and output directory."""
    output = tmp_path / "output"
    output.mkdir()
    run_id = mongo.db.runs.insert_one(
        {"status": "pending", "output_path": serialize_path(output)}
    ).inserted_id

    response = client.delete(f"/api/admin/pipelines/{run_id}")

    assert response.status_code == 200
    assert not output.exists()
    assert mongo.db.runs.find_one({"_id": run_id}) is None


def test_admin_dashboard_stats_success(client, admin_user, regular_user):
    mongo.db.runs.insert_many([{"status": "pending"}, {"status": "success"}])

    response = client.get("/api/admin/dashboard")

    assert response.status_code == 200
    assert response.get_json()["users"]["total"] == 2
    assert response.get_json()["pipeline_runs"]["by_status"]["pending"] == 1


def test_admin_feedback_list_success(client, admin_user):
    mongo.db.feedback.insert_one({"_id": ObjectId(), "message": "hello", "created_at": utc_now()})

    response = client.get("/api/admin/feedback")

    assert response.status_code == 200
    assert response.get_json()[0]["message"] == "hello"


def _monthly_report_doc(report_id: str, year: int, month: int) -> dict:
    return {
        "_id": report_id,
        "year": year,
        "month": month,
        "generated_at": utc_now(),
        "generated_by": "manual",
        "users": {"new_registrations": 1, "active": 2},
        "runs": {"total": 3},
        "conversions": {"anon_to_registered": 1},
        "feedback": {"total": 4},
    }


def test_admin_monthly_reports_list_success(client, admin_user):
    mongo.db.monthly_reports.insert_many(
        [
            _monthly_report_doc("2026-03", 2026, 3),
            _monthly_report_doc("2026-04", 2026, 4),
        ]
    )

    response = client.get("/api/admin/reports")

    assert response.status_code == 200
    assert [report["id"] for report in response.get_json()] == ["2026-04", "2026-03"]


def test_admin_monthly_report_detail_success(client, admin_user):
    mongo.db.monthly_reports.insert_one(_monthly_report_doc("2026-04", 2026, 4))

    response = client.get("/api/admin/reports?year=2026&month=4")

    assert response.status_code == 200
    assert response.get_json()["id"] == "2026-04"


def test_admin_monthly_report_detail_not_found(client, admin_user):
    response = client.get("/api/admin/reports?year=2026&month=4")

    assert response.status_code == 404


def test_admin_delete_monthly_report_success(client, admin_user):
    mongo.db.monthly_reports.insert_one(_monthly_report_doc("2026-04", 2026, 4))

    response = client.delete("/api/admin/reports/2026-04")

    assert response.status_code == 200
    assert mongo.db.monthly_reports.find_one({"_id": "2026-04"}) is None


def test_admin_delete_monthly_report_not_found(client, admin_user):
    response = client.delete("/api/admin/reports/2026-04")

    assert response.status_code == 404


def test_admin_trigger_monthly_report_success(client, admin_user):
    """Manual report generation accepts a completed past month only."""

    class FixedDate(datetime.date):
        @classmethod
        def today(cls):
            return cls(2026, 5, 27)

    with (
        patch("backend.routes.admin.datetime.date", FixedDate),
        patch("backend.routes.admin.celery_app.send_task") as send_task,
    ):
        response = client.post("/api/admin/reports/generate", json={"year": 2026, "month": 4})

    assert response.status_code == 202
    assert send_task.call_args.kwargs["kwargs"] == {"target_year": 2026, "target_month": 4}


def test_admin_trigger_monthly_report_default_schedule(client, admin_user):
    with patch("backend.routes.admin.celery_app.send_task") as send_task:
        response = client.post("/api/admin/reports/generate", json={})

    assert response.status_code == 202
    assert send_task.call_args.kwargs["kwargs"] == {}


@pytest.mark.parametrize(
    "payload",
    [
        {"year": 2026, "month": 13},
        {"year": "bad", "month": 1},
        {"year": 2026},
        {"month": 1},
    ],
)
def test_admin_trigger_monthly_report_rejects_invalid_payloads(client, admin_user, payload):
    response = client.post("/api/admin/reports/generate", json=payload)

    assert response.status_code == 400


def test_admin_trigger_monthly_report_rejects_current_month(client, admin_user):
    """Current-month reports are rejected because the reporting period is incomplete."""

    class FixedDate(datetime.date):
        @classmethod
        def today(cls):
            return cls(2026, 5, 27)

    with patch("backend.routes.admin.datetime.date", FixedDate):
        response = client.post("/api/admin/reports/generate", json={"year": 2026, "month": 5})

    assert response.status_code == 400


def test_admin_bulk_delete_users_success(client, admin_user, regular_user):
    response = client.post("/api/admin/users/bulk-delete", json={"user_ids": [regular_user["id"]]})

    assert response.status_code == 200
    assert response.get_json()["deleted_count"] == 1


def test_admin_bulk_delete_users_rejects_empty_array(client, admin_user):
    response = client.post("/api/admin/users/bulk-delete", json={"user_ids": []})

    assert response.status_code == 400


def test_admin_bulk_delete_users_rejects_self(client, admin_user):
    response = client.post("/api/admin/users/bulk-delete", json={"user_ids": [admin_user["id"]]})

    assert response.status_code == 400


def test_admin_bulk_update_user_role_success(client, admin_user, regular_user):
    response = client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [regular_user["id"]], "role": "admin"}
    )

    assert response.status_code == 200
    assert mongo.db.users.find_one({"_id": regular_user["_id"]})["role"] == "admin"


def test_admin_bulk_update_user_role_rejects_invalid_role(client, admin_user, regular_user):
    response = client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [regular_user["id"]], "role": "owner"}
    )

    assert response.status_code == 400


def test_admin_bulk_update_user_role_rejects_self_demotion(client, admin_user):
    response = client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [admin_user["id"]], "role": "user"}
    )

    assert response.status_code == 400


def test_admin_bulk_delete_pipeline_runs_success(client, admin_user):
    run_id = mongo.db.runs.insert_one({"status": "pending"}).inserted_id

    response = client.post("/api/admin/pipelines/bulk-delete", json={"run_ids": [str(run_id)]})

    assert response.status_code == 200
    assert response.get_json()["deleted_count"] == 1


def test_admin_bulk_delete_pipeline_runs_rejects_invalid_ids(client, admin_user):
    response = client.post("/api/admin/pipelines/bulk-delete", json={"run_ids": ["not-an-id"]})

    assert response.status_code == 400


def test_admin_bulk_update_pipeline_status_success(client, admin_user):
    run_id = mongo.db.runs.insert_one({"status": "pending"}).inserted_id

    response = client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [str(run_id)], "status": "success"}
    )

    assert response.status_code == 200
    assert mongo.db.runs.find_one({"_id": run_id})["status"] == "success"


def test_admin_bulk_update_pipeline_status_rejects_invalid_status(client, admin_user):
    response = client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [str(ObjectId())], "status": "bogus"}
    )

    assert response.status_code == 400


def test_admin_bulk_update_pipeline_status_rejects_empty_run_ids(client, admin_user):
    response = client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [], "status": "success"}
    )

    assert response.status_code == 400
