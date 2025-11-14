import pytest
import sys
import os
from unittest.mock import patch
from bson import ObjectId
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app
import os

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    app.secret_key = 'test-key'
    with app.test_client() as client:
        with app.app_context():
            yield client

@pytest.fixture
def dummy_form_ncbi():
    return {
        "source": {"value": "NCBI"},
        "source_params": {
            "taxon": {"value": "9606"},
            "species": {"value": "Homo_sapiens"},
            "annotation_release": {"value": "110"}
        },
        "genomic_regions": {
            "gene": {"value": "true"},
            "intergenic": {"value": "false"},
            "exon": {"value": "true"},
            "exon_exon_junction": {"value": "false"},
            "utr": {"value": "false"},
            "cds": {"value": "false"},
            "intron": {"value": "false"}
        },
        "exon_exon_junction_block_size": {"value": "75"}
    }

@pytest.fixture
def dummy_form_ensembl():
    return {
        "source": {"value": "Ensembl"},
        "source_params": {
            "species": {"value": "Mus_musculus"},
            "annotation_release": {"value": "110"}
        },
        "genomic_regions": {
            "gene": {"value": "true"},
            "intergenic": {"value": "false"},
            "exon": {"value": "true"},
            "exon_exon_junction": {"value": "false"},
            "utr": {"value": "false"},
            "cds": {"value": "false"},
            "intron": {"value": "false"}
        },
        "exon_exon_junction_block_size": {"value": "75"}
    }

def test_genomic_cascaded_ncbi(client, monkeypatch, dummy_form_ncbi):
    dummy_form = dummy_form_ncbi

    class DummyUser:
        is_authenticated = True
        id = "testuser123"
    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "mock success"
        mock_run.return_value.stderr = ""

        response = client.post("/api/genomic/cascaded/ncbi", json=dummy_form)
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "success"
        assert "message" in data
        assert "output" in data

def test_genomic_cascaded_ncbi_unauthenticated(client, dummy_form_ncbi):
    dummy_form = dummy_form_ncbi

    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "mock success"
        mock_run.return_value.stderr = ""

        response = client.post("/api/genomic/cascaded/ncbi", json=dummy_form)
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "success"
        assert "message" in data
        assert "output" in data

def test_genomic_single_ensembl(client, monkeypatch, dummy_form_ensembl):
    dummy_form = dummy_form_ensembl

    class DummyUser:
        is_authenticated = True
        id = "testuser123"
    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "mock success"
        mock_run.return_value.stderr = ""

        response = client.post("/api/genomic/cascaded/ensembl", json=dummy_form)
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "success"
        assert "message" in data
        assert "output" in data

def test_genomic_single_ensembl_unauthenticated(client, dummy_form_ensembl):
    dummy_form = dummy_form_ensembl

    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "mock success"
        mock_run.return_value.stderr = ""

        response = client.post("/api/genomic/cascaded/ensembl", json=dummy_form)
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "success"
        assert "message" in data
        assert "output" in data