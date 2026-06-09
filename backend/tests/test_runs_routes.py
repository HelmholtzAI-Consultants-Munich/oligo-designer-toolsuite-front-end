"""Run management route tests.

The route suite uses real temp output files/directories so file serving and
deletion behavior is covered without relying on repository fixtures.
"""

from bson import ObjectId

from backend.extensions import db
from backend.tests.conftest import OTHER_USER_ID, TEST_SESSION_ID, TEST_USER_ID
from backend.utilities.typed_values import utc_now


def test_get_pipeline_runs_authenticated_returns_only_user_runs(client, authenticated_user, run_doc):
    """Authenticated run listing filters strictly by current user id."""
    owned = run_doc(user_id=TEST_USER_ID, pipeline="merfish")
    run_doc(user_id=OTHER_USER_ID)
    run_doc(session_id=TEST_SESSION_ID)

    response = client.get("/api/runs")

    assert response.status_code == 200
    assert [item["_id"] for item in response.get_json()] == [str(owned)]


def test_get_pipeline_runs_anonymous_returns_only_session_runs(client, anonymous_session, run_doc):
    """Anonymous run listing filters strictly by session id."""
    owned = run_doc(session_id=TEST_SESSION_ID)
    run_doc(session_id="other-session")

    response = client.get("/api/runs")

    assert response.status_code == 200
    assert [item["_id"] for item in response.get_json()] == [str(owned)]


def test_get_pipeline_run_success(client, authenticated_user, run_doc):
    run_id = run_doc(user_id=TEST_USER_ID, status="success", timestamp=utc_now(), priority="high")

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 200
    data = response.get_json()
    assert data["_id"] == str(run_id)
    assert data["status"] == "success"
    assert data["timestamp"].endswith("+00:00") or data["timestamp"].endswith("Z")


def test_get_pipeline_run_includes_error_message_for_failure_status(client, authenticated_user, run_doc):
    run_id = run_doc(user_id=TEST_USER_ID, status="failure", error_message="safe failure")

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 200
    assert response.get_json()["error_message"] == "safe failure"


def test_get_pipeline_run_omits_error_message_for_success(client, authenticated_user, run_doc):
    run_id = run_doc(user_id=TEST_USER_ID, status="success", error_message="old failure")

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 200
    assert "error_message" not in response.get_json()


def test_get_pipeline_run_404_for_unowned_run(client, authenticated_user, run_doc):
    run_id = run_doc(user_id=OTHER_USER_ID)

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 404


def test_get_run_file_serves_log_as_text(client, authenticated_user, run_doc, tmp_path):
    output = tmp_path / "output"
    output.mkdir()
    (output / "run.log").write_text("hello log")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/run.log")

    assert response.status_code == 200
    assert response.text == "hello log"
    assert response.mimetype == "text/plain"


def test_get_run_file_serves_nested_file(client, authenticated_user, run_doc, tmp_path):
    """Pipeline outputs may include subdirectories; serve only paths under output_path."""
    output = tmp_path / "output"
    nested = output / "annotation"
    nested.mkdir(parents=True)
    (nested / "run.log").write_text("nested log")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/annotation/run.log")

    assert response.status_code == 200
    assert response.text == "nested log"


def test_get_run_file_serves_yaml_as_attachment(client, authenticated_user, run_doc, tmp_path):
    output = tmp_path / "output"
    output.mkdir()
    (output / "config.yml").write_text("a: 1")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/config.yml")

    assert response.status_code == 200
    assert "attachment" in response.headers["Content-Disposition"]


def test_get_run_file_serves_fna_as_octet_stream(client, authenticated_user, run_doc, tmp_path):
    output = tmp_path / "output"
    output.mkdir()
    (output / "result.fna").write_text(">x\nAC\n")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/result.fna")

    assert response.status_code == 200
    assert response.mimetype == "application/octet-stream"


def test_get_run_file_rejects_unsupported_extension(client, authenticated_user, run_doc, tmp_path):
    output = tmp_path / "output"
    output.mkdir()
    (output / "result.exe").write_text("no")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/result.exe")

    assert response.status_code == 400


def test_get_run_file_rejects_path_traversal(client, authenticated_user, run_doc, tmp_path):
    """Nested file serving rejects paths that escape the run output directory."""
    output = tmp_path / "output"
    output.mkdir()
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/%2e%2e/secret.txt")

    assert response.status_code == 400


def test_get_run_file_404_for_missing_file(client, authenticated_user, run_doc, tmp_path):
    output = tmp_path / "output"
    output.mkdir()
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/missing.log")

    assert response.status_code == 404


def test_get_run_file_500_for_missing_output_path(client, authenticated_user, run_doc):
    run_id = run_doc(user_id=TEST_USER_ID)

    response = client.get(f"/api/runs/{run_id}/files/run.log")

    assert response.status_code == 500


def test_delete_run_removes_output_directory_and_db_record(client, authenticated_user, run_doc, tmp_path):
    """Deleting a run removes both the output directory and MongoDB document."""
    output = tmp_path / "output"
    output.mkdir()
    (output / "run.log").write_text("log")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.delete(f"/api/runs/{run_id}")

    assert response.status_code == 200
    assert not output.exists()
    assert db.runs.find_one({"_id": run_id}) is None


def test_delete_run_404_for_unowned_run(client, authenticated_user, run_doc, tmp_path):
    output = tmp_path / "output"
    output.mkdir()
    run_id = run_doc(user_id=OTHER_USER_ID, output_path=output)

    response = client.delete(f"/api/runs/{run_id}")

    assert response.status_code == 404
    assert output.exists()
    assert db.runs.find_one({"_id": run_id}) is not None


def test_get_run_config_success(client, authenticated_user, run_doc):
    config = {"pipeline": "merfish", "values": {"a": 1}}
    run_id = run_doc(user_id=TEST_USER_ID, pipeline_run_config=config)

    response = client.get(f"/api/runs/{run_id}/config")

    assert response.status_code == 200
    assert response.get_json() == config


def test_get_run_config_404_when_absent(client, authenticated_user, run_doc):
    run_id = run_doc(user_id=TEST_USER_ID)

    response = client.get(f"/api/runs/{run_id}/config")

    assert response.status_code == 404


def test_get_run_config_404_for_missing_run(client, authenticated_user):
    response = client.get(f"/api/runs/{ObjectId()}/config")

    assert response.status_code == 404


def test_get_run_config_404_for_unowned_run(client, authenticated_user, run_doc):
    run_id = run_doc(
        user_id=OTHER_USER_ID,
        pipeline_run_config={"pipeline": "merfish"},
    )

    response = client.get(f"/api/runs/{run_id}/config")

    assert response.status_code == 404


def test_get_run_status_success(client, authenticated_user, run_doc):
    run_id = run_doc(user_id=TEST_USER_ID, status="started")

    response = client.get(f"/api/runs/{run_id}/status")

    assert response.status_code == 200
    assert response.get_json() == {"state": "started"}


def test_get_run_status_404_for_unowned_run(client, authenticated_user, run_doc):
    run_id = run_doc(user_id=OTHER_USER_ID, status="started")

    response = client.get(f"/api/runs/{run_id}/status")

    assert response.status_code == 404
