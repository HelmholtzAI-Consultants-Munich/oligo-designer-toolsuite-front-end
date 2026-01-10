import pytest

from conftest import assert_error_sanitized


@pytest.fixture
def dummy_form_ncbi():
    return {
        "source": {"value": "NCBI"},
        "source_params": {
            "taxon": {"value": "9606"},
            "species": {"value": "Homo_sapiens"},
            "annotation_release": {"value": "110"},
        },
        "genomic_regions": {
            "gene": {"value": "true"},
            "intergenic": {"value": "false"},
            "exon": {"value": "true"},
            "exon_exon_junction": {"value": "false"},
            "utr": {"value": "false"},
            "cds": {"value": "false"},
            "intron": {"value": "false"},
        },
        "exon_exon_junction_block_size": {"value": "75"},
    }


@pytest.fixture
def dummy_form_ensembl():
    return {
        "source": {"value": "Ensembl"},
        "source_params": {"species": {"value": "Mus_musculus"}, "annotation_release": {"value": "110"}},
        "genomic_regions": {
            "gene": {"value": "true"},
            "intergenic": {"value": "false"},
            "exon": {"value": "true"},
            "exon_exon_junction": {"value": "false"},
            "utr": {"value": "false"},
            "cds": {"value": "false"},
            "intron": {"value": "false"},
        },
        "exon_exon_junction_block_size": {"value": "75"},
    }


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
def test_genomic_cascaded_ncbi_invalid_input(client, authenticated_user):
    """Test genomic_cascaded_ncbi with invalid input returns sanitized error."""
    invalid_form = {"source": {"value": "Invalid"}}

    response = client.post("/api/genomic/cascaded/ncbi", json=invalid_form)
    assert response.status_code in [400, 500]  # Could be either depending on where it fails
    data = response.get_json()
    assert data["status"] == "error"
    assert "error" in data
    # Verify error is user-friendly and sanitized
    assert "We couldn't process your genomic data" in data["message"]
    # Verify no raw error strings exposed
    assert_error_sanitized(data)


def test_genomic_cascaded_ncbi_subprocess_failure(client, dummy_form_ncbi, authenticated_user):
    """Test genomic_cascaded_ncbi with subprocess failure returns sanitized error."""
    from unittest.mock import patch

    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/genomic/cascaded/ncbi", json=dummy_form_ncbi)
        assert response.status_code == 500
        data = response.get_json()
        assert data["status"] == "error"
        assert "error" in data
        # Verify error is sanitized
        assert "Subprocess failed" not in data["error"]
        assert data["error"] == "The pipeline failed to execute. Please check your input and try again."


def test_genomic_cascaded_ensembl_invalid_input(client, authenticated_user):
    """Test genomic_cascaded_ensembl with invalid input returns sanitized error."""
    invalid_form = {"source": {"value": "Invalid"}}

    response = client.post("/api/genomic/cascaded/ensembl", json=invalid_form)
    assert response.status_code in [400, 500]
    data = response.get_json()
    assert data["status"] == "error"
    assert "error" in data
    # Verify error is user-friendly
    assert "We couldn't process your genomic data" in data["message"]
    # Verify no raw error strings exposed
    assert_error_sanitized(data)


def test_genomic_cascaded_ensembl_subprocess_failure(client, dummy_form_ensembl, authenticated_user):
    """Test genomic_cascaded_ensembl with subprocess failure returns sanitized error."""
    from unittest.mock import patch

    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/genomic/cascaded/ensembl", json=dummy_form_ensembl)
        assert response.status_code == 500
        data = response.get_json()
        assert data["status"] == "error"
        assert "error" in data
        # Verify error is sanitized
        assert "Subprocess failed" not in data["error"]


def test_genomic_cascaded_custom_invalid_input(client, authenticated_user):
    """Test genomic_cascaded_custom with invalid input returns sanitized error."""
    invalid_form = {"source": {"value": "Custom"}, "file_regions": {"value": ""}}

    response = client.post("/api/genomic/cascaded/custom", json=invalid_form)
    assert response.status_code in [400, 500]
    data = response.get_json()
    assert data["status"] == "error"
    assert "error" in data
    # Verify error is user-friendly
    assert "We couldn't process your genomic data" in data["message"]
    # Verify no raw error strings exposed
    assert_error_sanitized(data)


def test_genomic_cascaded_custom_subprocess_failure(client, authenticated_user):
    """Test genomic_cascaded_custom with subprocess failure returns sanitized error."""
    from unittest.mock import patch

    custom_form = {
        "source": {"value": "Custom"},
        "file_regions": {"value": "test.fna"},
        "genomic_regions": {
            "gene": {"value": "true"},
            "intergenic": {"value": "false"},
            "exon": {"value": "false"},
            "exon_exon_junction": {"value": "false"},
            "utr": {"value": "false"},
            "cds": {"value": "false"},
            "intron": {"value": "false"},
        },
    }

    with patch("subprocess.run", side_effect=RuntimeError("Subprocess failed")):
        response = client.post("/api/genomic/cascaded/custom", json=custom_form)
        assert response.status_code == 500
        data = response.get_json()
        assert data["status"] == "error"
        assert "error" in data
        # Verify error is sanitized
        assert "Subprocess failed" not in data["error"]


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
        with patch("routes.genomic._prepare_ncbi_cached_assets", side_effect=exc):
            response = client.post(
                "/api/genomic/cascaded/ncbi",
                json={"source": {"value": "NCBI"}, "genomic_regions": {"gene": {"value": "true"}}},
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
