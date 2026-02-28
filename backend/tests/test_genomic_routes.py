import json
import os
from unittest.mock import MagicMock, patch

import pytest

from backend.extensions import mongo
from backend.genomic_databases import EnsemblGenomicDataBase, NCBIGenomicDataBase
from backend.tests.conftest import assert_error_sanitized

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
def dummy_form_ncbi():
    form_path = os.path.join(os.path.dirname(__file__), "data/genomic_ncbi_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    return form


@pytest.fixture
def dummy_form_ensembl():
    form_path = os.path.join(os.path.dirname(__file__), "data/genomic_ensembl_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    return form


@pytest.fixture
def dummy_form_custom():
    form_path = os.path.join(os.path.dirname(__file__), "data/genomic_custom_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    return form


@pytest.fixture
def release_queries():
    form_path = os.path.join(os.path.dirname(__file__), "data/genomic_releases_queries.json")
    with open(form_path) as f:
        form = json.load(f)
    return form


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_cascaded_custom_ncbi(
    client, dummy_form_ncbi, mock_run, authenticated_user, verify_file_mock, cache_dir_mock
):
    dummy_form = dummy_form_ncbi

    response = client.post("/api/genomic/cascaded/custom", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_cascaded_custom_ncbi_unauthenticated(
    client, dummy_form_ncbi, mock_run, session_user, verify_file_mock, cache_dir_mock
):
    dummy_form = dummy_form_ncbi

    response = client.post("/api/genomic/cascaded/custom", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


def test_genomic_cascaded_custom_single_ensembl(
    client, dummy_form_ensembl, mock_run, authenticated_user, verify_file_mock, cache_dir_mock
):
    dummy_form = dummy_form_ensembl

    response = client.post("/api/genomic/cascaded/custom", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


def test_genomic_cascaded_custom_single_ensembl_unauthenticated(
    client, dummy_form_ensembl, mock_run, session_user, verify_file_mock, cache_dir_mock
):
    dummy_form = dummy_form_ensembl

    response = client.post("/api/genomic/cascaded/custom", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


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
    expected_message_substring=None,
    expected_error_message=None,
    forbidden_strings=None,
    check_sanitized=False,
):
    """
    Helper function to assert genomic route error responses.

    Args:
        response: Flask test client response object
        expected_status_codes: Expected status code(s) - can be int or list/tuple
        expected_message_substring: Substring that should be in data["message"] (optional)
        expected_error_message: Exact error message expected in data["error"] (optional)
        forbidden_strings: List of strings that should NOT be in data["error"] (optional)
        check_sanitized: Whether to call assert_error_sanitized (default: False)
    """
    if isinstance(expected_status_codes, list | tuple):
        assert response.status_code in expected_status_codes
    else:
        assert response.status_code == expected_status_codes

    data = response.get_json()
    assert data["status"] == "error"
    assert "error" in data

    if expected_message_substring:
        assert expected_message_substring in data["message"]

    if expected_error_message:
        assert data["error"] == expected_error_message

    if forbidden_strings:
        for forbidden in forbidden_strings:
            assert forbidden not in data["error"]

    if check_sanitized:
        assert_error_sanitized(data)


def test_genomic_cascaded_custom_invalid_input(client, authenticated_user):
    """Test genomic_cascaded_ncbi with invalid input returns sanitized error."""
    invalid_form = {"source": "Invalid"}

    response = client.post("/api/genomic/cascaded/custom", json=invalid_form)
    _assert_genomic_error_response(
        response,
        expected_status_codes=400,
        expected_message_substring="Invalid input",
        check_sanitized=True,
    )


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_cascaded_custom_ncbi_subprocess_failure(
    client, dummy_form_ncbi, authenticated_user, verify_file_mock, cache_dir_mock
):
    """Test genomic_cascaded_ncbi with subprocess failure returns sanitized error."""
    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/genomic/cascaded/custom", json=dummy_form_ncbi)
        _assert_genomic_error_response(
            response,
            expected_status_codes=500,
            forbidden_strings=["Subprocess failed"],
        )


def test_genomic_cascaded_ensembl_invalid_input(client, authenticated_user):
    """Test genomic_cascaded_ensembl with invalid input returns sanitized error."""
    invalid_form = {"source": "Invalid"}

    response = client.post("/api/genomic/cascaded/custom", json=invalid_form)
    _assert_genomic_error_response(
        response,
        expected_status_codes=400,
        expected_message_substring="Invalid input",
        check_sanitized=True,
    )


def test_genomic_cascaded_custom_ensembl_subprocess_failure(
    client, dummy_form_ensembl, authenticated_user, verify_file_mock, cache_dir_mock
):
    """Test genomic_cascaded_ensembl with subprocess failure returns sanitized error."""
    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/genomic/cascaded/custom", json=dummy_form_ensembl)
        _assert_genomic_error_response(
            response,
            expected_status_codes=500,
            forbidden_strings=["Subprocess failed"],
        )


def test_genomic_routes_no_str_e_exposed(client, authenticated_user, cache_dir_mock):
    """Test that no str(e) is exposed in genomic route error responses."""
    # Test with various exception types
    exceptions = [
        ValueError("Invalid input"),
        FileNotFoundError("/path/to/file.txt"),
        PermissionError("Permission denied"),
        KeyError("missing_key"),
    ]

    for exc in exceptions:
        with patch("backend.routes.genomic.NCBIGenomicDataBase.prepare_cached_assets", side_effect=exc):
            response = client.post(
                "/api/genomic/cascaded/custom",
                json={"source": "NCBI", "genomic_regions": {"gene": "true"}},
            )
            data = response.get_json()
            assert data["status"] == "error"
            # Verify no raw exception strings exposed
            # Check that the full exception representation isn't exposed
            # (e.g., "ValueError('Invalid input')" should not appear)
            exc_repr = repr(exc)
            assert exc_repr not in str(data)
            # Also check that sensitive parts aren't exposed
            if isinstance(exc, FileNotFoundError):
                assert "/path/to/file.txt" not in str(data)
            # Verify error field contains user-friendly message
            assert "error" in data
            assert isinstance(data["error"], str)
            assert len(data["error"]) > 0


@pytest.mark.xfail(reason="flaky, NCBI sometimes returns 403")
def test_genomic_cascaded_custom_ncbi_session_without_directory(
    client, dummy_form_ncbi, mock_run, verify_file_mock, cache_dir_mock
):
    """Test genomic_cascaded_ncbi with existing session creates directory and succeeds."""
    dummy_form = dummy_form_ncbi
    with client.session_transaction() as session:
        # Set a session_id (simulating an existing permanent session)
        session["session_id"] = "existing-session-123"

    # Create a mock result that mimics subprocess.CompletedProcess
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "success"
    mock_result.stderr = ""

    # Patch subprocess.run where it's used in genomic routes
    with patch("backend.routes.genomic.subprocess.run", return_value=mock_result):
        # With makedirs mock disabled, directories will be created and request should succeed
        response = client.post("/api/genomic/cascaded/custom", json=dummy_form)
        assert response.status_code == 200


def test_genomic_single_custom_ensembl_session_without_directory(
    client, dummy_form_ensembl, mock_run, verify_file_mock, cache_dir_mock
):
    """Test genomic_cascaded_ensembl with existing session creates directory and succeeds."""
    dummy_form = dummy_form_ensembl
    with client.session_transaction() as session:
        # Set a session_id (simulating an existing permanent session)
        session["session_id"] = "existing-session-123"

    # Create a mock result that mimics subprocess.CompletedProcess
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "success"
    mock_result.stderr = ""

    # Patch subprocess.run where it's used in genomic routes
    with patch("backend.routes.genomic.subprocess.run", return_value=mock_result):
        # With makedirs mock disabled, directories will be created and request should succeed
        response = client.post("/api/genomic/cascaded/custom", json=dummy_form)
        assert response.status_code == 200
