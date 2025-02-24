from flask import Flask, request, jsonify,send_file
from flask_cors import CORS
import yaml
from flask_socketio import SocketIO, emit
import threading
import time
import subprocess
import os
import shutil
import uuid
import tempfile

app = Flask(__name__)

CORS(app)
UPLOAD_FOLDER = "uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
#socketio = SocketIO(app, cors_allowed_origins="*")  # Enable CORS for frontend connection
def to_bool(val):
    return True if str(val).lower() == 'true' else False

    # Helper function to convert string integers to int where applicable
def to_int(val):
    try:
        return int(val)
    except ValueError:
        return val

    # Helper for optional null values
def to_null(val):
    return None if val == "" or val.lower() == "null" else val

    # Convert multiline textarea fields to lists
def multiline_to_list(val):
    # Strip leading/trailing spaces and split by newline
    lines = [line.strip() for line in val.split('\n') if line.strip()]
    return lines
def split_on_newline(s):
    if '\n' in s:
        # Split the string before and after '\n'
        result = []
        parts = s.split('\n')
        for i, part in enumerate(parts):
            if i > 0:
                result.append('\n')  # Add the newline back as its own part
            result.append(part)
        return result
    else:
        # Do nothing if '\n' is not in the string
        return [s]
@app.route('/api/upload', methods=['POST'])
def upload_file():
    print(request.files)
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Generate a unique filename using UUID
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)

    # Save the file
    file.save(file_path)
    return jsonify({"filePath": file_path}), 200
def run_command():
    """Simulate a long-running task and send updates via WebSocket."""
    for i in range(1, 11):  # Simulate 10 steps
        time.sleep(1)  # Simulate work
        progress = i * 10
        socketio.emit("update", {"progress": progress, "status": "running"})  # Send progress update
    socketio.emit("update", {"progress": 100, "status": "completed"})  # Send completion message
@app.route('/api/scrinshot', methods=['POST'])
def scrinshot():
    config_path = "config.yaml"
    #thread = threading.Thread(target=run_command)  # Run task in a separate thread
    #thread.start()

    form_data = request.json  # Assuming JSON is posted from React
    # Build the nested config structure:
    if ".txt" not in form_data["file_regions"]:
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
            file_path = temp_file.name
            # Write each gene on a new line
            temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"].split(","))
        print(f"File created: {file_path}")
        with open(file_path, "r") as f:
            print("File content:")
            print(f.read())

        form_data["file_regions"]=file_path
    config = {
        "n_jobs": to_int(form_data["n_jobs"]),
        "dir_output": form_data["dir_output"],
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]),
        "top_n_sets": to_int(form_data["top_n_sets"]),
        # Probe sequences generation
        "file_regions": form_data["file_regions"],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_target_probe"]),
        "target_probe_length_min": to_int(form_data["probe_length_min"]),
        "target_probe_length_max": to_int(form_data["probe_length_max"]),
        "target_probe_isoform_consensus": to_int(form_data["probe_isoform_consensus"]),

        # Property filters
        "target_probe_GC_content_min": to_int(form_data["probe_GC_content_min"]),
        "target_probe_GC_content_opt": to_int(form_data["probe_GC_content_opt"]),
        "target_probe_GC_content_max": to_int(form_data["probe_GC_content_max"]),
        "target_probe_Tm_min": to_int(form_data["probe_Tm_min"]),
        "target_probe_Tm_max": to_int(form_data["probe_Tm_max"]),
        "target_homopolymeric_base_n": {
            "A": to_int(form_data["homopolymeric_A"]),
            "T": to_int(form_data["homopolymeric_T"]),
            "C": to_int(form_data["homopolymeric_C"]),
            "G": to_int(form_data["homopolymeric_G"])
        },

        # Padlock arms
        "target_probe_padlock_arm_Tm_dif_max": to_int(form_data["arm_Tm_dif_max"]),
        "target_probe_padlock_arm_length_min": to_int(form_data["arm_length_min"]),
        "target_probe_padlock_arm_Tm_min": to_int(form_data["arm_Tm_min"]),
        "target_probe_padlock_arm_Tm_max": to_int(form_data["arm_Tm_max"]),

        # Detection oligos
        "detection_oligo_min_thymines": to_int(form_data["min_thymines"]),
        "detection_oligo_length_min": to_int(form_data["detect_oligo_length_min"]),
        "detection_oligo_length_max": to_int(form_data["detect_oligo_length_max"]),

        # Specificity filters
        "target_probe_padlock_ligation_region_size": to_int(form_data["ligation_region_size"]),

        # Set selection parameters
        "target_probe_isoform_weight": to_int(form_data["probe_isoform_weight"]),
        "target_probe_GC_weight": to_int(form_data["probe_GC_weight"]),
        "probe_Tm_opt": to_int(form_data["probe_Tm_opt"]),
        "target_probe_Tm_weight": to_int(form_data["probe_Tm_weight"]),
        "set_size_min": to_int(form_data["probeset_size_min"]),
        "set_size_opt": to_int(form_data["probeset_size_opt"]),
        "distance_between_target_probes": to_int(form_data["distance_between_probes"]),
        "n_sets": to_int(form_data["n_sets"]),

        # Final sequence design
        "detection_oligo_U_distance": to_int(form_data["U_distance"]),
        "detection_oligo_Tm_opt": to_int(form_data["detect_oligo_Tm_opt"]),


        # Developer parameters
        "target_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["specificity_perc_identity"]),
            "strand": form_data["specificity_strand"],
            "word_size": to_int(form_data["specificity_word_size"]),
            "dust": form_data["specificity_dust"],
            "soft_masking": form_data["specificity_soft_masking"],
            "max_target_seqs": to_int(form_data["specificity_max_target_seqs"]),
            "max_hsps": to_int(form_data["specificity_max_hsps"])
        },
        "target_probe_specificity_blastn_hit_parameters": {
            "coverage": to_int(form_data["specificity_coverage"])
        },

        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["crosshybridization_perc_identity"]),
            "strand": form_data["crosshybridization_strand"],
            "word_size": to_int(form_data["crosshybridization_word_size"]),
            "dust": form_data["crosshybridization_dust"],
            "soft_masking": form_data["crosshybridization_soft_masking"],
            "max_target_seqs": to_int(form_data["crosshybridization_max_target_seqs"])
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "coverage": to_int(form_data["crosshybridization_coverage"])
        },

        "max_graph_size": to_int(form_data["max_graph_size"]),
        "n_attempts": to_int(form_data["n_attempts"]),
        "pre_filtering": to_bool(form_data["pre_filtering"]),

        # Melting Temperature Parameters
        "target_probe_Tm_parameters_probe": {
            "check": to_bool(form_data["Tm_probe_check"]),
            "strict": to_bool(form_data["Tm_probe_strict"]),
            "c_seq": to_null(form_data["Tm_probe_c_seq"]),
            "shift": to_int(form_data["Tm_probe_shift"]),
            "nn_table": form_data["Tm_probe_nn_table"],
            "tmm_table": form_data["Tm_probe_tmm_table"],
            "imm_table": form_data["Tm_probe_imm_table"],
            "de_table": form_data["DE_probe_imm_table"],
            "dnac1": to_int(form_data["Tm_probe_dnac1"]),
            "dnac2": to_int(form_data["Tm_probe_dnac2"]),
            "selfcomp": to_bool(form_data["selfcomp"]),
            "saltcorr": to_int(form_data["Tm_probe_saltcorr"]),
            "Na": to_int(form_data["Tm_probe_Na"]),
            "K": to_int(form_data["Tm_probe_K"]),
            "Tris": to_int(form_data["Tm_probe_Tris"]),
            "Mg": to_int(form_data["Tm_probe_Mg"]),
            "dNTPs": to_int(form_data["Tm_probe_dNTPs"])
        },
        "target_probe_Tm_chem_correction_param_probe": {
            "DMSO": to_int(form_data["Tm_probe_DMSO"]),
            "fmd": to_int(form_data["Tm_probe_fmd"]),
            "DMSOfactor": float(form_data["Tm_probe_DMSOfactor"]),
            "fmdfactor": float(form_data["Tm_probe_fmdfactor"]),
            "fmdmethod": to_int(form_data["Tm_probe_fmdmethod"]),
            "GC": to_null(form_data["Tm_probe_GC"])
        },
        # If Tm_salt_correction_param_probe is null, we just omit it or set it to None
        "target_probe_Tm_salt_correction_param_probe": None,

        "detection_oligo_Tm_parameters": {
            "check": to_bool(form_data["Tm_detection_check"]),
            "strict": to_bool(form_data["Tm_detection_strict"]),
            "c_seq": to_null(form_data["Tm_detection_c_seq"]),
            "shift": to_int(form_data["Tm_detection_shift"]),
            "nn_table": form_data["Tm_detection_nn_table"],
            "tmm_table": form_data["Tm_detection_tmm_table"],
            "imm_table": form_data["Tm_detection_imm_table"],
            "de_table": form_data["Tm_detection_de_table"],
            "dnac1": to_int(form_data["Tm_detection_dnac1"]),
            "dnac2": to_int(form_data["Tm_detection_dnac2"]),
            "selfcomp": to_bool(form_data["Tm_detection_selfcomp"]),
            "saltcorr": to_int(form_data["Tm_detection_saltcorr"]),
            "Na": to_int(form_data["Tm_detection_Na"]),
            "K": to_int(form_data["Tm_detection_K"]),
            "Tris": to_int(form_data["Tm_detection_Tris"]),
            "Mg": to_int(form_data["Tm_detection_Mg"]),
            "dNTPs": to_int(form_data["Tm_detection_dNTPs"])
        },
        "detection_oligo_Tm_chem_correction_parameters": {
            "DMSO": to_int(form_data["Tm_detection_DMSO"]),
            "fmd": to_int(form_data["Tm_detection_fmd"]),
            "DMSOfactor": float(form_data["Tm_detection_DMSOfactor"]),
            "fmdfactor": float(form_data["Tm_detection_fmdfactor"]),
            "fmdmethod": to_int(form_data["Tm_detection_fmdmethod"]),
            "GC": to_null(form_data["Tm_detection_GC"])
        },
        "detection_oligo_Tm_salt_correction_parameters": None
    }


    # Write the YAML file
    with open("config.yaml", "w") as f:
        yaml.dump(config, f, sort_keys=False)

    result = subprocess.run(
                ['scrinshot_probe_designer', '-c', config_path],
                capture_output=True,
                text=True
            )

    if os.path.exists(form_data['file_regions']):
        print('deleted')
        os.remove(form_data['file_regions'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database'])

    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_target_probe'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)



    return jsonify({
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            })
@app.route('/api/merfish', methods=['POST'])
def merfish():
    config_path = "config_merfish.yaml"
    #thread = threading.Thread(target=run_command)  # Run task in a separate thread
    #thread.start()

    form_data = request.json  # Assuming JSON is posted from React

    # Build the nested config structure:
    config = {
        "n_jobs": to_int(form_data["n_jobs"]),
        "dir_output": form_data["dir_output"],
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]),
        "top_n_sets": to_int(form_data["top_n_sets"]),
        # Probe sequences generation
        "file_regions": form_data["file_regions"],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_target_probe"]),
        "target_probe_length_min": to_int(form_data["probe_length_min"]),
        "target_probe_length_max": to_int(form_data["probe_length_max"]),
        "target_probe_isoform_consensus": to_int(form_data["probe_isoform_consensus"]),

        # Property filters
        "target_probe_GC_content_min": to_int(form_data["probe_GC_content_min"]),
        "target_probe_GC_content_opt": to_int(form_data["probe_GC_content_opt"]),
        "target_probe_GC_content_max": to_int(form_data["probe_GC_content_max"]),
        "target_probe_Tm_min": to_int(form_data["probe_Tm_min"]),
        "target_probe_Tm_opt": to_int(form_data["probe_Tm_opt"]),
        "target_probe_Tm_max": to_int(form_data["probe_Tm_max"]),
        "target_homopolymeric_base_n": {
            "A": to_int(form_data["homopolymeric_A"]),
            "T": to_int(form_data["homopolymeric_T"]),
            "C": to_int(form_data["homopolymeric_C"]),
            "G": to_int(form_data["homopolymeric_G"])
        },

        "target_probe_T_secondary_structure": to_int(form_data["target_probe_T_secondary_structure"]),
        "target_probe_secondary_structures_threshold_deltaG": to_int(form_data["target_probe_secondary_structures_threshold_deltaG"]),
        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]),
        "target_probe_Tm_weight": to_int(form_data["target_probe_Tm_weight"]),

        "target_probe_isoform_weight": to_int(form_data["target_probe_isoform_weight"]),

        "set_size_min": to_int(form_data["set_size_min"]),
        "set_size_opt": to_int(form_data["set_size_opt"]),
        "distance_between_target_probes": to_int(form_data["distance_between_probes"]),
        "n_sets": to_int(form_data["n_sets"]),

        "files_fasta_reference_database_readout_probe": multiline_to_list(form_data["files_fasta_reference_database_readout_probe"]),
        "readout_probe_base_prob_a": float(form_data["readout_probe_base_prob_a"]),
        "readout_probe_base_prob_c": float(form_data["readout_probe_base_prob_c"]),
        "readout_probe_base_prob_g": float(form_data["readout_probe_base_prob_g"]),
        "readout_probe_base_prob_t": float(form_data["readout_probe_base_prob_t"]),
        "readout_probe_length": float(form_data["readout_probe_length"]),


        "readout_probe_GC_content_min": to_int(form_data["readout_probe_GC_content_min"]),
        "readout_probe_GC_content_max": to_int(form_data["readout_probe_GC_content_max"]),
        "readout_probe_homopolymeric_base_n": {"G":to_int(form_data["readout_probe_homopolymeric_base_n_g"]),},
        "readout_probe_set_size": to_int(form_data["readout_probe_set_size"]),
        "readout_probe_homogeneous_properties_weights":{
           "TmNN": to_int(form_data["readout_probe_homogeneous_properties_weights_tmnn"]),
            "GC_content": to_int(form_data["readout_probe_homogeneous_properties_weights_GC_content"]),
        } ,
        "n_bits": to_int(form_data["n_bits"]),
        "min_hamming_dist": to_int(form_data["min_hamming_dist"]),
        "hamming_weight": to_int(form_data["hamming_weight"]),
        "channels_ids": form_data["channels_ids"],

        #PRIMER PARAMETERS
        "files_fasta_reference_database_primer": multiline_to_list(form_data["files_fasta_reference_database_primer"]),
        "reverse_primer_sequence": form_data["reverse_primer_sequence"],
        "primer_length": to_int(form_data["primer_length"]),
        "primer_base_probabilities":{
            "A": float(form_data["primer_base_probabilities_a"]),
            "T": float(form_data["primer_base_probabilities_t"]),
            "C": float(form_data["primer_base_probabilities_c"]),
            "G": float(form_data["primer_base_probabilities_g"]),

        },
        "primer_GC_content_min": to_int(form_data["primer_GC_content_min"]),
        "primer_GC_content_max": to_int(form_data["primer_GC_content_max"]),
        "primer_number_GC_GCclamp": to_int(form_data["primer_number_GC_GCclamp"]),
        "primer_number_three_prime_base_GCclamp": to_int(form_data["primer_number_three_prime_base_GCclamp"]),
        "primer_homopolymeric_base_n": {
            "A": to_int(form_data["primer_homopolymeric_base_n_a"]),
            "T": float(form_data["primer_homopolymeric_base_n_t"]),
            "C": float(form_data["primer_homopolymeric_base_n_c"]),
            "G": float(form_data["primer_homopolymeric_base_n_g"]),
        },

        "primer_max_len_selfcomplement": to_int(form_data["primer_max_len_selfcomplement"]),
        "primer_max_len_complement_reverse_primer": to_int(form_data["primer_max_len_complement_reverse_primer"]),
        "primer_Tm_min": to_int(form_data["primer_Tm_min"]),
        "primer_Tm_max": to_int(form_data["primer_Tm_max"]),
        "primer_T_secondary_structure": to_int(form_data["primer_T_secondary_structure"]),
        "primer_secondary_structures_threshold_deltaG": to_int(form_data["primer_secondary_structures_threshold_deltaG"]),








        # Developer parameters
        "target_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_specificity_blastn_search_parameters_perc_identity"]),
            "strand": form_data["target_probe_specificity_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["target_probe_specificity_blastn_search_parameters_word_size"]),
            "dust": form_data["target_probe_specificity_blastn_search_parameters_dust"],
            "soft_masking": form_data["target_probe_specificity_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["target_probe_specificity_blastn_search_parameters_max_target_seqs"]),
            "max_hsps": to_int(form_data["target_probe_specificity_blastn_search_parameters_max_hsps"])
        },
        "target_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_specificity_blastn_hit_parameters_min_alignment_length"])
        },

        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters_perc_identity"]),
            "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters_word_size"]),
            "dust": form_data["target_probe_cross_hybridization_blastn_search_parameters_dust"],
            "soft_masking": form_data["target_probe_cross_hybridization_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters_max_target_seqs"])
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length"])
        },

        "max_graph_size": to_int(form_data["max_graph_size"]),
        "n_attempts": to_int(form_data["n_attempts"]),
        "pre_filter": to_bool(form_data["pre_filter"]),
        "heuristic": to_bool(form_data["heuristic"]),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]),


        # Melting Temperature Parameters
        "target_probe_Tm_parameters": {
            "check": to_bool(form_data["Tm_probe_check"]),
            "strict": to_bool(form_data["Tm_probe_strict"]),
            "c_seq": to_null(form_data["Tm_probe_c_seq"]),
            "shift": to_int(form_data["Tm_probe_shift"]),
            "nn_table": form_data["Tm_probe_nn_table"],
            "tmm_table": form_data["Tm_probe_tmm_table"],
            "imm_table": form_data["Tm_probe_imm_table"],
            "de_table": form_data["DE_probe_imm_table"],
            "dnac1": to_int(form_data["Tm_probe_dnac1"]),
            "dnac2": to_int(form_data["Tm_probe_dnac2"]),
            "selfcomp": to_bool(form_data["selfcomp"]),
            "saltcorr": to_int(form_data["Tm_probe_saltcorr"]),
            "Na": to_int(form_data["Tm_probe_Na"]),
            "K": to_int(form_data["Tm_probe_K"]),
            "Tris": to_int(form_data["Tm_probe_Tris"]),
            "Mg": to_int(form_data["Tm_probe_Mg"]),
            "dNTPs": to_int(form_data["Tm_probe_dNTPs"])
        },
        "target_probe_Tm_chem_correction_param_probe": None,
        # If Tm_salt_correction_param_probe is null, we just omit it or set it to None
        "target_probe_Tm_salt_correction_param_probe": None,
        #READOUT PROBE PARAMETERS
        "readout_probe_initial_num_sequences": to_int(form_data["readout_probe_initial_num_sequences"]),
        "readout_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_specificity_blastn_search_parameters_perc_identity"]),
            "strand": form_data["readout_probe_specificity_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["readout_probe_specificity_blastn_search_parameters_word_size"]),
            "dust": form_data["readout_probe_specificity_blastn_search_parameters_dust"],
            "soft_masking": form_data["readout_probe_specificity_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["readout_probe_specificity_blastn_search_parameters_max_target_seqs"]),
            "max_hsps": to_int(form_data["readout_probe_specificity_blastn_search_parameters_max_hsps"])
        },
        "readout_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_specificity_blastn_hit_parameters_min_alignment_length"])
        },

        "readout_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters_perc_identity"]),
            "strand": form_data["readout_probe_cross_hybridization_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters_word_size"]),
            "dust": form_data["readout_probe_cross_hybridization_blastn_search_parameters_dust"],
            "soft_masking": form_data["readout_probe_cross_hybridization_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters_max_target_seqs"])
        },
        "readout_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length"])
        },
        "readout_probe_Tm_parameters": {
            "check": to_bool(form_data["readout_probe_Tm_parameters_check"]),
            "strict": to_bool(form_data["readout_probe_Tm_parameters_strict"]),
            "c_seq": to_null(form_data["readout_probe_Tm_parameters_c_seq"]),
            "shift": to_int(form_data["readout_probe_Tm_parameters_shift"]),
            "nn_table": form_data["readout_probe_Tm_parameters_nn_table"],
            "tmm_table": form_data["readout_probe_Tm_parameters_tmm_table"],
            "imm_table": form_data["readout_probe_Tm_parameters_imm_table"],
            "de_table": form_data["readout_probe_Tm_parameters_de_table"],
            "dnac1": to_int(form_data["readout_probe_Tm_parameters_dnac1"]),
            "dnac2": to_int(form_data["readout_probe_Tm_parameters_dnac2"]),
            "selfcomp": to_bool(form_data["readout_probe_Tm_parameters_selfcomp"]),
            "saltcorr": to_int(form_data["readout_probe_Tm_parameters_saltcorr"]),
            "Na": to_int(form_data["readout_probe_Tm_parameters_Na"]),
            "K": to_int(form_data["readout_probe_Tm_parameters_K"]),
            "Tris": to_int(form_data["readout_probe_Tm_parameters_Tris"]),
            "Mg": to_int(form_data["readout_probe_Tm_parameters_Mg"]),
            "dNTPs": to_int(form_data["readout_probe_Tm_parameters_dNTPs"])
        },

        "readout_probe_Tm_chem_correction_parameters": None,
        "readout_probe_Tm_salt_correction_parameters": None,
        "readout_probe_n_combinations": to_int(form_data["readout_probe_n_combinations"]),
        #PRIMER PARAMETERS

        "primer_initial_num_sequences": to_int(form_data["primer_initial_num_sequences"]),

        "primer_specificity_refrence_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_reference_blastn_search_parameters_perc_identity"]),
            "strand": form_data["primer_specificity_reference_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["primer_specificity_reference_blastn_search_parameters_word_size"]),
            "dust": form_data["primer_specificity_reference_blastn_search_parameters_dust"],
            "soft_masking": form_data["primer_specificity_reference_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["primer_specificity_reference_blastn_search_parameters_max_target_seqs"]),
            "max_hsps": to_int(form_data["primer_specificity_reference_blastn_search_parameters_max_hsps"])
        },
        "primer_specificity_refrence_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_reference_blastn_hit_parameters_min_alignment_length"])
        },
        "primer_specificity_encoding_probes_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters_perc_identity"]),
            "strand": form_data["primer_specificity_encoding_probes_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters_word_size"]),
            "dust": form_data["primer_specificity_encoding_probes_blastn_search_parameters_dust"],
            "soft_masking": form_data["primer_specificity_encoding_probes_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters_max_target_seqs"]),
            "max_hsps": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters_max_hsps"])
        },
        "primer_specificity_encoding_probes_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_encoding_probes_blastn_hit_parameters_min_alignment_length"])
        },
        "primer_Tm_parameters": {
            "check": to_bool(form_data["primer_Tm_parameters_check"]),
            "strict": to_bool(form_data["primer_Tm_parameters_strict"]),
            "c_seq": to_null(form_data["primer_Tm_parameters_c_seq"]),
            "shift": to_int(form_data["primer_Tm_parameters_shift"]),
            "nn_table": form_data["primer_Tm_parameters_nn_table"],
            "tmm_table": form_data["primer_Tm_parameters_tmm_table"],
            "imm_table": form_data["primer_Tm_parameters_imm_table"],
            "de_table": form_data["primer_Tm_parameters_de_table"],
            "dnac1": to_int(form_data["primer_Tm_parameters_dnac1"]),
            "dnac2": to_int(form_data["primer_Tm_parameters_dnac2"]),
            "selfcomp": to_bool(form_data["primer_Tm_parameters_selfcomp"]),
            "saltcorr": to_int(form_data["primer_Tm_parameters_saltcorr"]),
            "Na": to_int(form_data["primer_Tm_parameters_Na"]),
            "K": to_int(form_data["primer_Tm_parameters_K"]),
            "Tris": to_int(form_data["primer_Tm_parameters_Tris"]),
            "Mg": to_int(form_data["primer_Tm_parameters_Mg"]),
            "dNTPs": to_int(form_data["primer_Tm_parameters_dNTPs"])
        },
        "primer_Tm_chem_correction_parameters": None,
        "primer_Tm_salt_correction_parameters": None




    }


    # Write the YAML file
    with open("config_merfish.yaml", "w") as f:
        yaml.dump(config, f, sort_keys=False)

    result = subprocess.run(
        ['merfish_probe_designer', '-c', config_path],
        capture_output=True,
        text=True
    )

    if os.path.exists(form_data['file_regions']):
        print('deleted')
        os.remove(form_data['file_regions'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database'])
    print(a,"I am A")

    a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_target_probe'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_readout_probe'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_primer'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)



    return jsonify({
        'stdout': result.stdout,
        'stderr': result.stderr,
        'returncode': result.returncode
    })

@app.route('/api/seqfish', methods=['POST'])
def seqfish():
    config_path = "config_seqfish.yaml"
    #thread = threading.Thread(target=run_command)  # Run task in a separate thread
    #thread.start()

    form_data = request.json  # Assuming JSON is posted from React

    # Build the nested config structure:
    config = {
        "n_jobs": to_int(form_data["n_jobs"]),
        "dir_output": form_data["dir_output"],
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]),
        "top_n_sets": to_int(form_data["top_n_sets"]),
        # Probe sequences generation
        "file_regions": form_data["file_regions"],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_target_probe"]),
        "target_probe_length_min": to_int(form_data["probe_length_min"]),
        "target_probe_length_max": to_int(form_data["probe_length_max"]),
        "target_probe_isoform_consensus": to_int(form_data["probe_isoform_consensus"]),
        "target_probe_GC_content_min": to_int(form_data["probe_GC_content_min"]),
        "target_probe_GC_content_opt": to_int(form_data["probe_GC_content_opt"]),
        "target_probe_GC_content_max": to_int(form_data["probe_GC_content_max"]),


        "target_probe_T_secondary_structure": to_int(form_data["target_probe_T_secondary_structure"]),
        "target_probe_secondary_structures_threshold_deltaG": to_int(form_data["target_probe_secondary_structures_threshold_deltaG"]),
        "target_homopolymeric_base_n": {
            "A": to_int(form_data["homopolymeric_A"]),
            "T": to_int(form_data["homopolymeric_T"]),
            "C": to_int(form_data["homopolymeric_C"]),
            "G": to_int(form_data["homopolymeric_G"])
        },
        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]),


        "target_probe_UTR_weight": to_int(form_data["target_probe_UTR_weight"]),

        "set_size_min": to_int(form_data["set_size_min"]),
        "set_size_opt": to_int(form_data["set_size_opt"]),
        "distance_between_target_probes": to_int(form_data["distance_between_probes"]),
        "n_sets": to_int(form_data["n_sets"]),

        #READOUT PROBE PARAMETERS

        "files_fasta_reference_database_readout_probe": multiline_to_list(form_data["files_fasta_reference_database_readout_probe"]),
        "readout_probe_base_prob_a": float(form_data["readout_probe_base_prob_a"]),
        "readout_probe_base_prob_c": float(form_data["readout_probe_base_prob_c"]),
        "readout_probe_base_prob_g": float(form_data["readout_probe_base_prob_g"]),
        "readout_probe_base_prob_t": float(form_data["readout_probe_base_prob_t"]),
        "readout_probe_length": float(form_data["readout_probe_length"]),


        "readout_probe_GC_content_min": to_int(form_data["readout_probe_GC_content_min"]),
        "readout_probe_GC_content_max": to_int(form_data["readout_probe_GC_content_max"]),
        "readout_probe_homopolymeric_base_n":{
           "G": to_int(form_data["readout_probe_homopolymeric_base_n_g"])
        },

        "n_barcode_rounds": to_int(form_data["n_barcode_rounds"]),
        "n_pseudocolors": to_int(form_data["n_pseudocolors"]),
        "channels_ids": form_data["channels_ids"],

        #PRIMER PARAMETERS
        "files_fasta_reference_database_primer": multiline_to_list(form_data["files_fasta_reference_database_primer"]),
        "reverse_primer_sequence": form_data["reverse_primer_sequence"],
        "primer_length": to_int(form_data["primer_length"]),
        "primer_base_probabilities_a": float(form_data["primer_base_probabilities_a"]),
        "primer_base_probabilities_c": float(form_data["primer_base_probabilities_c"]),
        "primer_base_probabilities_g": float(form_data["primer_base_probabilities_g"]),
        "primer_base_probabilities_t": float(form_data["primer_base_probabilities_t"]),
        "primer_GC_content_min": to_int(form_data["primer_GC_content_min"]),
        "primer_GC_content_max": to_int(form_data["primer_GC_content_max"]),
        "primer_number_GC_GCclamp": to_int(form_data["primer_number_GC_GCclamp"]),
        "primer_number_three_prime_base_GCclamp": to_int(form_data["primer_number_three_prime_base_GCclamp"]),
        "primer_homopolymeric_base_n_a": to_int(form_data["primer_homopolymeric_base_n_a"]),
        "primer_homopolymeric_base_n_t": to_int(form_data["primer_homopolymeric_base_n_t"]),
        "primer_homopolymeric_base_n_c": to_int(form_data["primer_homopolymeric_base_n_c"]),
        "primer_homopolymeric_base_n_g": to_int(form_data["primer_homopolymeric_base_n_g"]),
        "primer_max_len_selfcomplement": to_int(form_data["primer_max_len_selfcomplement"]),
        "primer_max_len_complement_reverse_primer": to_int(form_data["primer_max_len_complement_reverse_primer"]),
        "primer_Tm_min": to_int(form_data["primer_Tm_min"]),
        "primer_Tm_max": to_int(form_data["primer_Tm_max"]),
        "primer_T_secondary_structure": to_int(form_data["primer_T_secondary_structure"]),
        "primer_secondary_structures_threshold_deltaG": to_int(form_data["primer_secondary_structures_threshold_deltaG"]),








        # Developer parameters
        "target_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_specificity_blastn_search_parameters_perc_identity"]),
            "strand": form_data["target_probe_specificity_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["target_probe_specificity_blastn_search_parameters_word_size"]),
            "dust": form_data["target_probe_specificity_blastn_search_parameters_dust"],
            "soft_masking": form_data["target_probe_specificity_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["target_probe_specificity_blastn_search_parameters_max_target_seqs"]),
            "max_hsps": to_int(form_data["target_probe_specificity_blastn_search_parameters_max_hsps"])
        },
        "target_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_specificity_blastn_hit_parameters_min_alignment_length"])
        },

        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters_perc_identity"]),
            "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters_word_size"]),
            "dust": form_data["target_probe_cross_hybridization_blastn_search_parameters_dust"],
            "soft_masking": form_data["target_probe_cross_hybridization_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters_max_target_seqs"])
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length"])
        },

        "max_graph_size": to_int(form_data["max_graph_size"]),
        "n_attempts": to_int(form_data["n_attempts"]),
        "pre_filter": to_bool(form_data["pre_filter"]),
        "heuristic": to_bool(form_data["heuristic"]),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]),


        #READOUT PROBE PARAMETERS
        "readout_probe_initial_num_sequences": to_int(form_data["readout_probe_initial_num_sequences"]),
        "readout_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_specificity_blastn_search_parameters_perc_identity"]),
            "strand": form_data["readout_probe_specificity_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["readout_probe_specificity_blastn_search_parameters_word_size"]),
            "dust": form_data["readout_probe_specificity_blastn_search_parameters_dust"],
            "soft_masking": form_data["readout_probe_specificity_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["readout_probe_specificity_blastn_search_parameters_max_target_seqs"]),
            "max_hsps": to_int(form_data["readout_probe_specificity_blastn_search_parameters_max_hsps"])
        },
        "readout_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_specificity_blastn_hit_parameters_min_alignment_length"])
        },

        "readout_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters_perc_identity"]),
            "strand": form_data["readout_probe_cross_hybridization_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters_word_size"]),
            "dust": form_data["readout_probe_cross_hybridization_blastn_search_parameters_dust"],
            "soft_masking": form_data["readout_probe_cross_hybridization_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters_max_target_seqs"])
        },
        "readout_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length"])
        },

        #PRIMER PARAMETERS

        "primer_initial_num_sequences": to_int(form_data["primer_initial_num_sequences"]),

        "primer_specificity_refrence_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_reference_blastn_search_parameters_perc_identity"]),
            "strand": form_data["primer_specificity_reference_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["primer_specificity_reference_blastn_search_parameters_word_size"]),
            "dust": form_data["primer_specificity_reference_blastn_search_parameters_dust"],
            "soft_masking": form_data["primer_specificity_reference_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["primer_specificity_reference_blastn_search_parameters_max_target_seqs"]),
            "max_hsps": to_int(form_data["primer_specificity_reference_blastn_search_parameters_max_hsps"])
        },
        "primer_specificity_refrence_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_reference_blastn_hit_parameters_min_alignment_length"])
        },
        "primer_specificity_encoding_probes_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters_perc_identity"]),
            "strand": form_data["primer_specificity_encoding_probes_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters_word_size"]),
            "dust": form_data["primer_specificity_encoding_probes_blastn_search_parameters_dust"],
            "soft_masking": form_data["primer_specificity_encoding_probes_blastn_search_parameters_soft_masking"],
            "max_target_seqs": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters_max_target_seqs"]),
            "max_hsps": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters_max_hsps"])
        },
        "primer_specificity_encoding_probes_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_encoding_probes_blastn_hit_parameters_min_alignment_length"])
        },
        "primer_Tm_parameters": {
            "check": to_bool(form_data["primer_Tm_parameters_check"]),
            "strict": to_bool(form_data["primer_Tm_parameters_strict"]),
            "c_seq": to_null(form_data["primer_Tm_parameters_c_seq"]),
            "shift": to_int(form_data["primer_Tm_parameters_shift"]),
            "nn_table": form_data["primer_Tm_parameters_nn_table"],
            "tmm_table": form_data["primer_Tm_parameters_tmm_table"],
            "imm_table": form_data["primer_Tm_parameters_imm_table"],
            "de_table": form_data["primer_Tm_parameters_de_table"],
            "dnac1": to_int(form_data["primer_Tm_parameters_dnac1"]),
            "dnac2": to_int(form_data["primer_Tm_parameters_dnac2"]),
            "selfcomp": to_bool(form_data["primer_Tm_parameters_selfcomp"]),
            "saltcorr": to_int(form_data["primer_Tm_parameters_saltcorr"]),
            "Na": to_int(form_data["primer_Tm_parameters_Na"]),
            "K": to_int(form_data["primer_Tm_parameters_K"]),
            "Tris": to_int(form_data["primer_Tm_parameters_Tris"]),
            "Mg": to_int(form_data["primer_Tm_parameters_Mg"]),
            "dNTPs": to_int(form_data["primer_Tm_parameters_dNTPs"])
        },
        "primer_Tm_chem_correction_parameters": None,
        "primer_Tm_salt_correction_parameters": None




    }


    # Write the YAML file
    with open("config_seqfish.yaml", "w") as f:
        yaml.dump(config, f, sort_keys=False)

    result = subprocess.run(
        ['seqfish_plus_probe_designer', '-c', config_path],
        capture_output=True,
        text=True
    )

    if os.path.exists(form_data['file_regions']):
        print('deleted')
        os.remove(form_data['file_regions'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_target_probe'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)



    return jsonify({
        'stdout': result.stdout,
        'stderr': result.stderr,
        'returncode': result.returncode
    })


@app.route('/api/genomic/ncbi', methods=['POST'])
def genomic_ncbi():

    try:
        # Define the path for the configuration file
        config_path = "config_genomic_ncbi.yaml"
        config_genomic = {}

        # Parse JSON data from the request
        form_data = request.json

        # Populate the config_genomic dictionary based on the received data
        config_genomic['dir_output'] = form_data['dir_output']
        config_genomic['source'] = form_data['source']
        config_genomic['source_params'] = {
            'taxon' : form_data['taxon'],
            'species' : form_data['species'],
            'annotation_release': to_int(form_data['annotation_release']),
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['gene']),
            'intergenic': to_bool(form_data['intergenic']),
            'exon': to_bool(form_data['exon']),
            'exon_exon_junction': to_bool(form_data['exon_exon_junction']),
            'utr': to_bool(form_data['UTR']),
            'cds': to_bool(form_data['CDS']),
            'intron': to_bool(form_data['intron'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size'])

        # Write the dictionary to a YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        try:
            # Run the genomic region generator
            result = subprocess.run(
                ['genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )

            # Check if the process was successful
            if result.returncode != 0:
                return jsonify({
                    "status": "error",
                    "message": "An error occurred during genomic processing.",
                    "error": result.stderr
                }), 500

            # Get the output file path
            output_dir = form_data['dir_output']
            generated_file = os.path.join(output_dir, "genomic_output.fasta")  # Adjust filename if needed

            # Check if the file exists
            if not os.path.exists(generated_file):
                return jsonify({
                    "status": "error",
                    "message": "Output file not found."
                }), 500

            # Return the file as a response for download
            return send_file(generated_file, as_attachment=True)

        except subprocess.CalledProcessError as e:
            return jsonify({
                "status": "error",
                "message": "An error occurred during genomic processing.",
                "error": e.stderr
            }), 500

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500

@app.route('/api/genomic/ensembl', methods=['POST'])
def genomic_ensemble():

    try:
        # Define the path for the configuration file
        config_path = "config_genomic_ensemble.yaml"
        config_genomic = {}

        # Parse JSON data from the request
        form_data = request.json

        # Populate the config_genomic dictionary based on the received data
        config_genomic['dir_output'] = form_data['dir_output']
        config_genomic['source'] = form_data['source']
        config_genomic['source_params'] = {
            'species' : form_data['species'],
            'annotation_release': to_int(form_data['annotation_release']),
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['gene']),
            'intergenic': to_bool(form_data['intergenic']),
            'exon': to_bool(form_data['exon']),
            'exon_exon_junction': to_bool(form_data['exon_exon_junction']),
            'utr': to_bool(form_data['UTR']),
            'cds': to_bool(form_data['CDS']),
            'intron': to_bool(form_data['intron'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size'])

        # Write the dictionary to a YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        # If you need to run a subprocess based on this configuration, do so here
        try:
            result = subprocess.run(
                ['genomic_region_generator','-c', config_path],
                capture_output=True,
                text=True
            )
            # Return success response
            return jsonify({
                "status": "success",
                "message": "Genomic processing completed successfully.",
                "output": result.stdout
            }), 200
        except subprocess.CalledProcessError as e:
            return jsonify({
                "status": "error",
                "message": "An error occurred during genomic processing.",
                "error": e.stderr
            }), 500

    except Exception as e:
        # Handle errors
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500
@app.route('/api/genomic/custom', methods=['POST'])
def genomic_custom():

    try:
        # Define the path for the configuration file
        config_path = "config_genomic_custom.yaml"
        config_genomic = {}

        # Parse JSON data from the request
        form_data = request.json

        # Populate the config_genomic dictionary based on the received data
        config_genomic['dir_output'] = form_data['dir_output']
        config_genomic['source'] = form_data['source']
        config_genomic['source_params'] = {
            'file_annotation' :  form_data['file_annotation'],
            'file_sequence' :  form_data['file_sequence'],
            'species' : form_data['species'],
            'annotation_release': to_int(form_data['annotation_release']),
            'genome_assembly' : form_data['genome_assembly'],
            'files_source' : form_data['files_source']
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['gene']),
            'intergenic': to_bool(form_data['intergenic']),
            'exon': to_bool(form_data['exon']),
            'exon_exon_junction': to_bool(form_data['exon_exon_junction']),
            'utr': to_bool(form_data['UTR']),
            'cds': to_bool(form_data['CDS']),
            'intron': to_bool(form_data['intron'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size'])

        # Write the dictionary to a YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        # If you need to run a subprocess based on this configuration, do so here
        try:
            print('try to run ')
            result = subprocess.run(
                ['conda', 'run', '-n', 'odt', 'genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )
            if os.path.exists(form_data['file_sequence']):
                os.remove(form_data['file_sequence'])
                os.remove(form_data['file_sequence']+'.fai')
            if os.path.exists(form_data['file_annotation']):
                os.remove(form_data['file_annotation'])  # Delete the file# Delete the file
            # Return success response
            return jsonify({
                "status": "success",
                "message": "Genomic processing completed successfully.",
                "output": result.stdout
            }), 200

        except subprocess.CalledProcessError as e:
            print('subprocess failed')
            if os.path.exists(form_data['file_sequence']):
                os.remove(form_data['file_sequence'])
                os.remove(form_data['file_sequence']+'.fai')
            if os.path.exists(form_data['file_annotation']):
                os.remove(form_data['file_annotation'])
            return jsonify({
                "status": "error",
                "message": "An error occurred during genomic processing.",
                "error": e.stderr
            }), 500



    except Exception as e:
        print('error without the subprocess')

        # Handle errors
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500
@app.route('/api/oligoseq', methods=['POST'])
def oligoseq():
    config_path = "config_OligoSeq.yaml"
    #thread = threading.Thread(target=run_command)  # Run task in a separate thread
    #thread.start()

    form_data = request.json  # Assuming JSON is posted from React

    # Build the nested config structure:
    config = {
        "n_jobs": to_int(form_data["n_jobs"]),
        "dir_output": form_data["dir_output"],
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]),
        "top_n_sets": to_int(form_data["top_n_sets"]),
        # Probe sequences generation
        "file_regions": form_data["file_regions"],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_target_probe"]),
        "target_probe_length_min": to_int(form_data["probe_length_min"]),
        "target_probe_length_max": to_int(form_data["probe_length_max"]),
        "target_probe_split_region": to_int(form_data["target_probe_split_region"]),
        "target_probe_targeted_exons": to_int(form_data["target_probe_targeted_exons"]),
        "target_probe_isoform_consensus": to_int(form_data["probe_isoform_consensus"]),

        # Property filters
        "target_probe_GC_content_min": to_int(form_data["probe_GC_content_min"]),
        "target_probe_GC_content_opt": to_int(form_data["probe_GC_content_opt"]),
        "target_probe_GC_content_max": to_int(form_data["probe_GC_content_max"]),
        "target_probe_Tm_min": to_int(form_data["probe_Tm_min"]),
        "target_probe_Tm_opt": to_int(form_data["probe_Tm_opt"]),
        "target_probe_Tm_max": to_int(form_data["probe_Tm_max"]),
        "target_probe_secondary_structures_T": to_int(form_data["target_probe_secondary_structures_T"]),
        "target_probe_secondary_structures_threshold_deltaG": to_int(form_data["target_probe_secondary_structures_threshold_deltaG"]),
        "target_homopolymeric_base_n": {
            "A": to_int(form_data["homopolymeric_A"]),
            "T": to_int(form_data["homopolymeric_T"]),
            "C": to_int(form_data["homopolymeric_C"]),
            "G": to_int(form_data["homopolymeric_G"])
        },
        "target_probe_max_len_selfcomplement": to_int(form_data["target_probe_max_len_selfcomplement"]),
        "target_probe_hybridization_probability_threshold": float(form_data["target_probe_hybridization_probability_threshold"]),


        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]),
        "target_probe_Tm_weight": to_int(form_data["target_probe_Tm_weight"]),


        "set_size_min": to_int(form_data["set_size_min"]),
        "set_size_opt": to_int(form_data["set_size_opt"]),
        "distance_between_target_probes": to_int(form_data["distance_between_probes"]),
        "n_sets": to_int(form_data["n_sets"]),


        # Developer parameters
        "target_probe_hybridization_probability_alignment_method" : form_data["target_probe_hybridization_probability_alignment_method"],
        "target_probe_hybridization_probability_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_hybridization_probability_blastn_search_parameters_perc_identity"]),
            "strand": form_data["target_probe_hybridization_probability_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["target_probe_hybridization_probability_blastn_search_parameters_word_size"]),

        },
        "target_probe_hybridization_probability_blastn_hit_parameters": {
            "coverage": to_int(form_data["target_probe_hybridization_probability_blastn_hit_parameters_coverage"])
        },
        "target_probe_hybridization_probability_bowtie_search_parameters": {
            "v": to_int(form_data["target_probe_hybridization_probability_bowtie_search_parameters_v"]),
            "-nofw": form_data["target_probe_hybridization_probability_bowtie_search_parameters_nofw"],

        },
        "target_probe_cross_hybridization_alignment_method" : form_data["target_probe_cross_hybridization_alignment_method"],


        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters_perc_identity"]),
            "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters_strand"],
            "word_size": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters_word_size"]),
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "coverage": to_int(form_data["target_probe_cross_hybridization_alignment_method"])
        },
        "target_probe_cross_hybridization_bowtie_search_parameters": {
            "-v": to_int(form_data["target_probe_cross_hybridization_bowtie_search_parameters_v"]),
            "--nofw": form_data["target_probe_cross_hybridization_bowtie_search_parameters_nofw"],

        },

        "max_graph_size": to_int(form_data["max_graph_size"]),
        "n_attempts": to_int(form_data["n_attempts"]),
        "pre_filter": to_bool(form_data["pre_filter"]),
        "heuristic": to_bool(form_data["heuristic"]),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]),


        # Melting Temperature Parameters
        "target_probe_Tm_parameters": {
            "check": to_bool(form_data["Tm_probe_check"]),
            "strict": to_bool(form_data["Tm_probe_strict"]),
            "c_seq": to_null(form_data["Tm_probe_c_seq"]),
            "shift": to_int(form_data["Tm_probe_shift"]),
            "nn_table": form_data["Tm_probe_nn_table"],
            "tmm_table": form_data["Tm_probe_tmm_table"],
            "imm_table": form_data["Tm_probe_imm_table"],
            "de_table": form_data["DE_probe_imm_table"],
            "dnac1": to_int(form_data["Tm_probe_dnac1"]),
            "dnac2": to_int(form_data["Tm_probe_dnac2"]),
            "selfcomp": to_bool(form_data["selfcomp"]),
            "saltcorr": to_int(form_data["Tm_probe_saltcorr"]),
            "Na": to_int(form_data["Tm_probe_Na"]),
            "K": to_int(form_data["Tm_probe_K"]),
            "Tris": to_int(form_data["Tm_probe_Tris"]),
            "Mg": to_int(form_data["Tm_probe_Mg"]),
            "dNTPs": to_int(form_data["Tm_probe_dNTPs"])
        },
        "target_probe_Tm_chem_correction_param_probe": None,
        # If Tm_salt_correction_param_probe is null, we just omit it or set it to None

        "target_probe_Tm_chem_correction_parameters": {
            "DMSO": to_int(form_data["target_probe_Tm_chem_correction_parameters_DMSO"]),
            "fmd": to_int(form_data["target_probe_Tm_chem_correction_parameters_fmd"]),
            "DMSOfactor": float(form_data["target_probe_Tm_chem_correction_parameters_DMSOfactor"]),
            "fmdfactor": float(form_data["target_probe_Tm_chem_correction_parameters_fmdfactor"]),
            "fmdmethod": to_int(form_data["target_probe_Tm_chem_correction_parameters_fmdmethod"]),
            "GC": to_null(form_data["target_probe_Tm_chem_correction_parameters_GC"])
        },
        "target_probe_Tm_salt_correction_parameters": None,


    }


    # Write the YAML file
    with open("config_OligoSeq.yaml", "w") as f:
        yaml.dump(config, f, sort_keys=False)

    result = subprocess.run(
        ['oligo_seq_probe_designer', '-c', config_path],
        capture_output=True,
        text=True
    )

    if os.path.exists(form_data['file_regions']):
        print('deleted')
        os.remove(form_data['file_regions'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_target_probe'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)



    return jsonify({
        'stdout': result.stdout,
        'stderr': result.stderr,
        'returncode': result.returncode
    })



if __name__ == "__main__":
    app.run(debug=True)
   # socketio.run(app, debug=True)