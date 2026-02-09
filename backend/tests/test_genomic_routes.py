import json
import os

import pytest

from backend.tests.conftest import assert_error_sanitized


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


def test_genomic_cascaded_ncbi(client, dummy_form_ncbi, mock_run, authenticated_user):
    dummy_form = dummy_form_ncbi

    response = client.post("/api/genomic/cascaded/ncbi", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


def test_genomic_cascaded_ncbi_unauthenticated(client, dummy_form_ncbi, mock_run, session_user):
    dummy_form = dummy_form_ncbi

    response = client.post("/api/genomic/cascaded/ncbi", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


def test_genomic_single_ensembl(client, dummy_form_ensembl, mock_run, authenticated_user):
    dummy_form = dummy_form_ensembl

    response = client.post("/api/genomic/cascaded/ensembl", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


def test_genomic_single_ensembl_unauthenticated(client, dummy_form_ensembl, mock_run, session_user):
    dummy_form = dummy_form_ensembl

    response = client.post("/api/genomic/cascaded/ensembl", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "message" in data
    assert "output" in data


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


def test_genomic_cascaded_ncbi_invalid_input(client, authenticated_user):
    """Test genomic_cascaded_ncbi with invalid input returns sanitized error."""
    invalid_form = {"source": "Invalid"}

    response = client.post("/api/genomic/cascaded/ncbi", json=invalid_form)
    _assert_genomic_error_response(
        response,
        expected_status_codes=400,
        expected_message_substring="Invalid input",
        check_sanitized=True,
    )


def test_genomic_cascaded_ncbi_subprocess_failure(client, dummy_form_ncbi, authenticated_user):
    """Test genomic_cascaded_ncbi with subprocess failure returns sanitized error."""
    from unittest.mock import patch

    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/genomic/cascaded/ncbi", json=dummy_form_ncbi)
        _assert_genomic_error_response(
            response,
            expected_status_codes=500,
            forbidden_strings=["Subprocess failed"],
        )


def test_genomic_cascaded_ensembl_invalid_input(client, authenticated_user):
    """Test genomic_cascaded_ensembl with invalid input returns sanitized error."""
    invalid_form = {"source": "Invalid"}

    response = client.post("/api/genomic/cascaded/ensembl", json=invalid_form)
    _assert_genomic_error_response(
        response,
        expected_status_codes=400,
        expected_message_substring="Invalid input",
        check_sanitized=True,
    )


def test_genomic_cascaded_ensembl_subprocess_failure(client, dummy_form_ensembl, authenticated_user):
    """Test genomic_cascaded_ensembl with subprocess failure returns sanitized error."""
    from unittest.mock import patch

    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/genomic/cascaded/ensembl", json=dummy_form_ensembl)
        _assert_genomic_error_response(
            response,
            expected_status_codes=500,
            forbidden_strings=["Subprocess failed"],
        )


def test_genomic_cascaded_custom_invalid_input(client, authenticated_user):
    """Test genomic_cascaded_custom with invalid input returns sanitized error."""
    invalid_form = {"source": "Custom", "file_regions": ""}

    response = client.post("/api/genomic/cascaded/custom", json=invalid_form)
    _assert_genomic_error_response(
        response,
        expected_status_codes=400,
        expected_message_substring="Invalid input",
        check_sanitized=True,
    )


def test_genomic_cascaded_custom_subprocess_failure(client, authenticated_user, dummy_form_custom):
    """Test genomic_cascaded_custom with missing source_params returns 400 validation error.

    The fixture data has source='Custom' but no source_params, so the route correctly
    aborts with 400 before reaching subprocess.run.
    """
    from unittest.mock import patch

    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/genomic/cascaded/custom", json=dummy_form_custom)
        _assert_genomic_error_response(
            response,
            expected_status_codes=400,
            expected_message_substring="requires",
        )


def test_genomic_routes_no_str_e_exposed(client, authenticated_user):
    """Test that no str(e) is exposed in genomic route error responses."""
    from unittest.mock import patch

    # Test with various exception types
    exceptions = [
        ValueError("Invalid input"),
        FileNotFoundError("/path/to/file.txt"),
        PermissionError("Permission denied"),
        KeyError("missing_key"),
    ]

    for exc in exceptions:
        with patch("backend.routes.genomic._prepare_ncbi_cached_assets", side_effect=exc):
            response = client.post(
                "/api/genomic/cascaded/ncbi",
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


def test_genomic_cascaded_ncbi_session_without_directory(client, dummy_form_ncbi, mock_run):
    """Test genomic_cascaded_ncbi with existing session creates directory and succeeds."""
    from unittest.mock import MagicMock, patch

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
        response = client.post("/api/genomic/cascaded/ncbi", json=dummy_form)
        assert response.status_code == 200


def test_genomic_single_ensembl_session_without_directory(client, dummy_form_ensembl, mock_run):
    """Test genomic_cascaded_ensembl with existing session creates directory and succeeds."""
    from unittest.mock import MagicMock, patch

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
        response = client.post("/api/genomic/cascaded/ensembl", json=dummy_form)
        assert response.status_code == 200
