import os
import subprocess
import tempfile
from datetime import datetime

from flask_login.utils import LocalProxy
import yaml
from bson import ObjectId
from flask import current_app, jsonify, session

from extensions import mongo
from ..error_handlers import create_user_error_response
from bson.errors import InvalidId


class PipelineRunner:
    """
    Handles the pipeline requests by preparing user inputs, managing temporary files,
    invoking the external probe designer tool, cleaning up resources, and updating run status in MongoDB.

    This function is triggered via a POST request from the frontend, typically with user-provided form data
    and a run ID. It orchestrates the workflow for running the pipeline as follows:

    - Loads and validates user/session context.
    - Extracts form data from the request, and ensures a valid MongoDB run ID is provided.
    - Prepares input files as needed (e.g., writes gene list as a temp file).
    - Builds the configuration dictionary for the probe designer pipeline based on the submitted form.
    - Writes this configuration as a YAML file to the user's directory.
    - Launches the external `[<pipeline_name>]_probe_designer` process as a subprocess, passing the YAML config.
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

    For more information on the input parameters and configuration options, refer to the pipeline documentation.

    """

    def __init__(self, pipeline_name: str, subprocess_name: str, schema: dict):
        self.pipeline_name = pipeline_name  # e.g., 'merfish'
        self.subprocess_name = subprocess_name  # e.g., 'merfish_probe_designer'
        self.schema = schema  # JSON schema

    def run(self, current_user: LocalProxy, form_data: dict, run_id_str: str):
        try:
            # Convert run ID string to ObjectId
            if not run_id_str:
                return jsonify(
                    {"error": "The run ID you provided is not valid. Please check and try again."}
                ), 400
            try:
                run_id = ObjectId(run_id_str)
            except (InvalidId, Exception) as e:
                return create_user_error_response(e, "submission")

            # User Directory and Session / User ID Logic
            try:
                context = self.create_context(current_user)
            except Exception as e:
                return create_user_error_response(e, "submission")

            # Temp File Creation (if needed)
            try:
                self.populate_temp_file(form_data)
            except Exception as e:
                return create_user_error_response(e, "submission")

            # Mark Run as Started in DB
            update_result = self.write_run_to_DB(run_id, context)
            if update_result.matched_count == 0:
                return create_user_error_response(ValueError("Run ID not found"), "submission")

            # Build Config and Write to YAML
            try:
                self.write_config_file(form_data, context)
            except Exception as e:
                return create_user_error_response(e, "submission")

            # Subprocess Call
            try:
                status = self.call_subprocess(context["config_path"])
            except Exception as e:
                # Update run status to error before returning
                try:
                    self.update_run_status_in_DB(run_id, "error")
                except Exception:
                    pass  # If we can't update DB, continue with error response
                return create_user_error_response(e, "submission")

            # Cleanup of Temporary Files
            try:
                self.cleanup_temp_files(form_data)
            except Exception as e:
                # Log cleanup errors but don't fail the request
                current_app.logger.warning(f"Error during cleanup: {e}")

            # DB Update
            self.update_run_status_in_DB(run_id, status)

            # Response - return tuple for consistency with error responses
            return jsonify(
                {
                    "run_id": str(run_id),
                }
            ), 200
        except Exception as e:
            # Catch-all for any unexpected errors
            return create_user_error_response(e, "submission")

    def create_context(self, current_user: LocalProxy) -> dict:
        if current_user.is_authenticated:
            # Authenticated user: use user-specific directory
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, "user_data", user_id)
            config_path = os.path.join(user_dir, f"config_{self.pipeline_name}.yaml")
            session_id = None
        else:
            # Anonymous user: use session-based directory
            user_id = None
            session_id = session.get("session_id")
            if not session_id:
                raise ValueError("Invalid session configuration")
            user_dir = os.path.join(current_app.root_path, "user_data", "anon", session_id)
            config_path = os.path.join(user_dir, "config.yaml")

        if not os.path.exists(user_dir):
            raise RuntimeError("User directory not found")

        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        output_path = os.path.join(user_dir, f"output_{self.pipeline_name}_probe_designer_{timestamp}")

        context = {
            "user_id": user_id,
            "session_id": session_id,
            "config_path": config_path,
            "user_dir": user_dir,
            "timestamp": timestamp,
            "output_path": output_path,
        }
        return context

    def populate_temp_file(self, form_data: dict) -> None:
        if form_data["file_regions"] != "":
            if ".txt" not in form_data["file_regions"]:
                with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
                    file_path = temp_file.name
                    # Write each gene on a new line
                    temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"].split(","))
                # Update the path in form_data to point to the temp file
                form_data["file_regions"] = file_path
        else:
            form_data["file_regions"] = None

    def write_config_file(self, form_data: dict, context: dict) -> None:
        config = form_data

        # Override output directory
        config["dir_output"] = context.get("output_path")

        # Write config to YAML file
        print(f"Writing config to {context['config_path']}")
        current_app.logger.warning(config)
        # Ensure parent directory exists
        config_dir = os.path.dirname(context["config_path"])
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
        with open(context["config_path"], "w") as f:
            yaml.dump(config, f, sort_keys=False)

    def call_subprocess(self, config_path: str) -> str:
        result = subprocess.run([self.subprocess_name, "-c", config_path], capture_output=True, text=True)
        print("STDERR:", result.stderr)
        print("STDOUT (partial logs):", result.stdout)
        return "completed" if result.returncode == 0 else "failed"

    def update_run_in_DB(self, run_id: ObjectId, data: dict):
        return mongo.db.runs.update_one({"_id": run_id}, {"$set": data})

    def write_run_to_DB(self, runId: ObjectId, context: dict) -> ObjectId:
        return self.update_run_in_DB(
            runId,
            {
                "session_id": context.get("session_id"),
                "user_id": context.get("user_id"),
                "timestamp": context.get("timestamp"),
                "output_path": context.get("output_path"),
                "status": "started",
                "pipeline": self.pipeline_name,
            },
        )

    def cleanup_temp_files(self, form_data: dict) -> None:
        # Remove temp file for file_regions if it was created
        if form_data["file_regions"]:
            temp_path = form_data["file_regions"].strip()
            if os.path.exists(temp_path):
                os.remove(temp_path)
                print("deleted temp file_regions:", temp_path)
            else:
                print("file_regions not found, skipped:", temp_path)

        # Remove temp files for fasta inputs
        fasta_fields = [
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
            "files_fasta_reference_database_readout_probe",
            "files_fasta_reference_database_primer",
        ]
        for field in fasta_fields:
            if field not in form_data:
                continue
            files_list = form_data[field]
            for fname in files_list:
                if os.path.exists(fname):
                    os.remove(fname)

    def update_run_status_in_DB(self, run_id: ObjectId, status: str):
        return self.update_run_in_DB(run_id, {"status": status})
