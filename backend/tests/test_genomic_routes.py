import json
import os
from unittest.mock import MagicMock, patch

import pytest

from backend.extensions import mongo
from backend.genomic_databases import EnsemblGenomicDataBase, NCBIGenomicDataBase
from backend.tests.conftest import assert_error_sanitized, post

"""
This tests the genomic api routes and therefore also the Genomic Database classes.
Behavior that is mocked:
- file verification
- dropdown fetching
- input forms
- file downloading
Behavior that is tested:
- get release/ actual ftp directory from input form
- correct behavior for downloaded files
"""


@pytest.fixture
def verify_file_mock(monkeypatch):
    def mock_return(a, b, c):
        return True

    monkeypatch.setattr(NCBIGenomicDataBase, "_verify_file", mock_return)
    monkeypatch.setattr(EnsemblGenomicDataBase, "_verify_file", mock_return)


@pytest.fixture
def dropdown_mock(monkeypatch):
    mongo.db.cache.update_one(
        {"_id": 1},
        {
            "$set": {
                "data": {
                    "ncbi": {"archaea": {f"{k}": 1 for k in range(1500)}},
                    "ensembl": [1 for _ in range(150)],
                }
            }
        },
        upsert=True,
    )
    yield
    mongo.db.cache.delete_one({"_id": 1})


@pytest.fixture
def cache_dir_mock(monkeypatch, app):
    return monkeypatch.setattr(app, "root_path", os.path.join(os.path.dirname(__file__), "data/"))


@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for oligoseq API
    form_path = os.path.join(os.path.dirname(__file__), "data/oligoseq_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    form["runid"] = str(run_id)
    return form


@pytest.fixture
def dummy_form_ncbi(dummy_form):
    form_path = os.path.join(os.path.dirname(__file__), "data/genomic_ncbi_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    dummy_form["formdata"]["files_fasta_target_probe_database"] = {"fasta_form": [form], "files": []}
    dummy_form["formdata"]["files_fasta_reference_database_target_probe"] = {
        "fasta_form": [form],
        "files": [],
    }
    return dummy_form


@pytest.fixture
def dummy_form_ensembl(dummy_form):
    form_path = os.path.join(os.path.dirname(__file__), "data/genomic_ensembl_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    dummy_form["formdata"]["files_fasta_target_probe_database"] = {"fasta_form": [form], "files": []}
    dummy_form["formdata"]["files_fasta_reference_database_target_probe"] = {
        "fasta_form": [form],
        "files": [],
    }
    return dummy_form


@pytest.fixture
def release_queries():
    form_path = os.path.join(os.path.dirname(__file__), "data/genomic_releases_queries.json")
    with open(form_path) as f:
        form = json.load(f)
    return form


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_cascaded_ncbi(
    client, dummy_form_ncbi, mock_run, mock_celery, authenticated_user, verify_file_mock, cache_dir_mock
):
    dummy_form = dummy_form_ncbi

    response = client.post("/api/oligoseq", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_cascaded_ncbi_unauthenticated(
    client, dummy_form_ncbi, mock_run, mock_celery, session_user, verify_file_mock, cache_dir_mock
):
    dummy_form = dummy_form_ncbi

    response = client.post("/api/oligoseq", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


def test_genomic_cascaded_single_ensembl(
    client,
    run_id,
    dummy_form_ensembl,
    mock_run,
    mock_celery,
    authenticated_user,
    verify_file_mock,
    cache_dir_mock,
):
    dummy_form = dummy_form_ensembl

    response = post(client, "/api/oligoseq", dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)


def test_genomic_cascaded_single_ensembl_unauthenticated(
    client, run_id, dummy_form_ensembl, mock_run, mock_celery, session_user, verify_file_mock, cache_dir_mock
):
    dummy_form = dummy_form_ensembl

    response = post(client, "/api/oligoseq", dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)


def test_genomic_dropdown(client, dropdown_mock):
    response = client.get("/api/genomic/dropdown")
    assert response.status_code == 200

    data = response.get_json()

    assert "ncbi" in data
    assert "ensembl" in data
    assert "archaea" in data["ncbi"]
    assert len(data["ncbi"]["archaea"]) > 1000
    assert len(data["ensembl"]) > 100


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_releases(client, release_queries):
    for entry in release_queries:
        response = client.get(f"/api/genomic/releases/{entry['taxon']}/{entry['species']}")

        assert response.status_code == 200

        data = response.get_json()

        assert data == entry["result"]


# Error handling tests
def _assert_genomic_error_response(
    response,
    expected_status_codes,
    expected_error_substring=None,
    forbidden_strings=None,
    check_sanitized=False,
):
    """
    Helper function to assert genomic route error responses.

    Args:
        response: Flask test client response object
        expected_status_codes: Expected status code(s) - can be int or list/tuple
        expected_error_message: Exact error message expected in data["error"] (optional)
        forbidden_strings: List of strings that should NOT be in data["error"] (optional)
        check_sanitized: Whether to call assert_error_sanitized (default: False)
    """
    if isinstance(expected_status_codes, list | tuple):
        assert response.status_code in expected_status_codes
    else:
        assert response.status_code == expected_status_codes

    data = response.get_json()
    assert "error" in data

    if expected_error_substring:
        assert expected_error_substring in data["error"]

    if forbidden_strings:
        for forbidden in forbidden_strings:
            assert forbidden not in data["error"]

    if check_sanitized:
        assert_error_sanitized(data)


def test_genomic_cascaded_ncbi_invalid_input(client, authenticated_user, dummy_form_ncbi):
    """Test genomic_cascaded_ncbi with invalid input returns sanitized error."""

    dummy_form_ncbi["formdata"]["files_fasta_target_probe_database"] = {
        "fasta_form": [{"source": "Invalid"}],
        "files": [],
    }

    response = post(client, "/api/oligoseq", dummy_form_ncbi)
    _assert_genomic_error_response(
        response,
        expected_status_codes=400,
        expected_error_substring="Invalid input",
        check_sanitized=True,
    )


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_cascaded_ncbi_subprocess_failure(
    client, dummy_form_ncbi, authenticated_user, verify_file_mock, cache_dir_mock
):
    """Test genomic_cascaded_ncbi with subprocess failure returns sanitized error."""
    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/oligoseq", json=dummy_form_ncbi)
        _assert_genomic_error_response(
            response,
            expected_status_codes=500,
            forbidden_strings=["Subprocess failed"],
        )


def test_genomic_cascaded_ensembl_invalid_input(client, authenticated_user, dummy_form_ensembl):
    """Test genomic_cascaded_ensembl with invalid input returns sanitized error."""
    dummy_form_ensembl["formdata"]["files_fasta_target_probe_database"] = {
        "fasta_form": [{"source": "Invalid"}],
        "files": [],
    }

    response = post(client, "/api/oligoseq", dummy_form_ensembl)
    _assert_genomic_error_response(
        response,
        expected_status_codes=400,
        expected_error_substring="Invalid input",
        check_sanitized=True,
    )


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_cascaded_ncbi_session_without_directory(
    client, dummy_form_ncbi, mock_run, mock_celery, verify_file_mock, cache_dir_mock, session_user
):
    """Test genomic_cascaded_ncbi with existing session creates directory and succeeds."""
    dummy_form = dummy_form_ncbi
    # Create a mock result that mimics subprocess.CompletedProcess
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "success"
    mock_result.stderr = ""

    # Patch subprocess.run where it's used in genomic routes
    with patch("backend.routes.genomic.subprocess.run", return_value=mock_result):
        # With makedirs mock disabled, directories will be created and request should succeed
        response = client.post("/api/oligoseq", json=dummy_form)
        assert response.status_code == 200


def test_genomic_single_ensembl_session_without_directory(
    client, dummy_form_ensembl, mock_run, mock_celery, verify_file_mock, cache_dir_mock, session_user
):
    """Test genomic_cascaded_ensembl with existing session creates directory and succeeds."""
    dummy_form = dummy_form_ensembl
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "success"
    mock_result.stderr = ""

    with patch("backend.routes.genomic.subprocess.run", return_value=mock_result):
        response = client.post("/api/oligoseq", json=dummy_form)
        assert response.status_code == 200


def test_genomic_requires_terms_acceptance(client, dummy_form_ensembl):
    response = client.post("/api/oligoseq", json=dummy_form_ensembl)
    assert response.status_code == 403
    assert "accept the current Terms of Service and Privacy Policy" in response.get_json()["error"]
