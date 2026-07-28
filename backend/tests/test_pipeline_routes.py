"""Pipeline submission route tests.

Notes:
    These tests use real MongoDB documents and temporary filesystem paths. Celery
    dispatch and Redis queue inspection are patched because they are external
    boundaries for route-level behavior.
"""

import copy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import ANY, patch

import pytest
from bson import ObjectId
from glom import assign, glom

from backend.config import CeleryConfig, Config
from backend.constants import PIPELINE_FILE_INPUT, PIPELINE_GENOMIC_INPUT
from backend.extensions import db
from backend.tests.conftest import TEST_SESSION_ID, TEST_USER_ID, assert_sanitized_error

# TODO: add ("merfish", "merfish_mock_form_data.json") etc. once each pipeline has
# Pydantic integration and is re-enabled in EXISTING_PIPELINES (backend/routes/pipelines.py).
# When multiple pipelines are active, add @pytest.mark.parametrize("pipeline_name, payload_file",
# PIPELINE_CASES) to each test and replace the PIPELINE_NAME/PAYLOAD_FILE references with
# the parametrized variables — mirroring the PIPELINE_NAMES pattern in test_pipeline_runner.py.
PIPELINE_CASES = [
    ("oligoseq", "oligoseq_mock_form_data.json"),
]

PIPELINE_NAME, PAYLOAD_FILE = PIPELINE_CASES[0]


def payload_with_upload(payload: dict, field_path: str, file_key: str) -> dict:
    """Assign an upload key to a nested form field.

    Arguments:
        payload {dict} -- pipeline submission payload to mutate
        field_path {str} -- glom-style dot path to the file list field inside formdata
        file_key {str} -- multipart form key that the route will look up in the uploaded files

    Notes:
        This lets tests simulate file uploads without copying the full payload
        structure manually.

    Returns:
        dict -- deep copy of the payload with the field set to the upload key
    """
    updated = copy.deepcopy(payload)
    assign(updated["formdata"], field_path, [file_key])
    return updated


def response_run(response) -> dict:
    """Fetch the run document created by a successful submission.

    Arguments:
        response {Any} -- Flask test client response from a successful pipeline POST

    Notes:
        This lets tests assert on persisted state without repeating ObjectId parsing.

    Returns:
        dict -- MongoDB run document created by the submission
    """
    return db.runs.find_one({"_id": ObjectId(response.get_json()["run_id"])})


@pytest.fixture
def queued_task():
    """Patch Celery enqueue and queue position.

    Notes:
        This lets submissions exercise route parsing and DB writes without
        touching the broker.

    Yields:
        tuple -- (enqueue mock, queue_position mock) for asserting dispatch arguments
    """
    with (
        patch(
            "backend.routes.pipelines.enqueue_pipeline", return_value=SimpleNamespace(id="task-123")
        ) as enqueue,
        patch("backend.routes.pipelines.add_pending_run", return_value=(2, 1)) as queue_position,
    ):
        yield enqueue, queue_position


def test_start_pipeline_authenticated_success(
    authenticated_user, pipeline_payload, multipart_post, queued_task
):
    """Authenticated submissions create high-priority user-owned runs.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session with current terms accepted
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks

    Notes:
        This ensures registered users get faster execution than anonymous ones.
    """
    response = multipart_post(f"/api/{PIPELINE_NAME}", pipeline_payload(PAYLOAD_FILE))

    assert response.status_code == 200
    assert response.get_json()["queue_position"] == [2, 1]
    run = response_run(response)
    assert run["status"] == "pending"
    assert run["user_id"] == TEST_USER_ID
    assert run["session_id"] is None
    assert run["pipeline"] == PIPELINE_NAME
    assert run["priority"] == "high"
    assert Path(*run["output_path"]["parts"]).is_dir()

    enqueue, queue_position = queued_task
    pipeline_chord = enqueue.call_args.args[0]
    assert pipeline_chord.body.options["priority"] == CeleryConfig.task_high_priority
    queue_position.assert_called_once_with(ANY, db, CeleryConfig.task_high_priority)


def test_start_pipeline_anonymous_success(anonymous_session, pipeline_payload, multipart_post, queued_task):
    """Anonymous submissions must create default-priority session-owned runs routed to the anonymous data directory.

    Arguments:
        anonymous_session {str} -- session id attached to the test client with current terms accepted
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks
    """
    response = multipart_post(f"/api/{PIPELINE_NAME}", pipeline_payload(PAYLOAD_FILE))

    assert response.status_code == 200
    run = response_run(response)
    assert run["session_id"] == TEST_SESSION_ID
    assert run["user_id"] is None
    assert run["priority"] == "default"
    output_path = Path(*run["output_path"]["parts"])
    assert output_path.is_dir()
    assert f"user_data/anon/{TEST_SESSION_ID}" in output_path.as_posix()


@pytest.mark.parametrize("pipeline_name", ["merfish", "seqfish", "scrinshot"])
def test_start_pipeline_rejects_disabled_pipeline(client, multipart_post, pipeline_name):
    """Disabled pipelines are rejected at the route level.

    Arguments:
        client {Any} -- Flask test client
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        pipeline_name {str} -- one of the parametrized disabled pipeline names

    Notes:
        This ensures half-implemented pipelines never reach task dispatch.
    """
    response = multipart_post(f"/api/{pipeline_name}", {})

    assert response.status_code == 400
    assert "does not exist" in response.get_json()["error"]


def test_start_pipeline_requires_terms_acceptance(
    authenticate_as, pipeline_payload, multipart_post, queued_task, test_data_roots
):
    """Terms must be accepted before any run document or output directory is created.

    Arguments:
        authenticate_as {Callable} -- factory that patches current_user without inserting a terms acceptance
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks
        test_data_roots {DataRoots} -- per-test temp filesystem roots for asserting no output was created

    Notes:
        This guarantees no orphaned state exists for non-consenting users.
    """
    authenticate_as(TEST_USER_ID)

    response = multipart_post(f"/api/{PIPELINE_NAME}", pipeline_payload(PAYLOAD_FILE))

    assert response.status_code == 403
    assert db.runs.count_documents({}) == 0
    assert list(test_data_roots.user_dir.glob("output_*")) == []


def test_start_pipeline_rejects_unknown_pipeline(client, multipart_post):
    """Unknown pipeline names are rejected with a clear error.

    Arguments:
        client {Any} -- Flask test client
        multipart_post {Callable} -- helper that posts multipart pipeline requests

    Notes:
        The route handler must not crash on an unrecognized pipeline name.
    """
    response = multipart_post("/api/not-a-pipeline", {})

    assert response.status_code == 400
    assert "does not exist" in response.get_json()["error"]


def test_start_pipeline_rejects_missing_payload(client, authenticated_user):
    """A missing payload field must fail immediately before any DB writes or filesystem side effects.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
    """
    response = client.post(f"/api/{PIPELINE_NAME}", data={}, content_type="multipart/form-data")

    assert response.status_code == 400


def test_start_pipeline_rejects_empty_payload(authenticated_user, multipart_post):
    """An empty payload is rejected before any pipeline configuration is parsed.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        multipart_post {Callable} -- helper that posts multipart pipeline requests

    Notes:
        An empty payload has no formdata to parse.
    """
    response = multipart_post(f"/api/{PIPELINE_NAME}", {})

    assert response.status_code == 400


def test_start_pipeline_ignores_client_run_id(
    authenticated_user, pipeline_payload, multipart_post, queued_task
):
    """The server generates run IDs itself and ignores any client-supplied run ID.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks

    Notes:
        This prevents clients from spoofing IDs or causing collisions with other
        users' runs.
    """
    client_run_id = ObjectId()
    payload = pipeline_payload(PAYLOAD_FILE, client_run_id)

    response = multipart_post(f"/api/{PIPELINE_NAME}", payload)

    assert response.status_code == 200
    assert response.get_json()["run_id"] != str(client_run_id)
    assert db.runs.find_one({"_id": client_run_id}) is None


def test_start_pipeline_rejects_missing_anonymous_terms(client, pipeline_payload, multipart_post):
    """Anonymous users without terms acceptance are blocked at the same checkpoint as authenticated users.

    Arguments:
        client {Any} -- anonymous Flask test client with no terms acceptance
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests

    Notes:
        This keeps consent enforcement consistent across user types.
    """
    response = multipart_post(f"/api/{PIPELINE_NAME}", pipeline_payload(PAYLOAD_FILE))

    assert response.status_code == 403
    assert "accept the current Terms" in response.get_json()["error"]


def test_start_pipeline_fails_when_user_directory_missing(
    authenticated_user, pipeline_payload, multipart_post, queued_task, test_data_roots
):
    """A missing user directory returns a 500 with a sanitized error.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks
        test_data_roots {DataRoots} -- per-test temp filesystem roots; user dir is removed to trigger the failure

    Notes:
        Sanitizing the error ensures internal filesystem paths are not exposed to
        the client.
    """
    test_data_roots.user_dir.rmdir()

    response = multipart_post(f"/api/{PIPELINE_NAME}", pipeline_payload(PAYLOAD_FILE))

    assert response.status_code == 500
    assert_sanitized_error(response)


def test_start_pipeline_rejects_too_many_genes_for_anonymous_user(
    anonymous_session, pipeline_payload, multipart_post, queued_task
):
    """Anonymous users are capped at GENE_COUNT_THRESHOLD.

    Arguments:
        anonymous_session {str} -- session id attached to the test client with current terms accepted
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks

    Notes:
        This cap prevents resource abuse from unauthenticated callers without
        requiring an account.
    """
    payload = pipeline_payload(PAYLOAD_FILE)
    assign(
        payload["formdata"],
        "target_probe.oligo_generation.file_region_ids",
        ",".join(f"Gene{i}" for i in range(Config.GENE_COUNT_THRESHOLD + 1)),
    )

    response = multipart_post(f"/api/{PIPELINE_NAME}", payload)

    assert response.status_code == 401
    assert db.runs.count_documents({}) == 0


def test_start_pipeline_allows_too_many_genes_for_authenticated_user(
    authenticated_user, pipeline_payload, multipart_post, queued_task
):
    """Authenticated users are not subject to the anonymous gene cap.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks

    Notes:
        This ensures legitimate large analyses are not blocked.
    """
    payload = pipeline_payload(PAYLOAD_FILE)
    assign(
        payload["formdata"],
        "target_probe.oligo_generation.file_region_ids",
        ",".join(f"Gene{i}" for i in range(Config.GENE_COUNT_THRESHOLD + 1)),
    )

    response = multipart_post(f"/api/{PIPELINE_NAME}", payload)

    assert response.status_code == 200


def test_start_pipeline_saves_uploaded_files(
    authenticated_user, pipeline_payload, multipart_post, queued_task, test_data_roots
):
    """Uploaded file keys are replaced with server-side paths before enqueue.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks
        test_data_roots {DataRoots} -- per-test temp filesystem roots for asserting the saved file location

    Notes:
        This means the task never needs to access multipart form data directly.
    """
    field = PIPELINE_FILE_INPUT[PIPELINE_NAME][0]
    payload = payload_with_upload(pipeline_payload(PAYLOAD_FILE), field, "variants")

    response = multipart_post(
        f"/api/{PIPELINE_NAME}", payload, files={"variants": (b"##fileformat=VCFv4.2\n", "input.vcf")}
    )

    assert response.status_code == 200
    saved_files = list(test_data_roots.uploads.iterdir())
    assert len(saved_files) == 1
    assert saved_files[0].name.endswith("_input.vcf")
    pipeline_chord = queued_task[0].call_args.args[0]
    enqueued_form_data = pipeline_chord.body.args[1]
    assert glom(enqueued_form_data, field) == [str(saved_files[0])]


# "???" is the placeholder filename some browsers send for an empty file input.
@pytest.mark.parametrize("filename", ["", "???"])
def test_start_pipeline_rejects_invalid_uploaded_filename(
    authenticated_user, pipeline_payload, multipart_post, filename
):
    """Empty and browser-placeholder filenames are rejected.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        filename {str} -- one of the parametrized invalid filenames

    Notes:
        These filenames would otherwise result in unnamed or colliding server-side
        files.
    """
    field = PIPELINE_FILE_INPUT[PIPELINE_NAME][0]
    payload = payload_with_upload(pipeline_payload(PAYLOAD_FILE), field, "upload")

    response = multipart_post(f"/api/{PIPELINE_NAME}", payload, files={"upload": (b"content", filename)})

    assert response.status_code == 400


def test_start_pipeline_persists_pipeline_run_config_when_present(
    authenticated_user, pipeline_payload, multipart_post, queued_task
):
    """pipeline_run_config is stored verbatim on the run document.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks

    Notes:
        This lets the frontend replay the exact configuration later.
    """
    payload = pipeline_payload(PAYLOAD_FILE)
    payload["pipeline_run_config"] = {"version": 1, "name": "saved"}

    response = multipart_post(f"/api/{PIPELINE_NAME}", payload)

    assert response.status_code == 200
    assert response_run(response)["pipeline_run_config"] == payload["pipeline_run_config"]


def test_start_pipeline_ignores_invalid_pipeline_run_config(
    authenticated_user, pipeline_payload, multipart_post, queued_task
):
    """An invalid pipeline_run_config value is silently dropped rather than blocking pipeline submission.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        queued_task {tuple} -- patched enqueue and queue_position mocks

    Notes:
        pipeline_run_config is best-effort metadata, not required for submission.
    """
    payload = pipeline_payload(PAYLOAD_FILE)
    payload["pipeline_run_config"] = ["invalid"]

    response = multipart_post(f"/api/{PIPELINE_NAME}", payload)

    assert response.status_code == 200
    assert "pipeline_run_config" not in response_run(response)


def test_pipeline_routes_do_not_expose_raw_errors(authenticated_user, pipeline_payload, multipart_post):
    """Internal errors are sanitized before reaching the client.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests

    Notes:
        Sanitizing avoids exposing paths, tracebacks, or internal state.
    """
    payload = pipeline_payload(PAYLOAD_FILE)

    with patch("backend.routes.pipelines.create_context", side_effect=RuntimeError("/tmp/secret traceback")):
        response = multipart_post(f"/api/{PIPELINE_NAME}", payload)

    assert response.status_code == 500
    assert_sanitized_error(response)


def test_start_pipeline_rejects_missing_payload_formdata(authenticated_user, multipart_post):
    """A payload without the formdata field fails immediately.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        multipart_post {Callable} -- helper that posts multipart pipeline requests

    Notes:
        formdata contains the entire pipeline configuration, so there is nothing
        valid to process without it.
    """
    response = multipart_post(f"/api/{PIPELINE_NAME}", {"token": "XXXX.DUMMY.TOKEN.XXXX"})

    assert response.status_code == 400


def test_start_pipeline_rejects_misformatted_genomic_inputs(
    authenticated_user, pipeline_payload, multipart_post
):
    """Malformed genomic input structure is caught before dispatch.

    Arguments:
        authenticated_user {AuthenticatedUser} -- active authenticated session
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests

    Notes:
        This ensures the task never receives a config it cannot parse.
    """
    payload = copy.deepcopy(pipeline_payload(PAYLOAD_FILE))
    del payload["formdata"]["target_probe"]["oligo_generation"]["files_fasta_probe_database"]

    response = multipart_post(f"/api/{PIPELINE_NAME}", payload)

    assert response.status_code == 400


def test_genomic_input_paths_match_current_oligoseq_shape(pipeline_payload):
    """PIPELINE_GENOMIC_INPUT path constants match the actual payload shape.

    Arguments:
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file

    Notes:
        If these drift out of sync, genomic region tasks will silently skip their
        inputs.
    """
    form_data = pipeline_payload(PAYLOAD_FILE)["formdata"]

    assert all(isinstance(glom(form_data, path), list) for path in PIPELINE_GENOMIC_INPUT[PIPELINE_NAME])
