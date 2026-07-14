"""Admin route tests.

Notes:
    The fixtures in this module are intentionally role-specific: admin endpoints
    read the persisted user role from MongoDB, so tests need real admin and regular
    user documents rather than only a patched Flask-Login user.
"""

import datetime
from unittest.mock import patch

import pytest
from bson import ObjectId

from backend.extensions import db
from backend.tests.conftest import TEST_USER_ID
from backend.utilities.legal import TERMS_DOCUMENT_KEY
from backend.utilities.typed_values import serialize_path
from backend.utils import utc_now


@pytest.fixture
def admin_user(authenticate_as):
    """Persist a real admin document and authenticate as that user.

    Notes:
        Admin endpoints verify role from MongoDB, not Flask-Login alone, so a
        real document is required rather than just a patched current_user.

    Returns:
        dict -- admin identity with `_id` (ObjectId) and `id` (str) for use in route assertions
    """
    user_id = ObjectId(TEST_USER_ID)
    db.users.insert_one({"_id": user_id, "username": "admin", "role": "admin", "password": "hash"})
    authenticate_as(str(user_id))
    return {"_id": user_id, "id": str(user_id)}


@pytest.fixture
def regular_user():
    """Persist a second user without admin privileges for authorization and mutation tests.

    Returns:
        dict -- regular user identity with `_id` (ObjectId) and `id` (str) for use in route assertions
    """
    user_id = ObjectId()
    db.users.insert_one({"_id": user_id, "username": "regular", "role": "user", "password": "hash"})
    return {"_id": user_id, "id": str(user_id)}


@pytest.fixture
def regular_client(client, authenticate_as, regular_user):
    """Authenticate the client as a non-admin user.

    Notes:
        This lets tests assert 403 without repeating the authenticate call.

    Returns:
        Any -- Flask test client authenticated as a regular user
    """
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
    """Regular users get 403 from every admin endpoint.

    Arguments:
        regular_client {Any} -- Flask test client authenticated as a non-admin user
        method {str} -- HTTP method to call
        path {str} -- admin route path under test

    Notes:
        A single missed route would expose the full admin surface.
    """
    response = getattr(regular_client, method)(path)

    assert response.status_code == 403


def test_admin_get_users_success(client, admin_user, regular_user):
    """User listing includes all users regardless of role.

    Arguments:
        client {Any} -- anonymous Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- persisted non-admin user to appear in the listing

    Notes:
        This gives the panel a complete system view.
    """
    response = client.get("/api/admin/users")

    assert response.status_code == 200
    assert {item["id"] for item in response.get_json()} == {admin_user["id"], regular_user["id"]}


def test_admin_get_users_unauthenticated(client):
    """Unauthenticated access is rejected before role checks run.

    Arguments:
        client {Any} -- anonymous Flask test client with no active session

    Notes:
        The endpoint must not be reachable without a session.
    """
    response = client.get("/api/admin/users")

    assert response.status_code in {401, 403}


def test_admin_get_user_success(client, admin_user, regular_user):
    """User detail omits the password hash, even for admin callers.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- the user whose detail is being fetched

    Notes:
        The panel has no legitimate reason to expose the password hash.
    """
    response = client.get(f"/api/admin/users/{regular_user['id']}")

    assert response.status_code == 200
    assert response.get_json()["id"] == regular_user["id"]
    assert "password" not in response.get_json()


def test_admin_get_user_not_found(client, admin_user):
    """A missing user id returns 404.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets callers distinguish "not found" from "found with no data".
    """
    response = client.get(f"/api/admin/users/{ObjectId()}")

    assert response.status_code == 404


def test_admin_ban_user_success(client, admin_user):
    """Banning a user creates a denylist entry.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This causes subsequent logins to be rejected at the OAuth callback.
    """
    user_id = ObjectId()
    db.users.insert_one({"_id": user_id, "username": "target", "role": "user", "helmholtz_sub": "sub-to-ban"})

    response = client.post(f"/api/admin/users/{user_id}/ban")

    assert response.status_code == 200
    data = response.get_json()
    assert data["helmholtz_sub"] == "sub-to-ban"
    assert data["banned_at"] is not None


def test_admin_ban_user_rejects_self_ban(client, admin_user):
    """Admins cannot ban themselves.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        Doing so would lock their own account out on the next OAuth login.
    """
    response = client.post(f"/api/admin/users/{admin_user['id']}/ban")

    assert response.status_code == 400


def test_admin_get_banned_users_success(client, admin_user):
    """Banned user listing returns all active bans.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the admin see who is currently blocked and unban them.
    """
    user_id = ObjectId()
    db.users.insert_one({"_id": user_id, "username": "target", "role": "user", "helmholtz_sub": "sub-listed"})
    client.post(f"/api/admin/users/{user_id}/ban")

    response = client.get("/api/admin/banned-users")

    assert response.status_code == 200
    assert any(ban["helmholtz_sub"] == "sub-listed" for ban in response.get_json())


def test_admin_unban_user_success(client, admin_user):
    """Removing a ban deletes the denylist entry.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the user log in again on their next attempt.
    """
    user_id = ObjectId()
    db.users.insert_one(
        {"_id": user_id, "username": "target", "role": "user", "helmholtz_sub": "sub-to-unban"}
    )
    ban_id = client.post(f"/api/admin/users/{user_id}/ban").get_json()["id"]

    response = client.delete(f"/api/admin/banned-users/{ban_id}")

    assert response.status_code == 200
    assert client.get("/api/admin/banned-users").get_json() == []


def test_admin_unban_user_not_found(client, admin_user):
    """A missing ban id returns 404.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets callers know the unban had no effect.
    """
    response = client.delete(f"/api/admin/banned-users/{ObjectId()}")

    assert response.status_code == 404


def test_admin_get_users_includes_ban_status(client, admin_user):
    """User listing exposes banned and ban_id fields.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the panel display ban status inline without a second request.
    """
    user_id = ObjectId()
    db.users.insert_one(
        {"_id": user_id, "username": "target", "role": "user", "helmholtz_sub": "sub-ban-check"}
    )
    client.post(f"/api/admin/users/{user_id}/ban")

    response = client.get("/api/admin/users")
    users = {u["id"]: u for u in response.get_json()}

    assert users[str(user_id)]["banned"] is True
    assert users[str(user_id)]["ban_id"] is not None
    assert users[admin_user["id"]]["banned"] is False
    assert users[admin_user["id"]]["ban_id"] is None


def test_admin_update_user_role_success(client, admin_user, regular_user):
    """Role updates persist to MongoDB.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- the user whose role is being updated

    Notes:
        This makes the change take effect on the user's next request.
    """
    response = client.put(f"/api/admin/users/{regular_user['id']}", json={"role": "admin"})

    assert response.status_code == 200
    assert response.get_json()["role"] == "admin"


def test_admin_update_user_rejects_invalid_role(client, admin_user, regular_user):
    """Invalid roles are rejected before persisting.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- the user whose role update is being attempted

    Notes:
        This prevents the DB from holding values the auth system does not recognize.
    """
    response = client.put(f"/api/admin/users/{regular_user['id']}", json={"role": "owner"})

    assert response.status_code == 400


def test_admin_update_user_rejects_empty_payload(client, admin_user, regular_user):
    """An empty payload is rejected rather than silently no-opped.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- the user whose role update is being attempted

    Notes:
        This gives callers clear feedback that the request was malformed.
    """
    response = client.put(f"/api/admin/users/{regular_user['id']}", json={})

    assert response.status_code == 400


def test_admin_delete_user_success(client, admin_user, regular_user, test_data_roots):
    """Deletion cascades to tracked files and DB records.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- the user being deleted
        test_data_roots {DataRoots} -- per-test temp filesystem roots

    Notes:
        This avoids leaving orphaned data that consumes storage.
    """
    user_dir = test_data_roots.user_data / regular_user["id"]
    # regular_user has a random id, so create its directory explicitly to prove deletion removes it.
    user_dir.mkdir()
    upload_file = test_data_roots.uploads / "upload.txt"
    upload_file.write_text("upload")
    output_dir = user_dir / "output"
    output_dir.mkdir()
    db.uploads.insert_one({"_id": ObjectId(), "user_id": regular_user["id"], "path": str(upload_file)})
    db.runs.insert_one(
        {"_id": ObjectId(), "user_id": regular_user["id"], "output_path": serialize_path(output_dir)}
    )

    response = client.delete(f"/api/admin/users/{regular_user['id']}")

    assert response.status_code == 200
    assert db.users.find_one({"_id": regular_user["_id"]}) is None
    assert not upload_file.exists()
    assert not user_dir.exists()


def test_admin_delete_user_rejects_self_delete(client, admin_user):
    """Admins cannot delete themselves.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        Doing so would remove the last admin and lock everyone out of the panel.
    """
    response = client.delete(f"/api/admin/users/{admin_user['id']}")

    assert response.status_code == 400


def test_admin_legal_documents_list_success(client, admin_user):
    """Legal document listing includes at least both required types.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the panel always surface the full legal surface.
    """
    response = client.get("/api/admin/legal-documents")

    assert response.status_code == 200
    assert {item["document"] for item in response.get_json()} >= {"terms", "privacy-policy"}


def test_admin_legal_document_detail_success(client, admin_user):
    """Document detail echoes the document key.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the panel bind the response to the correct document type.
    """
    response = client.get(f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}")

    assert response.status_code == 200
    assert response.get_json()["document"] == TERMS_DOCUMENT_KEY


def test_admin_publish_legal_document_success(client, admin_user):
    """Publishing reflects the new body in the response.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the admin confirm the change without a second request.
    """
    response = client.post(
        f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}/publish",
        json={"body": "# Terms\n\nNew body"},
    )

    assert response.status_code == 200
    assert "New body" in response.get_json()["published"]["body"]


def test_admin_publish_legal_document_requires_new_content(client, admin_user):
    """Re-publishing identical content is rejected.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        Otherwise the version would bump and invalidate all existing user
        consents without any actual content change.
    """
    current = client.get(f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}").get_json()["published"]["body"]

    response = client.post(f"/api/admin/legal-documents/{TERMS_DOCUMENT_KEY}/publish", json={"body": current})

    assert response.status_code == 400


def test_admin_get_pipeline_runs_success(client, admin_user):
    """Admin run listing exposes the MongoDB id.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the panel link each row to its detail or action endpoints.
    """
    run_id = db.runs.insert_one(
        {"pipeline": "merfish", "status": "pending", "created_at": utc_now()}
    ).inserted_id

    response = client.get("/api/admin/pipelines")

    assert response.status_code == 200
    assert response.get_json()[0]["id"] == str(run_id)


def test_admin_update_pipeline_status_success(client, admin_user):
    """Status updates persist to MongoDB.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This makes the change visible on the user's next poll.
    """
    run_id = db.runs.insert_one({"status": "pending", "pipeline": "merfish"}).inserted_id

    response = client.put(f"/api/admin/pipelines/{run_id}", json={"status": "success"})

    assert response.status_code == 200
    assert db.runs.find_one({"_id": run_id})["status"] == "success"


def test_admin_update_pipeline_status_rejects_invalid_status(client, admin_user):
    """Invalid statuses are rejected.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This prevents runs from reaching a state the frontend does not know
        how to display.
    """
    run_id = db.runs.insert_one({"status": "pending"}).inserted_id

    response = client.put(f"/api/admin/pipelines/{run_id}", json={"status": "bogus"})

    assert response.status_code == 400


def test_admin_delete_pipeline_run_success(client, admin_user, tmp_path):
    """Admin run deletion removes both the MongoDB document and output directory.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        tmp_path {Path} -- pytest-provided temp directory for the output folder

    Notes:
        This avoids leaving orphaned files.
    """
    output = tmp_path / "output"
    output.mkdir()
    run_id = db.runs.insert_one({"status": "pending", "output_path": serialize_path(output)}).inserted_id

    response = client.delete(f"/api/admin/pipelines/{run_id}")

    assert response.status_code == 200
    assert not output.exists()
    assert db.runs.find_one({"_id": run_id}) is None


def test_admin_dashboard_stats_success(client, admin_user, regular_user):
    """Dashboard stats aggregate across all users and statuses.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- second persisted user to make the total user count meaningful

    Notes:
        This gives the admin a system-wide view rather than just their own data.
    """
    db.runs.insert_many([{"status": "pending"}, {"status": "success"}])

    response = client.get("/api/admin/dashboard")

    assert response.status_code == 200
    assert response.get_json()["users"]["total"] == 2
    assert response.get_json()["pipeline_runs"]["by_status"]["pending"] == 1


def test_admin_feedback_list_success(client, admin_user):
    """Feedback listing must return messages in a shape the panel can display without further transformation.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
    """
    db.feedback.insert_one({"_id": ObjectId(), "message": "hello", "created_at": utc_now()})

    response = client.get("/api/admin/feedback")

    assert response.status_code == 200
    assert response.get_json()[0]["message"] == "hello"


def _monthly_report_doc(report_id: str, year: int, month: int) -> dict:
    """Build a minimal monthly report document for seeding report listing and detail tests.

    Arguments:
        report_id {str} -- MongoDB document id in YYYY-MM format
        year {int} -- reporting year
        month {int} -- reporting month

    Returns:
        dict -- report document ready to insert into the monthly_reports collection
    """
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
    """Reports are returned newest-first.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the panel show the most recent period without a client-side sort.
    """
    db.monthly_reports.insert_many(
        [
            _monthly_report_doc("2026-03", 2026, 3),
            _monthly_report_doc("2026-04", 2026, 4),
        ]
    )

    response = client.get("/api/admin/reports")

    assert response.status_code == 200
    assert [report["id"] for report in response.get_json()] == ["2026-04", "2026-03"]


def test_admin_monthly_report_detail_success(client, admin_user):
    """Report detail lookup by year and month returns the matching document.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the panel display a specific period on demand.
    """
    db.monthly_reports.insert_one(_monthly_report_doc("2026-04", 2026, 4))

    response = client.get("/api/admin/reports?year=2026&month=4")

    assert response.status_code == 200
    assert response.get_json()["id"] == "2026-04"


def test_admin_monthly_report_detail_not_found(client, admin_user):
    """A missing report returns 404.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the panel distinguish "not generated yet" from "generated
        with no data".
    """
    response = client.get("/api/admin/reports?year=2026&month=4")

    assert response.status_code == 404


def test_admin_delete_monthly_report_success(client, admin_user):
    """Report deletion removes the document from MongoDB.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This prevents regeneration from producing a duplicate-key conflict.
    """
    db.monthly_reports.insert_one(_monthly_report_doc("2026-04", 2026, 4))

    response = client.delete("/api/admin/reports/2026-04")

    assert response.status_code == 200
    assert db.monthly_reports.find_one({"_id": "2026-04"}) is None


def test_admin_delete_monthly_report_not_found(client, admin_user):
    """Deleting a non-existent report returns 404.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets callers know whether the delete actually took effect.
    """
    response = client.delete("/api/admin/reports/2026-04")

    assert response.status_code == 404


def test_admin_trigger_monthly_report_success(client, admin_user):
    """Manual report generation forwards the target period to the Celery task.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This makes the task generate the correct month.
    """

    class FixedDate(datetime.date):
        # Subclassing datetime.date lets us override today() while keeping all
        # other date arithmetic intact, which plain monkeypatching cannot do.
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
    """Omitting year and month enqueues the task without arguments.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the task determine the target period itself.
    """
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
    """All malformed payloads are rejected before the task is enqueued.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        payload {dict} -- one of the parametrized invalid payload shapes

    Notes:
        This avoids queuing work that will always fail.
    """
    response = client.post("/api/admin/reports/generate", json=payload)

    assert response.status_code == 400


def test_admin_trigger_monthly_report_rejects_current_month(client, admin_user):
    """Current-month reports are rejected.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        Generating mid-month would produce partial counts that appear final
        and make trend comparisons misleading.
    """

    class FixedDate(datetime.date):
        # Subclassing datetime.date lets us override today() while keeping all
        # other date arithmetic intact, which plain monkeypatching cannot do.
        @classmethod
        def today(cls):
            return cls(2026, 5, 27)

    with patch("backend.routes.admin.datetime.date", FixedDate):
        response = client.post("/api/admin/reports/generate", json={"year": 2026, "month": 5})

    assert response.status_code == 400


def test_admin_bulk_delete_users_success(client, admin_user, regular_user):
    """Bulk deletion reports the count of actually deleted users.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- the user being deleted in bulk

    Notes:
        This lets the admin verify all selected users were removed.
    """
    response = client.post("/api/admin/users/bulk-delete", json={"user_ids": [regular_user["id"]]})

    assert response.status_code == 200
    assert response.get_json()["deleted_count"] == 1


def test_admin_bulk_delete_users_rejects_empty_array(client, admin_user):
    """An empty id list is rejected rather than silently no-opped.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This prevents accidental calls from masking client bugs.
    """
    response = client.post("/api/admin/users/bulk-delete", json={"user_ids": []})

    assert response.status_code == 400


def test_admin_bulk_delete_users_rejects_self(client, admin_user):
    """Self-deletion via bulk delete is blocked by the same rule as single-user delete.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This keeps the endpoint's behavior consistent across both delete paths.
    """
    response = client.post("/api/admin/users/bulk-delete", json={"user_ids": [admin_user["id"]]})

    assert response.status_code == 400


def test_admin_bulk_update_user_role_success(client, admin_user, regular_user):
    """Bulk role updates persist to MongoDB.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- the user whose role is being updated in bulk

    Notes:
        This makes the change take effect on each user's next request.
    """
    response = client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [regular_user["id"]], "role": "admin"}
    )

    assert response.status_code == 200
    assert db.users.find_one({"_id": regular_user["_id"]})["role"] == "admin"


def test_admin_bulk_update_user_role_rejects_invalid_role(client, admin_user, regular_user):
    """Invalid roles are rejected before any writes.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session
        regular_user {dict} -- the user whose role update is being attempted

    Notes:
        This prevents partial updates from leaving some users with unrecognized roles.
    """
    response = client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [regular_user["id"]], "role": "owner"}
    )

    assert response.status_code == 400


def test_admin_bulk_update_user_role_rejects_self_demotion(client, admin_user):
    """An admin cannot demote themselves via bulk role update.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        Doing so would revoke their own access to all admin endpoints with
        no way to undo it from within the panel.
    """
    response = client.post(
        "/api/admin/users/bulk-update-role", json={"user_ids": [admin_user["id"]], "role": "user"}
    )

    assert response.status_code == 400


def test_admin_bulk_delete_pipeline_runs_success(client, admin_user):
    """Bulk run deletion reports the count of deleted runs.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This lets the admin verify the correct number of runs were removed.
    """
    run_id = db.runs.insert_one({"status": "pending"}).inserted_id

    response = client.post("/api/admin/pipelines/bulk-delete", json={"run_ids": [str(run_id)]})

    assert response.status_code == 200
    assert response.get_json()["deleted_count"] == 1


def test_admin_bulk_delete_pipeline_runs_rejects_invalid_ids(client, admin_user):
    """Malformed run ids are rejected before any deletes.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This prevents the batch from partially succeeding with garbage input.
    """
    response = client.post("/api/admin/pipelines/bulk-delete", json={"run_ids": ["not-an-id"]})

    assert response.status_code == 400


def test_admin_bulk_update_pipeline_status_success(client, admin_user):
    """Bulk status updates persist to MongoDB.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This makes changes take effect immediately on the user's next poll.
    """
    run_id = db.runs.insert_one({"status": "pending"}).inserted_id

    response = client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [str(run_id)], "status": "success"}
    )

    assert response.status_code == 200
    assert db.runs.find_one({"_id": run_id})["status"] == "success"


def test_admin_bulk_update_pipeline_status_rejects_invalid_status(client, admin_user):
    """Invalid statuses are rejected before any writes.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This prevents partial updates from leaving runs in unrecognized states.
    """
    response = client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [str(ObjectId())], "status": "bogus"}
    )

    assert response.status_code == 400


def test_admin_bulk_update_pipeline_status_rejects_empty_run_ids(client, admin_user):
    """An empty run id list is rejected.

    Arguments:
        client {Any} -- Flask test client
        admin_user {dict} -- persisted admin user and authenticated session

    Notes:
        This prevents no-op calls from masking client-side bugs.
    """
    response = client.post(
        "/api/admin/pipelines/bulk-update-status", json={"run_ids": [], "status": "success"}
    )

    assert response.status_code == 400
