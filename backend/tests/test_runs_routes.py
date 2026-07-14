"""Run management route tests.

Notes:
    These tests use real temp output files and directories because file serving
    security (path traversal, extension allowlist) and deletion correctness (both
    DB and filesystem) require actual filesystem paths to exercise properly.
    Mocking the filesystem would hide the path-resolution bugs these tests are
    designed to catch.
"""

from bson import ObjectId

from backend.extensions import db
from backend.tests.conftest import OTHER_USER_ID, TEST_SESSION_ID, TEST_USER_ID
from backend.utils import utc_now


def test_get_pipeline_runs_authenticated_returns_only_user_runs(client, authenticated_user, run_doc):
    """Run listing must be scoped to the authenticated user so a caller cannot see runs belonging to others or anonymous sessions.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
    """
    owned = run_doc(user_id=TEST_USER_ID, pipeline="merfish")
    run_doc(user_id=OTHER_USER_ID)
    run_doc(session_id=TEST_SESSION_ID)

    response = client.get("/api/runs")

    assert response.status_code == 200
    assert [item["_id"] for item in response.get_json()] == [str(owned)]


def test_get_pipeline_runs_anonymous_returns_only_session_runs(client, anonymous_session, run_doc):
    """Anonymous run listing must be scoped to the session so users from different browser sessions cannot see each other's runs.

    Arguments:
        client {Any} -- Flask test client
        anonymous_session {str} -- session id attached to the test client
        run_doc {Callable} -- factory that inserts a run document and returns its id
    """
    owned = run_doc(session_id=TEST_SESSION_ID)
    run_doc(session_id="other-session")

    response = client.get("/api/runs")

    assert response.status_code == 200
    assert [item["_id"] for item in response.get_json()] == [str(owned)]


def test_get_pipeline_run_success(client, authenticated_user, run_doc):
    """A run document must be serialized with a timezone-aware timestamp so clients can display elapsed time without making timezone assumptions.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
    """
    run_id = run_doc(user_id=TEST_USER_ID, status="success", timestamp=utc_now(), priority="high")

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 200
    data = response.get_json()
    assert data["_id"] == str(run_id)
    assert data["status"] == "success"
    assert data["timestamp"].endswith("+00:00") or data["timestamp"].endswith("Z")


def test_get_pipeline_run_includes_error_message_for_failure_status(client, authenticated_user, run_doc):
    """The error message must be exposed on failed runs so users understand why their submission did not produce results.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
    """
    run_id = run_doc(user_id=TEST_USER_ID, status="failure", error_message="safe failure")

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 200
    assert response.get_json()["error_message"] == "safe failure"


def test_get_pipeline_run_omits_error_message_for_success(client, authenticated_user, run_doc):
    """error_message must be omitted for non-failure statuses to avoid leaking intermediate pipeline state to users who are still waiting for results.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
    """
    run_id = run_doc(user_id=TEST_USER_ID, status="success", error_message="old failure")

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 200
    assert "error_message" not in response.get_json()


def test_get_pipeline_run_404_for_unowned_run(client, authenticated_user, run_doc):
    """A run owned by another user must return 404 rather than 403 to avoid confirming that the run exists.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
    """
    run_id = run_doc(user_id=OTHER_USER_ID)

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 404


def test_get_run_file_serves_log_as_text(client, authenticated_user, run_doc, tmp_path):
    """Log files must be served as plain text so browsers render them inline rather than prompting a download.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
        tmp_path {Path} -- pytest-provided temp directory containing the output files
    """
    output = tmp_path / "output"
    output.mkdir()
    (output / "run.log").write_text("hello log")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/run.log")

    assert response.status_code == 200
    assert response.text == "hello log"
    assert response.mimetype == "text/plain"


def test_get_run_file_serves_nested_file(client, authenticated_user, run_doc, tmp_path):
    """Pipeline outputs may include subdirectories; nested paths must be served as long as they resolve inside the run's output directory.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
        tmp_path {Path} -- pytest-provided temp directory containing the nested output files
    """
    output = tmp_path / "output"
    nested = output / "annotation"
    nested.mkdir(parents=True)
    (nested / "run.log").write_text("nested log")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/annotation/run.log")

    assert response.status_code == 200
    assert response.text == "nested log"


def test_get_run_file_serves_yaml_as_attachment(client, authenticated_user, run_doc, tmp_path):
    """YAML config files must be served as attachments to trigger a browser download rather than inline rendering.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
        tmp_path {Path} -- pytest-provided temp directory containing the output files
    """
    output = tmp_path / "output"
    output.mkdir()
    (output / "config.yml").write_text("a: 1")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/config.yml")

    assert response.status_code == 200
    assert "attachment" in response.headers["Content-Disposition"]


def test_get_run_file_serves_fna_as_octet_stream(client, authenticated_user, run_doc, tmp_path):
    """FASTA files must be served as octet-stream so browsers download them rather than attempting to render binary content.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
        tmp_path {Path} -- pytest-provided temp directory containing the output files
    """
    output = tmp_path / "output"
    output.mkdir()
    (output / "result.fna").write_text(">x\nAC\n")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/result.fna")

    assert response.status_code == 200
    assert response.mimetype == "application/octet-stream"


def test_get_run_file_rejects_unsupported_extension(client, authenticated_user, run_doc, tmp_path):
    """Unknown file extensions must be blocked by default so only explicitly permitted types are ever served from run output directories.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
        tmp_path {Path} -- pytest-provided temp directory containing the output files
    """
    # File serving uses an allowlist rather than a denylist: unknown extensions
    # are blocked by default and must be explicitly permitted to be served.
    output = tmp_path / "output"
    output.mkdir()
    (output / "result.exe").write_text("no")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/result.exe")

    assert response.status_code == 400


def test_get_run_file_rejects_path_traversal(client, authenticated_user, run_doc, tmp_path):
    """Path traversal attempts must be caught before filesystem access so attackers cannot use a valid run ID to read files outside the run directory.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
        tmp_path {Path} -- pytest-provided temp directory used as the output root

    Notes:
        URL-encoded variants (`%2e%2e`) are tested because Flask decodes them
        before routing, but double-encoding or partial encoding can bypass naive
        string-based checks that only look for literal `..`.
    """
    output = tmp_path / "output"
    output.mkdir()
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/%2e%2e/secret.txt")

    assert response.status_code == 400


def test_get_run_file_404_for_missing_file(client, authenticated_user, run_doc, tmp_path):
    """A request for a file that does not exist inside the output directory must return 404 rather than a server error.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
        tmp_path {Path} -- pytest-provided temp directory used as an empty output directory
    """
    output = tmp_path / "output"
    output.mkdir()
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.get(f"/api/runs/{run_id}/files/missing.log")

    assert response.status_code == 404


def test_get_run_file_500_for_missing_output_path(client, authenticated_user, run_doc):
    """A run with no output_path on the document must return 500 because it indicates the run was never properly initialized.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document without an output_path
    """
    run_id = run_doc(user_id=TEST_USER_ID)

    response = client.get(f"/api/runs/{run_id}/files/run.log")

    assert response.status_code == 500


def test_delete_run_removes_output_directory_and_db_record(client, authenticated_user, run_doc, tmp_path):
    """Deleting a run must remove both the MongoDB document and the output directory so storage is reclaimed and no orphaned files remain.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
        tmp_path {Path} -- pytest-provided temp directory containing the output files to be deleted
    """
    output = tmp_path / "output"
    output.mkdir()
    (output / "run.log").write_text("log")
    run_id = run_doc(user_id=TEST_USER_ID, output_path=output)

    response = client.delete(f"/api/runs/{run_id}")

    assert response.status_code == 200
    assert not output.exists()
    assert db.runs.find_one({"_id": run_id}) is None


def test_delete_run_404_for_unowned_run(client, authenticated_user, run_doc, tmp_path):
    """Deletion of another user's run must return 404 without touching the output directory or DB record.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document owned by another user
        tmp_path {Path} -- pytest-provided temp directory used to verify the output was not deleted
    """
    output = tmp_path / "output"
    output.mkdir()
    run_id = run_doc(user_id=OTHER_USER_ID, output_path=output)

    response = client.delete(f"/api/runs/{run_id}")

    assert response.status_code == 404
    assert output.exists()
    assert db.runs.find_one({"_id": run_id}) is not None


def test_get_run_config_success(client, authenticated_user, run_doc):
    """A stored pipeline_run_config must be returned verbatim so the frontend can replay the exact parameters used for a previous run.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
    """
    config = {"pipeline": "merfish", "values": {"a": 1}}
    run_id = run_doc(user_id=TEST_USER_ID, pipeline_run_config=config)

    response = client.get(f"/api/runs/{run_id}/config")

    assert response.status_code == 200
    assert response.get_json() == config


def test_get_run_config_404_when_absent(client, authenticated_user, run_doc):
    """Runs without a stored config must return 404 so the frontend knows config replay is unavailable for that run.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document without a pipeline_run_config
    """
    run_id = run_doc(user_id=TEST_USER_ID)

    response = client.get(f"/api/runs/{run_id}/config")

    assert response.status_code == 404


def test_get_run_config_404_for_missing_run(client, authenticated_user):
    """A config request for a non-existent run must return 404 rather than a server error.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
    """
    response = client.get(f"/api/runs/{ObjectId()}/config")

    assert response.status_code == 404


def test_get_run_config_404_for_unowned_run(client, authenticated_user, run_doc):
    """Config must not be accessible for another user's run to prevent parameter disclosure across user boundaries.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document owned by another user
    """
    run_id = run_doc(
        user_id=OTHER_USER_ID,
        pipeline_run_config={"pipeline": "merfish"},
    )

    response = client.get(f"/api/runs/{run_id}/config")

    assert response.status_code == 404


def test_get_run_status_success(client, authenticated_user, run_doc):
    """The status endpoint must return the current run state as a lightweight object so the frontend can poll without fetching the full run document.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document and returns its id
    """
    run_id = run_doc(user_id=TEST_USER_ID, status="started")

    response = client.get(f"/api/runs/{run_id}/status")

    assert response.status_code == 200
    assert response.get_json() == {"state": "started"}


def test_get_run_status_404_for_unowned_run(client, authenticated_user, run_doc):
    """Status polling for another user's run must return 404 to prevent information leakage about runs the caller does not own.

    Arguments:
        client {Any} -- Flask test client
        authenticated_user {AuthenticatedUser} -- active authenticated session
        run_doc {Callable} -- factory that inserts a run document owned by another user
    """
    run_id = run_doc(user_id=OTHER_USER_ID, status="started")

    response = client.get(f"/api/runs/{run_id}/status")

    assert response.status_code == 404
