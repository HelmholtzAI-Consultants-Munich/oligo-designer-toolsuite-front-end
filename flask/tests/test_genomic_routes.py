import pytest

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

def test_genomic_single_ensembl(client, dummy_form_ensembl, mock_run,authenticated_user):
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