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

scrinshot_bp = Blueprint('scrinshot', __name__)

@scrinshot_bp.route('/api/scrinshot', methods=['POST'])
def scrinshot():
    """
    Handles the Scrinshot probe designer requests by preparing user inputs, managing temporary files,
    invoking the external probe designer tool, cleaning up resources, and updating run status in MongoDB.

    This function is triggered via a POST request from the frontend, typically with user-provided form data
    and a run ID. It orchestrates the workflow for running the Scrinshot probe designer pipeline as follows:

    - Loads and validates user/session context.
    - Extracts form data from the request, and ensures a valid MongoDB run ID is provided.
    - Prepares input files as needed (e.g., writes gene list as a temp file).
    - Builds the configuration dictionary for the probe designer pipeline based on the submitted form.
    - Writes this configuration as a YAML file to the user's directory.
    - Launches the external `scrinshot_probe_designer` process as a subprocess, passing the YAML config.
    - Cleans up any temporary files created during input preparation.
    - Updates the run status in MongoDB to reflect completion or errors.
    - Returns the run ID as a JSON response.

    :returns: JSON response containing the run ID.
    :rtype: flask.Response

    :request json formdata: The form data submitted from the frontend React application.
    :type formdata: dict

    :request json runid: The ID of the run document in MongoDB, as a string.
    :type runid: str

    :context user_dir: The user's data directory. For authenticated users, this is based on user ID;
        for anonymous sessions, it is based on a session ID.
    :type user_dir: str

    :context config_path: The path where the YAML configuration file will be written.
    :type config_path: str

    :context session_id: The session ID, used for anonymous users.
    :type session_id: str

    :context run_id: The MongoDB ObjectId for the run document.
    :type run_id: ObjectId

    :context output_path: The directory where output files from the probe designer will be stored.
    :type output_path: str

    :context config: The configuration dictionary assembled from user inputs.
    :type config: dict

    :raises: Returns HTTP 400 if the provided run ID is invalid.
    :raises: Returns HTTP 404 if the run ID is not found in the database.

    Workflow steps:
      1. Determine user or session context and prepare the working directory.
      2. Parse and validate form data and run ID.
      3. Create a temporary regions file if needed, and update form data accordingly.
      4. Update the database with the initial run status ('started').
      5. Build the config dictionary from form data and write to YAML.
      6. Invoke the external Scrinshot probe designer subprocess.
      7. Clean up any temporary files created.
      8. Update the run status in MongoDB based on subprocess completion.
      9. Return the run ID as confirmation.

    For more information on the input parameters and configuration options, refer to the Scrinshot documentation.

    """
    user_dir=''
    if current_user.is_authenticated:
        print('yes authenticated')
        user_id = str(current_user.id)
        user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
        config_path = os.path.join(user_dir,'config.yaml')
        session_id = None

    else:
        user_id = None
        session_id = session['session_id']
        user_dir = os.path.join(current_app.root_path, 'user_data', 'anon',session_id)
        config_path = os.path.join(user_dir,'config.yaml')
        print('no not')


    form_data = request.json.get('formdata')
    print('form data', form_data)
    run_idd=request.json.get('runid')# Assuming JSON is posted from React
    try:
        run_id = ObjectId(run_idd)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Invalid run ID"}), 400

    # Build the nested config structure:
    if form_data["file_regions"]['value']!='':
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
    else:
        form_data["file_regions"]['value']=None
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    output_path = os.path.join(user_dir, f'output_scrinshot_probe_designer_{timestamp}')

    # Update run status to started in database
    update_result = mongo.db.runs.update_one(
        {"_id": run_id},
        {"$set": {
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": output_path,
            "status": "started",
            "pipeline": "scrinshot"
        }}
    )
    if update_result.matched_count == 0:
        return jsonify({"error": "Run ID not found"}), 404

    # Prepare configuration dictionary from form data
    config = {
        "n_jobs": to_int(form_data["n_jobs"]['value']),
        "dir_output": output_path,
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
        "target_probe_Tm_opt": to_int(form_data["target_probe_Tm_opt"]['value']),

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
        "detection_oligo_Tm_salt_correction_parameters": None,
        "target_probe_Tm_salt_correction_parameters": None,

    }

    # Write the YAML configuration file
    with open(config_path, "w") as f:
        yaml.dump(config, f, sort_keys=False)

    # Run the scrinshot_probe_designer subprocess
    result = subprocess.run(
                ['scrinshot_probe_designer', '-c', config_path],
                capture_output=True,
                text=True
            )
    print("STDERR:", result.stderr)
    print("STDOUT (partial logs):", result.stdout)
    status = "completed" if result.returncode == 0 else "error"

    # Clean up file_regions temp file safely
    if form_data['file_regions']['value']:
        temp_path = form_data['file_regions']['value'].strip()
        if os.path.exists(temp_path):
            print('deleted temp file_regions:', temp_path)
            os.remove(temp_path)
        else:
            print('file_regions not found, skipped:', temp_path)

    # Update run status in database
    mongo.db.runs.update_one(
        {"_id": run_id},
        {"$set": {"status":status}}
    )

    return jsonify({
                "run_id": str(run_id),
            })