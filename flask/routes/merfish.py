
from datetime import datetime
import subprocess
import tempfile
import traceback
import yaml
from flask import Blueprint, request, jsonify, current_app, session
from flask_login import current_user
from bson import ObjectId
import os
from extensions import mongo
from .helpers import to_bool, to_int, multiline_to_list, to_null, split_on_newline

# Blueprint Setup
merfish_bp = Blueprint('merfish', __name__)


# Main Route
@merfish_bp.route('/api/merfish', methods=['POST'])
def merfish():
    """
    Handle POST requests for the MERFISH probe designer pipeline.
    - Determines user/session context and creates appropriate user directories.
    - Processes input form data, creates any necessary temporary files.
    - Assembles configuration for the pipeline and writes to YAML.
    - Runs the merfish_probe_designer subprocess.
    - Cleans up temporary files.
    - Updates the run status in the database.
    - Returns the subprocess output and status.
    """
    # Determine user directory and session/user ID logic
    user_dir = ''
    if current_user.is_authenticated:
        # Authenticated user: use user-specific directory
        print('yes authenticated')
        user_id = str(current_user.id)
        user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
        config_path = os.path.join(user_dir, "config_merfish.yaml")
        session_id = None
    else:
        # Anonymous user: use session-based directory
        user_id = None
        session_id = session['session_id']
        user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session_id)
        config_path = os.path.join(user_dir, 'config.yaml')
        print('no not')

    # Parse input data from request
    form_data = request.json.get('formdata')
    run_idd = request.json.get('runid')  # Assuming JSON is posted from React
    try:
        run_id = ObjectId(run_idd)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Invalid run ID"}), 400

    ##############################
    # Temp File Creation (if needed)
    ##############################
    # If file_regions is not a .txt file, create a temp .txt file with genes
    if form_data["file_regions"]['value'] != '':
        if ".txt" not in form_data["file_regions"]['value']:
            with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
                file_path = temp_file.name
                # Write each gene on a new line
                temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"]['value'].split(","))
            print(f"File created: {file_path}")
            with open(file_path, "r") as f:
                print("File content:")
                print(f.read())
            # Update the path in form_data to point to the temp file
            form_data["file_regions"]['value'] = file_path
    else:
        form_data["file_regions"]['value'] = None

    ##############################
    # Config Building
    ##############################
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    output_path = os.path.join(user_dir, f'output_merfish_probe_designer_{timestamp}')

    # Update the run entry in the DB to mark as started
    update_result = mongo.db.runs.update_one(
        {"_id": run_id},
        {"$set": {
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": output_path,
            "status": "started",
            "pipeline": "merfish"
        }}
    )
    if update_result.matched_count == 0:
        return jsonify({"error": "Run ID not found"}), 404

    # Build the nested config structure based on form data
    config = {
        "n_jobs": to_int(form_data["n_jobs"]['value']),
        "dir_output":output_path,
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]['value']),
        "top_n_sets": to_int(form_data["top_n_sets"]['value']),
        # Probe sequences generation
        "file_regions": form_data["file_regions"]['value'],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]['value']),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_target_probe"]['value']),
        "target_probe_length_min": to_int(form_data["target_probe_length_min"]['value']),
        "target_probe_length_max": to_int(form_data["target_probe_length_max"]['value']),
        "target_probe_isoform_consensus": to_int(form_data["target_probe_isoform_consensus"]['value']),


        # Property filters
        "target_probe_GC_content_min": to_int(form_data["target_probe_GC_content_min"]['value']),
        "target_probe_GC_content_opt": to_int(form_data["target_probe_GC_content_opt"]['value']),
        "target_probe_GC_content_max": to_int(form_data["target_probe_GC_content_max"]['value']),
        "target_probe_Tm_min": to_int(form_data["target_probe_Tm_min"]['value']),
        "target_probe_Tm_max": to_int(form_data["target_probe_Tm_max"]['value']),
        "target_probe_homopolymeric_base_n": {
            "A": to_int(form_data["target_probe_homopolymeric_base_n"]['A']['value']),
            "T": to_int(form_data["target_probe_homopolymeric_base_n"]['T']['value']),
            "C": to_int(form_data["target_probe_homopolymeric_base_n"]['C']['value']),
            "G": to_int(form_data["target_probe_homopolymeric_base_n"]['G']['value'])
        },

        "target_probe_T_secondary_structure": to_int(form_data["target_probe_T_secondary_structure"]['value']),
        "target_probe_secondary_structures_threshold_deltaG": to_int(form_data["target_probe_secondary_structures_threshold_deltaG"]['value']),

        # Set selection parameters
        "target_probe_isoform_weight": to_int(form_data["target_probe_isoform_weight"]['value']),
        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]['value']),
        "target_probe_Tm_weight": to_int(form_data["target_probe_Tm_weight"]['value']),
        "set_size_min": to_int(form_data["set_size_min"]['value']),
        "set_size_opt": to_int(form_data["set_size_opt"]['value']),
        "distance_between_target_probes": to_int(form_data["distance_between_target_probes"]['value']),
        "n_sets": to_int(form_data["n_sets"]['value']),


        "files_fasta_reference_database_readout_probe": multiline_to_list(form_data["files_fasta_reference_database_readout_probe"]['value']),
        "readout_probe_base_probabilities": {
            "A": to_int(form_data["readout_probe_base_probabilities"]['A']['value']),
            "T": to_int(form_data["readout_probe_base_probabilities"]['T']['value']),
            "C": to_int(form_data["readout_probe_base_probabilities"]['C']['value']),
            "G": to_int(form_data["readout_probe_base_probabilities"]['G']['value'])
        },
        "readout_probe_length": float(form_data["readout_probe_length"]['value']),
        "readout_probe_GC_content_min": to_int(form_data["readout_probe_GC_content_min"]['value']),
        "readout_probe_GC_content_max": to_int(form_data["readout_probe_GC_content_max"]['value']),
        "readout_probe_homopolymeric_base_n": {"G":to_int(form_data["readout_probe_homopolymeric_base_n"]['G']['value']),},
        "readout_probe_set_size": to_int(form_data["readout_probe_set_size"]['value']),
        "readout_probe_homogeneous_properties_weights":{
           "TmNN": to_int(form_data["readout_probe_homogeneous_properties_weights"]["TmNN"]["value"]),
            "GC_content": to_int(form_data["readout_probe_homogeneous_properties_weights"]["GC_content"]["value"]),
        } ,
        "n_bits": to_int(form_data["n_bits"]['value']),
        "min_hamming_dist": to_int(form_data["min_hamming_dist"]['value']),
        "hamming_weight": to_int(form_data["hamming_weight"]['value']),
        "channels_ids": form_data["channels_ids"]['value'],

        #PRIMER PARAMETERS

        "files_fasta_reference_database_primer": multiline_to_list(form_data["files_fasta_reference_database_primer"]['value']),
        "reverse_primer_sequence": form_data["reverse_primer_sequence"]['value'],
        "primer_length": to_int(form_data["primer_length"]['value']),
        "primer_GC_content_min": to_int(form_data["primer_GC_content_min"]['value']),
        "primer_GC_content_max": to_int(form_data["primer_GC_content_max"]['value']),
        "primer_number_GC_GCclamp": to_int(form_data["primer_number_GC_GCclamp"]['value']),
        "primer_number_three_prime_base_GCclamp": to_int(form_data["primer_number_three_prime_base_GCclamp"]['value']),
        "primer_homopolymeric_base_n": {
            "A": to_int(form_data["primer_homopolymeric_base_n"]['A']['value']),
            "T": to_int(form_data["primer_homopolymeric_base_n"]['T']['value']),
            "C": to_int(form_data["primer_homopolymeric_base_n"]['C']['value']),
            "G": to_int(form_data["primer_homopolymeric_base_n"]['G']['value'])
        },

        "primer_max_len_selfcomplement": to_int(form_data["primer_max_len_selfcomplement"]['value']),
        "primer_max_len_complement_reverse_primer": to_int(form_data["primer_max_len_complement_reverse_primer"]['value']),
        "primer_Tm_min": to_int(form_data["primer_Tm_min"]['value']),
        "primer_Tm_max": to_int(form_data["primer_Tm_max"]['value']),
        "primer_T_secondary_structure": to_int(form_data["primer_T_secondary_structure"]['value']),
        "primer_secondary_structures_threshold_deltaG": to_int(form_data["primer_secondary_structures_threshold_deltaG"]['value']),

        # Developer parameters
        "target_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["target_probe_specificity_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["target_probe_specificity_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["target_probe_specificity_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['max_hsps']['value'])
        },
        "target_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_specificity_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['max_target_seqs']['value'])
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_cross_hybridization_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "max_graph_size": to_int(form_data["max_graph_size"]['value']),
        "n_attempts": to_int(form_data["n_attempts"]['value']),
        "heuristic": to_bool(form_data["heuristic"]['value']),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]['value']),
        "target_probe_Tm_opt": to_int(form_data["target_probe_Tm_opt"]['value']),


        # Melting Temperature Parameters
        "target_probe_Tm_parameters": {
            "nn_table": form_data["target_probe_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["target_probe_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["target_probe_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["target_probe_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["target_probe_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["target_probe_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["target_probe_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["target_probe_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["target_probe_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["target_probe_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["target_probe_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["target_probe_Tm_parameters"]['dNTPs']['value'])
        },

        "target_probe_Tm_chem_correction_param_probe": None,
        # If Tm_salt_correction_param_probe is null, we just omit it or set it to None
        "target_probe_Tm_salt_correction_param_probe": None,
        #READOUT PROBE PARAMETERS
        "readout_probe_initial_num_sequences": to_int(form_data["readout_probe_initial_num_sequences"]['value']),
        "readout_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["readout_probe_specificity_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["readout_probe_specificity_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["readout_probe_specificity_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['max_hsps']['value'])
        },
        "readout_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_specificity_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "readout_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['max_target_seqs']['value']),
        },
        "readout_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_cross_hybridization_blastn_hit_parameters"]['min_alignment_length']['value'])
        },
        "readout_probe_Tm_parameters": {
            "nn_table": form_data["readout_probe_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["readout_probe_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["readout_probe_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["readout_probe_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["readout_probe_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["readout_probe_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["readout_probe_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["readout_probe_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["readout_probe_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["readout_probe_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["readout_probe_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["readout_probe_Tm_parameters"]['dNTPs']['value'])
        },

        "readout_probe_Tm_chem_correction_parameters": None,
        "readout_probe_Tm_salt_correction_parameters": None,
        "readout_probe_n_combinations": to_int(form_data["readout_probe_n_combinations"]['value']),
        #PRIMER PARAMETERS

        "primer_initial_num_sequences": to_int(form_data["primer_initial_num_sequences"]['value']),

        "primer_specificity_refrence_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["primer_specificity_refrence_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["primer_specificity_refrence_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["primer_specificity_refrence_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['max_hsps']['value'])
        },
        "primer_specificity_refrence_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_refrence_blastn_hit_parameters"]['min_alignment_length']['value'])
        },
        "primer_specificity_encoding_probes_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['max_hsps']['value'])
        },
        "primer_specificity_encoding_probes_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_encoding_probes_blastn_hit_parameters"]['min_alignment_length']['value'])
        },
        "primer_Tm_parameters": {
            "nn_table": form_data["primer_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["primer_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["primer_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["primer_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["primer_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["primer_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["primer_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["primer_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["primer_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["primer_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["primer_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["primer_Tm_parameters"]['dNTPs']['value'])
        },
        "primer_Tm_chem_correction_parameters": None,
        "primer_Tm_salt_correction_parameters": None,
        "target_probe_Tm_chem_correction_parameters":None,
        "target_probe_Tm_salt_correction_parameters": None,



    }

    # Write the configuration to YAML file
    with open(config_path, "w") as f:
        yaml.dump(config, f, sort_keys=False)

    ##############################
    # Subprocess Call
    ##############################
    result = subprocess.run(
        ['merfish_probe_designer', '-c', config_path],
        capture_output=True,
        text=True
    )
    status = "completed" if result.returncode == 0 else "error"

    print(result)

    ##############################
    # Cleanup of Temporary Files
    ##############################
    # Remove temp file for file_regions if it was created
    if form_data['file_regions']['value'] and os.path.exists(form_data['file_regions']['value']):
        print('deleted')
        os.remove(form_data['file_regions']['value'])
    # Remove temp files for fasta inputs
    fasta_fields = [
        'files_fasta_target_probe_database',
        'files_fasta_reference_database_target_probe',
        'files_fasta_reference_database_readout_probe',
        'files_fasta_reference_database_primer'
    ]
    for field in fasta_fields:
        files_list = split_on_newline(form_data[field]['value'])
        if '\n' in files_list:
            files_list.remove('\n')
        for fname in files_list:
            print('deleted')
            os.remove(fname)

    ##############################
    # DB Update
    ##############################
    # Update the run status in the database
    mongo.db.runs.update_one(
        {"_id": run_id},
        {"$set": {"status": status}}
    )

    ##############################
    # Response
    ##############################
    return jsonify({
        'stdout': result.stdout,
        'stderr': result.stderr,
        'returncode': result.returncode
    })