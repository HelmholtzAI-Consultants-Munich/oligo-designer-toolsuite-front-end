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
    if ".txt" not in form_data["file_regions"]['value']:
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
            file_path = temp_file.name
            # Write each gene on a new line
            temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"]['value'].split(","))
        print(f"File created: {file_path}")
        with open(file_path, "r") as f:
            print("File content:")
            print(f.read())

        form_data["file_regions"]['value']=file_path
        print(form_data["file_regions"])
    config = {
        "n_jobs": to_int(form_data["n_jobs"]['value']),
        "dir_output": form_data["dir_output"]['value'],
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

        # Padlock arms
        "target_probe_padlock_arm_Tm_dif_max": to_int(form_data["target_probe_padlock_arm_Tm_dif_max"]['value']),
        "target_probe_padlock_arm_length_min": to_int(form_data["target_probe_padlock_arm_length_min"]['value']),
        "target_probe_padlock_arm_Tm_min": to_int(form_data["target_probe_padlock_arm_Tm_min"]['value']),
        "target_probe_padlock_arm_Tm_max": to_int(form_data["target_probe_padlock_arm_Tm_max"]['value']),

        # Detection oligos
        "detection_oligo_min_thymines": to_int(form_data["detection_oligo_min_thymines"]['value']),
        "detection_oligo_length_min": to_int(form_data["detection_oligo_length_min"]['value']),
        "detection_oligo_length_max": to_int(form_data["detection_oligo_length_max"]['value']),

        # Specificity filters
        "target_probe_ligation_region_size": to_int(form_data["target_probe_ligation_region_size"]['value']),

        # Set selection parameters
        "target_probe_isoform_weight": to_int(form_data["target_probe_isoform_weight"]['value']),
        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]['value']),
        "target_probe_Tm_weight": to_int(form_data["target_probe_Tm_weight"]['value']),
        "set_size_min": to_int(form_data["set_size_min"]['value']),
        "set_size_opt": to_int(form_data["set_size_opt"]['value']),
        "distance_between_target_probes": to_int(form_data["distance_between_target_probes"]['value']),
        "n_sets": to_int(form_data["n_sets"]['value']),

        # Final sequence design
        "detection_oligo_U_distance": to_int(form_data["detection_oligo_U_distance"]['value']),
        "detection_oligo_Tm_opt": to_int(form_data["detection_oligo_Tm_opt"]['value']),


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
            "coverage": to_int(form_data["target_probe_specificity_blastn_hit_parameters"]['coverage']['value'])
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
            "coverage": to_int(form_data["target_probe_cross_hybridization_blastn_hit_parameters"]['coverage']['value'])
        },

        "max_graph_size": to_int(form_data["max_graph_size"]['value']),
        "n_attempts": to_int(form_data["n_attempts"]['value']),
        "heuristic": to_bool(form_data["heuristic"]['value']),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]['value']),

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

        "target_probe_Tm_chem_correction_parameters": {
            "DMSO": to_int(form_data["target_probe_Tm_chem_correction_parameters"]['DMSO']['value']),
            "fmd": to_int(form_data["target_probe_Tm_chem_correction_parameters"]['fmd']['value']),
            "DMSOfactor": float(form_data["target_probe_Tm_chem_correction_parameters"]['DMSOfactor']['value']),
            "fmdfactor": float(form_data["target_probe_Tm_chem_correction_parameters"]['fmdfactor']['value']),
            "fmdmethod": to_int(form_data["target_probe_Tm_chem_correction_parameters"]['fmdmethod']['value']),
            "GC": to_null(form_data["target_probe_Tm_chem_correction_parameters"]['GC']['value'])
        },
        # If Tm_salt_correction_param_probe is null, we just omit it or set it to None
        "target_probe_Tm_salt_correction_param_probe": None,

        "detection_oligo_Tm_parameters": {
            "nn_table": form_data["detection_oligo_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["detection_oligo_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["detection_oligo_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["detection_oligo_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["detection_oligo_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["detection_oligo_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["detection_oligo_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["detection_oligo_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["detection_oligo_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["detection_oligo_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["detection_oligo_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["detection_oligo_Tm_parameters"]['dNTPs']['value'])
        },
        "detection_oligo_Tm_chem_correction_parameters": {
            "DMSO": to_int(form_data["detection_oligo_Tm_chem_correction_parameters"]['DMSO']['value']),
            "fmd": to_int(form_data["detection_oligo_Tm_chem_correction_parameters"]['fmd']['value']),
            "DMSOfactor": float(form_data["detection_oligo_Tm_chem_correction_parameters"]['DMSOfactor']['value']),
            "fmdfactor": float(form_data["detection_oligo_Tm_chem_correction_parameters"]['fmdfactor']['value']),
            "fmdmethod": to_int(form_data["detection_oligo_Tm_chem_correction_parameters"]['fmdmethod']['value']),
            "GC": to_null(form_data["detection_oligo_Tm_chem_correction_parameters"]['GC']['value'])
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

    if os.path.exists(form_data['file_regions']['value']):
        print('deleted')
        os.remove(form_data['file_regions']['value'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database']['value'])

    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_target_probe']['value'])
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
        config_genomic['dir_output'] = form_data['dir_output']['value']
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'taxon' : form_data['source_params']['taxon']['value'],
            'species' : form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['UTR']['value']),
            'cds': to_bool(form_data['genomic_regions']['CDS']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

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

        # Populate the config_genomic dictionary based on the received data
        config_genomic['dir_output'] = form_data['dir_output']['value']
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'species' : form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['UTR']['value']),
            'cds': to_bool(form_data['genomic_regions']['CDS']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

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
        config_genomic['dir_output'] = form_data['dir_output']['value']
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'file_annotation': form_data['source_params']['file_annotation']['value'],
            'file_sequence': form_data['source_params']['file_sequence']['value'],
            'file_source': form_data['source_params']['file_source']['value'],
            'species' : form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
            'genome_assembly': form_data['source_params']['genome_assembly']['value'],
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['UTR']['value']),
            'cds': to_bool(form_data['genomic_regions']['CDS']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

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