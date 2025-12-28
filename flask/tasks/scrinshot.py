import os
import subprocess
import tempfile
import traceback
import yaml
from datetime import datetime
from bson import ObjectId
from extensions import celery, mongo

try:
    from ..routes.helpers import to_bool, to_int, multiline_to_list, to_null, split_on_newline
except ImportError:
    # Fallback for when running app.py directly
    from routes.helpers import to_bool, to_int, multiline_to_list, to_null, split_on_newline


@celery.task(bind=True)
def run_scrinshot_pipeline(self, form_data, run_id, user_dir, session_id, user_id):
    """
    Celery task to run the Scrinshot probe designer pipeline.

    Args:
        form_data (dict): The form data from the frontend
        run_id (str): The MongoDB ObjectId as string
        user_dir (str): The user's data directory path
        session_id (str): Session ID for anonymous users
        user_id (str): User ID for authenticated users

    Returns:
        dict: Result containing run_id and status
    """
    try:
        # Update task progress
        self.update_state(state="PROGRESS", meta={"status": "Starting pipeline..."})

        # Convert run_id back to ObjectId
        run_id_obj = ObjectId(run_id)

        # Build the nested config structure
        if form_data["file_regions"]["value"] != "":
            if ".txt" not in form_data["file_regions"]["value"]:
                with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
                    file_path = temp_file.name
                    # Write each gene on a new line
                    temp_file.writelines(
                        gene.strip() + "\n" for gene in form_data["file_regions"]["value"].split(",")
                    )
                print(f"File created: {file_path}")
                with open(file_path) as f:
                    print("File content:")
                    print(f.read())
                form_data["file_regions"]["value"] = file_path
        else:
            form_data["file_regions"]["value"] = None

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        output_path = os.path.join(user_dir, f"output_scrinshot_probe_designer_{timestamp}")
        config_path = os.path.join(user_dir, "config.yaml")

        # Update task progress
        self.update_state(state="PROGRESS", meta={"status": "Building configuration..."})

        # Prepare configuration dictionary from form data
        config = {
            "n_jobs": to_int(form_data["n_jobs"]["value"]),
            "dir_output": output_path,
            "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]["value"]),
            "top_n_sets": to_int(form_data["top_n_sets"]["value"]),
            # Probe sequences generation
            "file_regions": form_data["file_regions"]["value"],
            "files_fasta_target_probe_database": multiline_to_list(
                form_data["files_fasta_target_probe_database"]["value"]
            ),
            "files_fasta_reference_database_target_probe": multiline_to_list(
                form_data["files_fasta_reference_database_target_probe"]["value"]
            ),
            "target_probe_length_min": to_int(form_data["target_probe_length_min"]["value"]),
            "target_probe_length_max": to_int(form_data["target_probe_length_max"]["value"]),
            "target_probe_isoform_consensus": to_int(form_data["target_probe_isoform_consensus"]["value"]),
            # Property filters
            "target_probe_GC_content_min": to_int(form_data["target_probe_GC_content_min"]["value"]),
            "target_probe_GC_content_opt": to_int(form_data["target_probe_GC_content_opt"]["value"]),
            "target_probe_GC_content_max": to_int(form_data["target_probe_GC_content_max"]["value"]),
            "target_probe_Tm_min": to_int(form_data["target_probe_Tm_min"]["value"]),
            "target_probe_Tm_opt": to_int(form_data["target_probe_Tm_opt"]["value"]),
            "target_probe_Tm_max": to_int(form_data["target_probe_Tm_max"]["value"]),
            "target_probe_homopolymeric_base_n": {
                "A": to_int(form_data["target_probe_homopolymeric_base_n"]["A"]["value"]),
                "T": to_int(form_data["target_probe_homopolymeric_base_n"]["T"]["value"]),
                "C": to_int(form_data["target_probe_homopolymeric_base_n"]["C"]["value"]),
                "G": to_int(form_data["target_probe_homopolymeric_base_n"]["G"]["value"]),
            },
            # Padlock arms
            "target_probe_padlock_arm_Tm_dif_max": to_int(
                form_data["target_probe_padlock_arm_Tm_dif_max"]["value"]
            ),
            "target_probe_padlock_arm_length_min": to_int(
                form_data["target_probe_padlock_arm_length_min"]["value"]
            ),
            "target_probe_padlock_arm_Tm_min": to_int(form_data["target_probe_padlock_arm_Tm_min"]["value"]),
            "target_probe_padlock_arm_Tm_max": to_int(form_data["target_probe_padlock_arm_Tm_max"]["value"]),
            # Detection oligos
            "detection_oligo_min_thymines": to_int(form_data["detection_oligo_min_thymines"]["value"]),
            "detection_oligo_length_min": to_int(form_data["detection_oligo_length_min"]["value"]),
            "detection_oligo_length_max": to_int(form_data["detection_oligo_length_max"]["value"]),
            # Specificity filters
            "target_probe_ligation_region_size": to_int(
                form_data["target_probe_ligation_region_size"]["value"]
            ),
            # Set selection parameters
            "target_probe_isoform_weight": to_int(form_data["target_probe_isoform_weight"]["value"]),
            "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]["value"]),
            "target_probe_Tm_weight": to_int(form_data["target_probe_Tm_weight"]["value"]),
            "set_size_min": to_int(form_data["set_size_min"]["value"]),
            "set_size_opt": to_int(form_data["set_size_opt"]["value"]),
            "distance_between_target_probes": to_int(form_data["distance_between_target_probes"]["value"]),
            "n_sets": to_int(form_data["n_sets"]["value"]),
            # Final sequence design
            "detection_oligo_U_distance": to_int(form_data["detection_oligo_U_distance"]["value"]),
            "detection_oligo_Tm_opt": to_int(form_data["detection_oligo_Tm_opt"]["value"]),
            # Developer parameters
            "target_probe_specificity_blastn_search_parameters": {
                "perc_identity": to_int(
                    form_data["target_probe_specificity_blastn_search_parameters"]["perc_identity"]["value"]
                ),
                "strand": form_data["target_probe_specificity_blastn_search_parameters"]["strand"]["value"],
                "word_size": to_int(
                    form_data["target_probe_specificity_blastn_search_parameters"]["word_size"]["value"]
                ),
                "dust": form_data["target_probe_specificity_blastn_search_parameters"]["dust"]["value"],
                "soft_masking": form_data["target_probe_specificity_blastn_search_parameters"][
                    "soft_masking"
                ]["value"],
                "max_target_seqs": to_int(
                    form_data["target_probe_specificity_blastn_search_parameters"]["max_target_seqs"]["value"]
                ),
                "max_hsps": to_int(
                    form_data["target_probe_specificity_blastn_search_parameters"]["max_hsps"]["value"]
                ),
            },
            "target_probe_specificity_blastn_hit_parameters": {
                "coverage": to_int(
                    form_data["target_probe_specificity_blastn_hit_parameters"]["coverage"]["value"]
                )
            },
            "target_probe_cross_hybridization_blastn_search_parameters": {
                "perc_identity": to_int(
                    form_data["target_probe_cross_hybridization_blastn_search_parameters"]["perc_identity"][
                        "value"
                    ]
                ),
                "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters"]["strand"][
                    "value"
                ],
                "word_size": to_int(
                    form_data["target_probe_cross_hybridization_blastn_search_parameters"]["word_size"][
                        "value"
                    ]
                ),
                "dust": form_data["target_probe_cross_hybridization_blastn_search_parameters"]["dust"][
                    "value"
                ],
                "soft_masking": form_data["target_probe_cross_hybridization_blastn_search_parameters"][
                    "soft_masking"
                ]["value"],
                "max_target_seqs": to_int(
                    form_data["target_probe_cross_hybridization_blastn_search_parameters"]["max_target_seqs"][
                        "value"
                    ]
                ),
            },
            "target_probe_cross_hybridization_blastn_hit_parameters": {
                "coverage": to_int(
                    form_data["target_probe_cross_hybridization_blastn_search_parameters"]["coverage"][
                        "value"
                    ]
                )
            },
            "max_graph_size": to_int(form_data["max_graph_size"]["value"]),
            "n_attempts": to_int(form_data["n_attempts"]["value"]),
            "heuristic": to_bool(form_data["heuristic"]["value"]),
            "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]["value"]),
            # Melting Temperature Parameters
            "target_probe_Tm_parameters": {
                "nn_table": form_data["target_probe_Tm_parameters"]["nn_table"]["value"],
                "tmm_table": form_data["target_probe_Tm_parameters"]["tmm_table"]["value"],
                "imm_table": form_data["target_probe_Tm_parameters"]["imm_table"]["value"],
                "de_table": form_data["target_probe_Tm_parameters"]["de_table"]["value"],
                "dnac1": to_int(form_data["target_probe_Tm_parameters"]["dnac1"]["value"]),
                "dnac2": to_int(form_data["target_probe_Tm_parameters"]["dnac2"]["value"]),
                "saltcorr": to_int(form_data["target_probe_Tm_parameters"]["saltcorr"]["value"]),
                "Na": to_int(form_data["target_probe_Tm_parameters"]["Na"]["value"]),
                "K": to_int(form_data["target_probe_Tm_parameters"]["K"]["value"]),
                "Tris": to_int(form_data["target_probe_Tm_parameters"]["Tris"]["value"]),
                "Mg": to_int(form_data["target_probe_Tm_parameters"]["Mg"]["value"]),
                "dNTPs": to_int(form_data["target_probe_Tm_parameters"]["dNTPs"]["value"]),
            },
            "target_probe_Tm_chem_correction_parameters": {
                "DMSO": to_int(form_data["target_probe_Tm_chem_correction_parameters"]["DMSO"]["value"]),
                "fmd": to_int(form_data["target_probe_Tm_chem_correction_parameters"]["fmd"]["value"]),
                "DMSOfactor": float(
                    form_data["target_probe_Tm_chem_correction_parameters"]["DMSOfactor"]["value"]
                ),
                "fmdfactor": float(
                    form_data["target_probe_Tm_chem_correction_parameters"]["fmdfactor"]["value"]
                ),
                "fmdmethod": to_int(
                    form_data["target_probe_Tm_chem_correction_parameters"]["fmdmethod"]["value"]
                ),
                "GC": to_null(form_data["target_probe_Tm_chem_correction_parameters"]["GC"]["value"]),
            },
            # If Tm_salt_correction_param_probe is null, we just omit it or set it to None
            "target_probe_Tm_salt_correction_param_probe": None,
            "detection_oligo_Tm_parameters": {
                "nn_table": form_data["detection_oligo_Tm_parameters"]["nn_table"]["value"],
                "tmm_table": form_data["detection_oligo_Tm_parameters"]["tmm_table"]["value"],
                "imm_table": form_data["detection_oligo_Tm_parameters"]["imm_table"]["value"],
                "de_table": form_data["detection_oligo_Tm_parameters"]["de_table"]["value"],
                "dnac1": to_int(form_data["detection_oligo_Tm_parameters"]["dnac1"]["value"]),
                "dnac2": to_int(form_data["detection_oligo_Tm_parameters"]["dnac2"]["value"]),
                "saltcorr": to_int(form_data["detection_oligo_Tm_parameters"]["saltcorr"]["value"]),
                "Na": to_int(form_data["detection_oligo_Tm_parameters"]["Na"]["value"]),
                "K": to_int(form_data["detection_oligo_Tm_parameters"]["K"]["value"]),
                "Tris": to_int(form_data["detection_oligo_Tm_parameters"]["Tris"]["value"]),
                "Mg": to_int(form_data["detection_oligo_Tm_parameters"]["Mg"]["value"]),
                "dNTPs": to_int(form_data["detection_oligo_Tm_parameters"]["dNTPs"]["value"]),
            },
            "detection_oligo_Tm_chem_correction_parameters": {
                "DMSO": to_int(form_data["detection_oligo_Tm_chem_correction_parameters"]["DMSO"]["value"]),
                "fmd": to_int(form_data["detection_oligo_Tm_chem_correction_parameters"]["fmd"]["value"]),
                "DMSOfactor": float(
                    form_data["detection_oligo_Tm_chem_correction_parameters"]["DMSOfactor"]["value"]
                ),
                "fmdfactor": float(
                    form_data["detection_oligo_Tm_chem_correction_parameters"]["fmdfactor"]["value"]
                ),
                "fmdmethod": to_int(
                    form_data["detection_oligo_Tm_chem_correction_parameters"]["fmdmethod"]["value"]
                ),
                "GC": to_null(form_data["detection_oligo_Tm_chem_correction_parameters"]["GC"]["value"]),
            },
            "detection_oligo_Tm_salt_correction_parameters": None,
            "target_probe_Tm_salt_correction_parameters": None,
        }

        # Write the YAML configuration file
        with open(config_path, "w") as f:
            yaml.dump(config, f, sort_keys=False)

        # Update task progress
        self.update_state(state="PROGRESS", meta={"status": "Running Scrinshot pipeline..."})

        # Run the scrinshot_probe_designer subprocess
        result = subprocess.run(
            ["scrinshot_probe_designer", "-c", config_path], capture_output=True, text=True
        )

        print("STDERR:", result.stderr)
        print("STDOUT (partial logs):", result.stdout)
        status = "completed" if result.returncode == 0 else "error"

        # Update task progress
        self.update_state(state="PROGRESS", meta={"status": "Cleaning up temporary files..."})

        # Clean up file_regions temp file safely
        if form_data["file_regions"]["value"]:
            temp_path = form_data["file_regions"]["value"].strip()
            if os.path.exists(temp_path):
                print("deleted temp file_regions:", temp_path)
                os.remove(temp_path)
            else:
                print("file_regions not found, skipped:", temp_path)

        # Clean up temporary files
        if form_data["file_regions"]["value"] and os.path.exists(form_data["file_regions"]["value"]):
            print("deleted")
            os.remove(form_data["file_regions"]["value"])

        a = split_on_newline(form_data["files_fasta_target_probe_database"]["value"])
        if "\n" in a:
            a.remove("\n")
        for i in a:
            print("deleted")
            if os.path.exists(i):
                os.remove(i)

        a = split_on_newline(form_data["files_fasta_reference_database_target_probe"]["value"])
        if "\n" in a:
            a.remove("\n")
        for i in a:
            print("deleted")
            if os.path.exists(i):
                os.remove(i)

        # Update run status in database
        mongo.db.runs.update_one({"_id": run_id_obj}, {"$set": {"status": status}})

        return {"run_id": run_id, "status": status, "output_path": output_path}

    except Exception as e:
        # Import error handler for sanitization
        from routes.error_handlers import sanitize_error_message_for_storage

        # Sanitize error message for user display
        sanitized_error = sanitize_error_message_for_storage(e)

        # Update task state to failure (include full details for debugging)
        self.update_state(state="FAILURE", meta={"error": str(e), "traceback": traceback.format_exc()})

        # Update database with error status (store sanitized message)
        try:
            run_id_obj = ObjectId(run_id)
            mongo.db.runs.update_one(
                {"_id": run_id_obj}, {"$set": {"status": "error", "error_message": sanitized_error}}
            )
        except Exception:
            pass  # If we can't update the database, just continue

        raise e
