import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import pytest

from extensions import mongo
from conftest import assert_invalid_run_id_error


@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for OligoSeq API
    return {
        "formdata": {
            "n_jobs": {"value": "1"},
            "write_intermediate_steps": {"value": "false"},
            "top_n_sets": {"value": "3"},
            "file_regions": {"value": "GENE1,GENE2"},
            "files_fasta_target_probe_database": {"value": "target1.fna"},
            "files_fasta_reference_database_target_probe": {"value": "ref1.fna"},
            "target_probe_length_min": {"value": "20"},
            "target_probe_length_max": {"value": "40"},
            "target_probe_split_region": {"value": "1"},
            "target_probe_targeted_exons": {"value": "1"},
            "target_probe_isoform_consensus": {"value": "1"},
            "target_probe_GC_content_min": {"value": "30"},
            "target_probe_GC_content_opt": {"value": "50"},
            "target_probe_GC_content_max": {"value": "70"},
            "target_probe_Tm_min": {"value": "60"},
            "target_probe_Tm_opt": {"value": "65"},
            "target_probe_Tm_max": {"value": "70"},
            "target_probe_secondary_structures_T": {"value": "2"},
            "target_probe_secondary_structures_threshold_deltaG": {"value": "10"},
            "target_probe_homopolymeric_base_n": {
                "A": {"value": "3"},
                "T": {"value": "3"},
                "C": {"value": "3"},
                "G": {"value": "3"},
            },
            "target_probe_max_len_selfcomplement": {"value": "4"},
            "target_probe_hybridization_probability_threshold": {"value": "0.8"},
            "target_probe_GC_weight": {"value": "1"},
            "target_probe_Tm_weight": {"value": "1"},
            "set_size_min": {"value": "10"},
            "set_size_opt": {"value": "15"},
            "distance_between_target_probes": {"value": "5"},
            "n_sets": {"value": "1"},
            "target_probe_hybridization_probability_alignment_method": {"value": "bowtie"},
            "target_probe_hybridization_probability_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
            },
            "target_probe_hybridization_probability_blastn_hit_parameters": {"coverage": {"value": "85"}},
            "target_probe_hybridization_probability_bowtie_search_parameters": {
                "v": {"value": "3"},
                "nofw": {"value": "true"},
            },
            "target_probe_cross_hybridization_alignment_method": {"value": "bowtie"},
            "target_probe_cross_hybridization_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
            },
            "target_probe_cross_hybridization_blastn_hit_parameters": {"coverage": {"value": "85"}},
            "target_probe_cross_hybridization_bowtie_search_parameters": {
                "v": {"value": "3"},
                "nofw": {"value": "true"},
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
                "dNTPs": {"value": "0.2"},
            },
            "target_probe_Tm_chem_correction_parameters": {
                "DMSO": {"value": "0"},
                "fmd": {"value": "0"},
                "DMSOfactor": {"value": "0.0"},
                "fmdfactor": {"value": "0.0"},
                "fmdmethod": {"value": "0"},
                "GC": {"value": ""},
            },
        },
        "runid": str(run_id),
    }


def test_oligoseq_authenticated(client, run_id, dummy_form, mock_run, authenticated_user):
    # Ensure run exists with correct user_id for authenticated user
    from conftest import create_test_run

    create_test_run(run_id, user_id="test_user_id", status="created")

    response = client.post("/api/oligoseq", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] == "completed"


def test_oligoseq_unauthenticated(client, run_id, dummy_form, mock_run, session_user):
    # Simulate an anonymous user (no monkeypatch needed)
    response = client.post("/api/oligoseq", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] == "completed"


# Error handling tests
def test_oligoseq_route_invalid_run_id(client, dummy_form, authenticated_user):
    """Test oligoseq route with invalid run ID returns sanitized error."""
    invalid_form = dummy_form.copy()
    invalid_form["runid"] = "invalid_id"

    response = client.post("/api/oligoseq", json=invalid_form)
    assert_invalid_run_id_error(response)


def test_oligoseq_route_propagates_pipeline_runner_errors(client, run_id, authenticated_user):
    """Test oligoseq route propagates PipelineRunner errors correctly."""
    # Test with empty run ID to trigger PipelineRunner error
    form_with_empty_runid = {
        "formdata": {"file_regions": {"value": "Gene1"}},
        "runid": "",
    }

    response = client.post("/api/oligoseq", json=form_with_empty_runid)
    assert_invalid_run_id_error(response)
