import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import pytest

from extensions import mongo
from conftest import assert_error_sanitized


@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for seqfish API
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
            "target_probe_isoform_consensus": {"value": "1"},
            "target_probe_GC_content_min": {"value": "30"},
            "target_probe_GC_content_opt": {"value": "50"},
            "target_probe_GC_content_max": {"value": "70"},
            "target_probe_T_secondary_structure": {"value": "2"},
            "target_probe_secondary_structures_threshold_deltaG": {"value": "10"},
            "target_probe_homopolymeric_base_n": {
                "A": {"value": "3"},
                "T": {"value": "3"},
                "C": {"value": "3"},
                "G": {"value": "3"},
            },
            "target_probe_GC_weight": {"value": "1"},
            "target_probe_UTR_weight": {"value": "1"},
            "set_size_min": {"value": "10"},
            "set_size_opt": {"value": "15"},
            "distance_between_target_probes": {"value": "5"},
            "n_sets": {"value": "1"},
            "files_fasta_reference_database_readout_probe": {"value": "readout1.fna"},
            "readout_probe_base_probabilities": {
                "A": {"value": "25"},
                "T": {"value": "25"},
                "C": {"value": "25"},
                "G": {"value": "25"},
            },
            "readout_probe_length": {"value": "20"},
            "readout_probe_GC_content_min": {"value": "30"},
            "readout_probe_GC_content_max": {"value": "70"},
            "readout_probe_homopolymeric_base_n": {"G": {"value": "3"}},
            "n_barcode_rounds": {"value": "4"},
            "n_pseudocolors": {"value": "4"},
            "channels_ids": {"value": "0,1,2,3"},
            "files_fasta_reference_database_primer": {"value": "primer1.fna"},
            "reverse_primer_sequence": {"value": "ACTGACTGACTG"},
            "primer_length": {"value": "20"},
            "primer_base_probabilities": {
                "A": {"value": "25"},
                "T": {"value": "25"},
                "C": {"value": "25"},
                "G": {"value": "25"},
            },
            "primer_GC_content_min": {"value": "30"},
            "primer_GC_content_max": {"value": "70"},
            "primer_number_GC_GCclamp": {"value": "2"},
            "primer_number_three_prime_base_GCclamp": {"value": "1"},
            "primer_homopolymeric_base_n": {
                "A": {"value": "3"},
                "T": {"value": "3"},
                "C": {"value": "3"},
                "G": {"value": "3"},
            },
            "primer_max_len_selfcomplement": {"value": "4"},
            "primer_max_len_complement_reverse_primer": {"value": "4"},
            "primer_Tm_min": {"value": "60"},
            "primer_Tm_max": {"value": "70"},
            "primer_T_secondary_structure": {"value": "2"},
            "primer_secondary_structures_threshold_deltaG": {"value": "10"},
            "target_probe_specificity_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
                "dust": {"value": "yes"},
                "soft_masking": {"value": "true"},
                "max_target_seqs": {"value": "500"},
                "max_hsps": {"value": "10"},
            },
            "target_probe_specificity_blastn_hit_parameters": {"min_alignment_length": {"value": "18"}},
            "target_probe_cross_hybridization_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
                "dust": {"value": "yes"},
                "soft_masking": {"value": "true"},
                "max_target_seqs": {"value": "500"},
            },
            "target_probe_cross_hybridization_blastn_hit_parameters": {
                "min_alignment_length": {"value": "18"}
            },
            "max_graph_size": {"value": "1000"},
            "n_attempts": {"value": "3"},
            "heuristic": {"value": "false"},
            "heuristic_n_attempts": {"value": "2"},
            "readout_probe_initial_num_sequences": {"value": "100"},
            "readout_probe_specificity_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
                "dust": {"value": "yes"},
                "soft_masking": {"value": "true"},
                "max_target_seqs": {"value": "500"},
                "max_hsps": {"value": "10"},
            },
            "readout_probe_specificity_blastn_hit_parameters": {"min_alignment_length": {"value": "18"}},
            "readout_probe_cross_hybridization_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
                "dust": {"value": "yes"},
                "soft_masking": {"value": "true"},
                "max_target_seqs": {"value": "500"},
            },
            "readout_probe_cross_hybridization_blastn_hit_parameters": {
                "min_alignment_length": {"value": "18"}
            },
            "readout_probe_n_combinations": {"value": "100"},
            "primer_initial_num_sequences": {"value": "100"},
            "primer_specificity_refrence_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
                "dust": {"value": "yes"},
                "soft_masking": {"value": "true"},
                "max_target_seqs": {"value": "500"},
                "max_hsps": {"value": "10"},
            },
            "primer_specificity_refrence_blastn_hit_parameters": {"min_alignment_length": {"value": "18"}},
            "primer_specificity_encoding_probes_blastn_search_parameters": {
                "perc_identity": {"value": "85"},
                "strand": {"value": "both"},
                "word_size": {"value": "11"},
                "dust": {"value": "yes"},
                "soft_masking": {"value": "true"},
                "max_target_seqs": {"value": "500"},
                "max_hsps": {"value": "10"},
            },
            "primer_specificity_encoding_probes_blastn_hit_parameters": {
                "min_alignment_length": {"value": "18"}
            },
            "primer_Tm_parameters": {
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
        },
        "runid": str(run_id),
    }


def test_seqfish_authenticated(client, run_id, dummy_form, mock_run, authenticated_user):
    # Ensure run exists with correct user_id for authenticated user
    from conftest import create_test_run

    create_test_run(run_id, user_id="test_user_id", status="created")

    response = client.post("/api/seqfish", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] == "completed"


def test_seqfish_unauthenticated(client, run_id, dummy_form, mock_run, session_user):
    response = client.post("/api/seqfish", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] == "completed"


# Error handling tests
def test_seqfish_route_invalid_run_id(client, dummy_form, authenticated_user):
    """Test seqfish route with invalid run ID returns sanitized error."""
    invalid_form = dummy_form.copy()
    invalid_form["runid"] = "invalid_id"

    response = client.post("/api/seqfish", json=invalid_form)
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Invalid run identifier"
    # Verify no raw error strings exposed
    assert_error_sanitized(data)


def test_seqfish_route_propagates_pipeline_runner_errors(client, run_id, authenticated_user):
    """Test seqfish route propagates PipelineRunner errors correctly."""
    # Test with empty run ID to trigger PipelineRunner error
    form_with_empty_runid = {
        "formdata": {"file_regions": {"value": "Gene1"}},
        "runid": "",
    }

    response = client.post("/api/seqfish", json=form_with_empty_runid)
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
    assert data["error"] == "Invalid run identifier"
