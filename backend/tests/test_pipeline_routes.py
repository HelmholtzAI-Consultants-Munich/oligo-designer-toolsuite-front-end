"""Pipeline submission route tests.

These tests exercise the Flask route layer with real MongoDB documents and temp
filesystem paths. Celery dispatch and Redis queue inspection are patched here
because they are external boundaries for route-level behavior.
"""

import copy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from bson import ObjectId

from backend.config import CeleryConfig, Config
from backend.constants import PIPELINE_GENOMIC_INPUT
from backend.extensions import mongo
from backend.tests.conftest import (
    TEST_SESSION_ID,
    TEST_USER_ID,
    assert_sanitized_error,
)

PIPELINE_PAYLOADS = [
    ("merfish", "merfish_mock_form_data.json"),
    ("seqfish", "seqfish_mock_form_data.json"),
    ("scrinshot", "scrinshot_mock_form_data.json"),
    ("oligoseq", "oligoseq_mock_form_data.json"),
]


def payload_with_upload(payload: dict, pipeline_name: str, field: str, file_key: str) -> dict:
    """Return a copy of a pipeline payload that references one uploaded file key.

    The frontend sends file references inside the payload, while Flask receives
    the actual file bytes as multipart fields. This helper mirrors that contract:
    every genomic file input has a `files` list, and the selected input points to
    the multipart key that the test passes to `multipart_post`.
    """
    updated = copy.deepcopy(payload)
    for input_field in PIPELINE_GENOMIC_INPUT[pipeline_name]:
        updated["formdata"][input_field].setdefault("files", [])
    updated["formdata"][field]["files"] = [file_key]
    return updated


@pytest.fixture
def queued_task():
    """Patch queue side effects while preserving route parsing and DB writes."""
    with (
        patch(
            "backend.routes.pipelines.enqueue_pipeline", return_value=SimpleNamespace(id="task-123")
        ) as enqueue,
        patch("backend.routes.pipelines.calculate_queue_position", return_value=(2, 1)) as queue_position,
    ):
        yield enqueue, queue_position


@pytest.mark.parametrize(("pipeline_name", "payload_file"), PIPELINE_PAYLOADS)
def test_start_pipeline_authenticated_success(
    client,
    authenticated_user,
    run_doc,
    pipeline_payload,
    multipart_post,
    queued_task,
    pipeline_name,
    payload_file,
):
    """Authenticated submissions are persisted as high-priority user-owned runs."""
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = pipeline_payload(payload_file, run_id)

    response = multipart_post(f"/api/{pipeline_name}", payload)

    assert response.status_code == 200
    assert response.get_json() == {"run_id": str(run_id), "queue_position": [2, 1]}
    run = mongo.db.runs.find_one({"_id": run_id})
    assert run["status"] == "pending"
    assert run["user_id"] == TEST_USER_ID
    assert run["session_id"] is None
    assert run["pipeline"] == pipeline_name
    assert run["task_id"] == "task-123"
    assert run["priority"] == "high"
    assert Path(*run["output_path"]["parts"]).is_dir()

    enqueue, queue_position = queued_task
    assert enqueue.call_args.args[5] == CeleryConfig.task_high_priority
    queue_position.assert_called_once_with(CeleryConfig.task_high_priority)


@pytest.mark.parametrize(("pipeline_name", "payload_file"), PIPELINE_PAYLOADS)
def test_start_pipeline_anonymous_success(
    client,
    anonymous_session,
    run_doc,
    pipeline_payload,
    multipart_post,
    queued_task,
    pipeline_name,
    payload_file,
):
    """Anonymous submissions are persisted under the anonymous session directory."""
    run_id = run_doc(session_id=TEST_SESSION_ID)
    payload = pipeline_payload(payload_file, run_id)

    response = multipart_post(f"/api/{pipeline_name}", payload)

    assert response.status_code == 200
    run = mongo.db.runs.find_one({"_id": run_id})
    assert run["session_id"] == TEST_SESSION_ID
    assert run["user_id"] is None
    assert run["priority"] == "default"
    output_path = Path(*run["output_path"]["parts"])
    assert output_path.is_dir()
    assert f"user_data/anon/{TEST_SESSION_ID}" in output_path.as_posix()


def test_start_pipeline_requires_terms_acceptance(
    client,
    authenticate_as,
    run_doc,
    pipeline_payload,
    multipart_post,
    queued_task,
    test_data_roots,
):
    """The route must not start or mutate a run before terms are accepted."""
    authenticate_as(TEST_USER_ID)
    run_id = run_doc(user_id=TEST_USER_ID, status="created")
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 403
    assert mongo.db.runs.find_one({"_id": run_id})["status"] == "created"
    assert list(test_data_roots.user_dir.glob("output_*")) == []


def test_start_pipeline_rejects_unknown_pipeline(client, multipart_post):
    response = multipart_post("/api/not-a-pipeline", {"runid": str(ObjectId()), "formdata": {}})

    assert response.status_code == 400
    assert "does not exist" in response.get_json()["error"]


def test_start_pipeline_rejects_missing_payload(client, authenticated_user):
    response = client.post("/api/merfish", data={}, content_type="multipart/form-data")

    assert response.status_code == 400


def test_start_pipeline_rejects_empty_payload(authenticated_user, multipart_post):
    response = multipart_post("/api/merfish", {})

    assert response.status_code == 400


def test_start_pipeline_rejects_invalid_run_id(authenticated_user, pipeline_payload, multipart_post):
    payload = pipeline_payload("merfish_mock_form_data.json", ObjectId())
    payload["runid"] = "not-an-object-id"

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 400
    assert_sanitized_error(response)


def test_start_pipeline_returns_404_for_missing_run(
    authenticated_user, pipeline_payload, multipart_post, queued_task, test_data_roots
):
    """Current behavior creates the output directory before discovering a missing run."""
    payload = pipeline_payload("merfish_mock_form_data.json", ObjectId())

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 404
    assert len(list(test_data_roots.user_dir.glob("output_merfish_probe_designer_*"))) == 1


def test_start_pipeline_rejects_missing_anonymous_session(client, pipeline_payload, multipart_post):
    """Anonymous requests auto-create a session, then fail if terms are missing."""
    payload = pipeline_payload("merfish_mock_form_data.json", ObjectId())

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 403
    assert "accept the current Terms" in response.get_json()["error"]


def test_start_pipeline_fails_when_user_directory_missing(
    authenticated_user, run_doc, pipeline_payload, multipart_post, queued_task, test_data_roots
):
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)
    test_data_roots.user_dir.rmdir()

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 500
    assert_sanitized_error(response)


def test_start_pipeline_rejects_too_many_genes_for_anonymous_user(
    anonymous_session, run_doc, pipeline_payload, multipart_post, queued_task
):
    run_id = run_doc(session_id=TEST_SESSION_ID)
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)
    payload["formdata"]["file_regions"] = ",".join(f"Gene{i}" for i in range(Config.GENE_COUNT_THRESHOLD + 1))

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 401
    assert mongo.db.runs.find_one({"_id": run_id}) is None


def test_start_pipeline_allows_too_many_genes_for_authenticated_user(
    authenticated_user, run_doc, pipeline_payload, multipart_post, queued_task
):
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)
    payload["formdata"]["file_regions"] = ",".join(f"Gene{i}" for i in range(Config.GENE_COUNT_THRESHOLD + 1))

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 200


def test_start_pipeline_saves_uploaded_files(
    authenticated_user, run_doc, pipeline_payload, multipart_post, queued_task, test_data_roots
):
    """Uploaded file fields are replaced with saved server-side paths before enqueue."""
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)
    field = PIPELINE_GENOMIC_INPUT["merfish"][0]
    payload = payload_with_upload(payload, "merfish", field, "target_fasta")

    response = multipart_post(
        "/api/merfish", payload, files={"target_fasta": (b">chr1\nACGT\n", "target.fna")}
    )

    assert response.status_code == 200
    saved_files = list(test_data_roots.uploads.iterdir())
    assert len(saved_files) == 1
    assert saved_files[0].name.endswith("_target.fna")
    enqueued_form_data = queued_task[0].call_args.args[2]
    assert enqueued_form_data[field]["files"] == [str(saved_files[0])]


def test_start_pipeline_rejects_empty_uploaded_filename(
    authenticated_user, run_doc, pipeline_payload, multipart_post
):
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = payload_with_upload(
        pipeline_payload("merfish_mock_form_data.json", run_id),
        "merfish",
        "files_fasta_target_probe_database",
        "upload",
    )

    response = multipart_post("/api/merfish", payload, files={"upload": (b"content", "")})

    assert response.status_code == 400


def test_start_pipeline_rejects_unsafe_uploaded_filename(
    authenticated_user, run_doc, pipeline_payload, multipart_post
):
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = payload_with_upload(
        pipeline_payload("merfish_mock_form_data.json", run_id),
        "merfish",
        "files_fasta_target_probe_database",
        "upload",
    )

    response = multipart_post("/api/merfish", payload, files={"upload": (b"content", "???")})

    assert response.status_code == 400


def test_start_pipeline_persists_pipeline_run_config_when_present(
    authenticated_user, run_doc, pipeline_payload, multipart_post, queued_task
):
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)
    payload["pipeline_run_config"] = {"version": 1, "name": "saved"}

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 200
    assert mongo.db.runs.find_one({"_id": run_id})["pipeline_run_config"] == payload["pipeline_run_config"]


def test_start_pipeline_ignores_invalid_pipeline_run_config(
    authenticated_user, run_doc, pipeline_payload, multipart_post, queued_task
):
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)
    payload["pipeline_run_config"] = ["invalid"]

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 200
    assert "pipeline_run_config" not in mongo.db.runs.find_one({"_id": run_id})


def test_pipeline_routes_do_not_expose_raw_errors(
    authenticated_user, run_doc, pipeline_payload, multipart_post
):
    """Unexpected route exceptions should return only the generic error message."""
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)

    with patch("backend.routes.pipelines.create_context", side_effect=RuntimeError("/tmp/secret traceback")):
        response = multipart_post("/api/merfish", payload)

    assert response.status_code == 500
    assert_sanitized_error(response)


def test_start_pipeline_rejects_missing_payload_formdata(authenticated_user, multipart_post):
    response = multipart_post("/api/merfish", {"runid": str(ObjectId())})

    assert response.status_code == 400


def test_start_pipeline_rejects_misformatted_genomic_inputs(
    authenticated_user, run_doc, pipeline_payload, multipart_post
):
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = copy.deepcopy(pipeline_payload("merfish_mock_form_data.json", run_id))
    del payload["formdata"]["files_fasta_target_probe_database"]

    response = multipart_post("/api/merfish", payload)

    assert response.status_code == 400
