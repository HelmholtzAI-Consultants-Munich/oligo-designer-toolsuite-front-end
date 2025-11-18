import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pytest
from bson import ObjectId
from unittest.mock import patch
from app import create_app
from extensions import mongo

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    app.secret_key = 'test-key'
    with app.test_client() as client:
        with app.app_context():
            yield client

@pytest.fixture
def run_id():
    # Insert dummy run
    return mongo.db.runs.insert_one({"status": "created"}).inserted_id

@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for scrinshot API
    return {
        "formdata": {
            "n_jobs": {"value": "1"},
            "write_intermediate_steps": {"value": "false"},
            "top_n_sets": {"value": "3"},
            "file_regions": {"value": "dummy_region.fna"},
            "files_fasta_target_probe_database": {"value": "target1.fna\ntarget2.fna"},
            "files_fasta_reference_database_target_probe": {"value": "ref1.fna\nref2.fna"},
            "target_probe_length_min": {"value": "20"},
            "target_probe_length_max": {"value": "40"},
            "target_probe_isoform_consensus": {"value": "1"},
            "target_probe_GC_content_min": {"value": "30"},
            "target_probe_GC_content_opt": {"value": "50"},
            "target_probe_GC_content_max": {"value": "70"},
            "target_probe_Tm_min": {"value": "60"},
            "target_probe_Tm_opt": {"value": "65"},
            "target_probe_Tm_max": {"value": "75"},
            "target_probe_homopolymeric_base_n": {
                "A": {"value": "3"},
                "T": {"value": "3"},
                "C": {"value": "3"},
                "G": {"value": "3"}
            },
            "target_probe_padlock_arm_Tm_dif_max": {"value": "10"},
            "target_probe_padlock_arm_length_min": {"value": "15"},
            "target_probe_padlock_arm_Tm_min": {"value": "55"},
            "target_probe_padlock_arm_Tm_max": {"value": "70"},
            "detection_oligo_min_thymines": {"value": "2"},
            "detection_oligo_length_min": {"value": "15"},
            "detection_oligo_length_max": {"value": "25"},
            "target_probe_ligation_region_size": {"value": "8"},
            "target_probe_isoform_weight": {"value": "1"},
            "target_probe_GC_weight": {"value": "1"},
            "target_probe_Tm_weight": {"value": "1"},
            "set_size_min": {"value": "10"},
            "set_size_opt": {"value": "15"},
            "distance_between_target_probes": {"value": "5"},
            "n_sets": {"value": "1"},
            "detection_oligo_U_distance": {"value": "2"},
            "detection_oligo_Tm_opt": {"value": "62"},
            "target_probe_specificity_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
                "dust": {"value": "yes"},
                "soft_masking": {"value": "true"},
                "max_target_seqs": {"value": "500"},
                "max_hsps": {"value": "10"}
            },
            "target_probe_specificity_blastn_hit_parameters": {
                "coverage": {"value": "80"}
            },
            "target_probe_cross_hybridization_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
                "dust": {"value": "yes"},
                "soft_masking": {"value": "true"},
                "max_target_seqs": {"value": "500"}
            },
            "target_probe_cross_hybridization_blastn_hit_parameters": {
                "coverage": {"value": "80"}
            },
            "max_graph_size": {"value": "1000"},
            "n_attempts": {"value": "3"},
            "heuristic": {"value": "false"},
            "heuristic_n_attempts": {"value": "2"},
            "target_probe_Tm_parameters": {
                "nn_table": {"value": "DNA_NN1"},
                "tmm_table": {"value": "DNA_TMM1"},
                "imm_table": {"value": "DNA_IMM1"},
                "de_table": {"value": "DNA_DE1"},
                "dnac1": {"value": "50"},
                "dnac2": {"value": "50"},
                "saltcorr": {"value": "1"},
                "Na": {"value": "50"},
                "K": {"value": "50"},
                "Tris": {"value": "10"},
                "Mg": {"value": "1"},
                "dNTPs": {"value": "0.2"}
            },
            "target_probe_Tm_chem_correction_parameters": {
                "DMSO": {"value": "5"},
                "fmd": {"value": "2"},
                "DMSOfactor": {"value": "0.75"},
                "fmdfactor": {"value": "1.1"},
                "fmdmethod": {"value": "1"},
                "GC": {"value": ""}
            },
            "detection_oligo_Tm_parameters": {
                "nn_table": {"value": "DNA_NN1"},
                "tmm_table": {"value": "DNA_TMM1"},
                "imm_table": {"value": "DNA_IMM1"},
                "de_table": {"value": "DNA_DE1"},
                "dnac1": {"value": "50"},
                "dnac2": {"value": "50"},
                "saltcorr": {"value": "1"},
                "Na": {"value": "50"},
                "K": {"value": "50"},
                "Tris": {"value": "10"},
                "Mg": {"value": "1"},
                "dNTPs": {"value": "0.2"}
            },
            "detection_oligo_Tm_chem_correction_parameters": {
                "DMSO": {"value": "5"},
                "fmd": {"value": "2"},
                "DMSOfactor": {"value": "0.75"},
                "fmdfactor": {"value": "1.1"},
                "fmdmethod": {"value": "1"},
                "GC": {"value": ""}
            }
        },
        "runid": str(run_id)
    }

def test_scrinshot_authenticated(client, monkeypatch, dummy_form, run_id):
    # Simulate an authenticated user
    class DummyUser:
        is_authenticated = True
        id = "testuser123"
    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())
    
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""

        response = client.post("/api/scrinshot", json=dummy_form)
        assert response.status_code == 200
        data = response.get_json()
        assert data["run_id"] == str(run_id)

        # Confirm Mongo updated status
        updated = mongo.db.runs.find_one({"_id": run_id})
        assert updated["status"] == "completed"

def test_scrinshot_unauthenticated(client, dummy_form, run_id):
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""

        response = client.post("/api/scrinshot", json=dummy_form)
        assert response.status_code == 200
        data = response.get_json()
        assert data["run_id"] == str(run_id)

        # Confirm Mongo updated status
        updated = mongo.db.runs.find_one({"_id": run_id})
        assert updated["status"] == "completed"

def test_invalid_session(client, dummy_form):
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""

        with client.session_transaction() as session:
            session["session_id"] = "gaeuhfwuahfuagdzgawuzdgauwgdu"
           
        response = client.post(f"/api/scrinshot", json=dummy_form)
        assert response.status_code == 404