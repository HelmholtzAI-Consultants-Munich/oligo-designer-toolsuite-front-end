from datetime import datetime
import subprocess
import tempfile
import traceback
from bson import ObjectId
from flask import jsonify, session, current_app
from ..helpers import multiline_to_list, split_on_newline, to_bool, to_int, to_null
from flask_login import current_user
import os
import yaml
from extensions import mongo

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
        self.pipeline_name = pipeline_name # e.g., 'merfish'
        self.subprocess_name = subprocess_name # e.g., 'merfish_probe_designer'
        self.schema = schema # JSON schema

    def run(self, current_user: current_user, form_data: dict, run_id_str: str):
        # Convert run ID string to ObjectId
        try:
            run_id = ObjectId(run_id_str)
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": "Invalid run ID"}), 400

        # User Directory and Session / User ID Logic
        context = self.create_context(current_user)

        # Temp File Creation (if needed)
        self.populate_temp_file(form_data)

        # Mark Run as Started in DB
        update_result = self.write_run_to_DB(run_id, context)
        if update_result.matched_count == 0:
            return jsonify({"error": "Run ID not found"}), 404

        # Build Config and Write to YAML
        self.populate_config_file(form_data, context)

        # Subprocess Call
        status = self.call_subprocess(context["config_path"])

        # Cleanup of Temporary Files
        self.cleanup_temp_files(form_data)

        # DB Update
        self.update_run_status_in_DB(run_id, status)

        # Response
        return jsonify({
            "run_id": str(run_id),
        })


    def create_context(self, current_user: current_user) -> dict:
        if current_user.is_authenticated:
            # Authenticated user: use user-specific directory
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            config_path = os.path.join(user_dir, f'config_{self.pipeline_name}.yaml')
            session_id = None
        else:
            # Anonymous user: use session-based directory
            user_id = None
            session_id = session['session_id']
            user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session_id)
            config_path = os.path.join(user_dir, 'config.yaml')

        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_{self.pipeline_name}_probe_designer_{timestamp}')
        
        context = {
            "user_id": user_id,
            "session_id": session_id,
            "config_path": config_path,
            "user_dir": user_dir,
            "timestamp": timestamp,
            "output_path": output_path
        }
        return context
    
    def populate_temp_file(self, form_data: dict) -> None:
        if form_data["file_regions"]['value'] != '':
            if ".txt" not in form_data["file_regions"]['value']:
                with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
                    file_path = temp_file.name
                    # Write each gene on a new line
                    temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"]['value'].split(","))
                # Update the path in form_data to point to the temp file
                form_data["file_regions"]['value'] = file_path
        else:
            form_data["file_regions"]['value'] = None
    
    def populate_config_file(self, form_data: dict, context: dict) -> None:
        config = {
            "dir_output": context.get("output_path")
        }

        def deep_get(dictionary: dict, keys: list[str]):
            for key in keys:
                dictionary = dictionary.get(key, {})
            return dictionary
        
        def deep_set(dictionary: dict, keys: list[str], value):
            for key in keys[:-1]:
                dictionary = dictionary.setdefault(key, {})
            dictionary[keys[-1]] = value

        def traverse_object(obj: dict, path: list[str]):
            for [key, entry] in obj.get('properties', {}).items():
                read_path = path + [key.lstrip('-')] # Remove leading '-' for YAML keys
                write_path = path + [key]
                match entry["type"]:
                    case 'object':
                        traverse_object(entry, write_path)
                    case 'integer':
                        value = to_int(deep_get(form_data, read_path + ['value']))
                        deep_set(config, write_path, value)
                    case 'number':
                        value = float(deep_get(form_data, read_path + ['value']))
                        deep_set(config, write_path, value)
                    case 'boolean':
                        value = to_bool(deep_get(form_data, read_path + ['value']))
                        deep_set(config, write_path, value)
                    case 'array':
                        if entry["items"]["type"] == 'string':
                            raw_value = deep_get(form_data, read_path + ['value'])
                            value = multiline_to_list(raw_value)
                            deep_set(config, write_path, value)
                        else:
                            # type not supported
                            pass
                    case 'string':
                        value = deep_get(form_data, read_path + ['value'])
                        deep_set(config, write_path, value)
                    case 'null':
                        deep_set(config, write_path, None)
                    case ['integer', 'null']:
                        raw_value = deep_get(form_data, read_path + ['value'])
                        value = to_null(to_int(raw_value))
                        deep_set(config, write_path, value)
                    case _:
                        # type not supported
                        pass
        
        traverse_object(self.schema, [])
                        
        # Write config to YAML file
        print(f"Writing config to {context['config_path']}")
        with open(context["config_path"], "w") as f:
            yaml.dump(config, f, sort_keys=False)

    def call_subprocess(self, config_path: str) -> str:
        result = subprocess.run(
            [self.subprocess_name, "-c", config_path],
            capture_output=True,
            text=True
        )
        return "completed" if result.returncode == 0 else "failed"

    def update_run_in_DB(self, run_id: ObjectId, data: dict):
        return mongo.db.runs.update_one(
            {"_id": run_id},
            {"$set": data}
        )

    def write_run_to_DB(self, runId: ObjectId, context: dict) -> ObjectId:
        return self.update_run_in_DB(runId, {
            "session_id": context.get("session_id"),
            "user_id": context.get("user_id"),
            "timestamp": context.get("timestamp"),
            "output_path": context.get("output_path"),
            "status": "started",
            "pipeline": self.pipeline_name
        })
    
    def cleanup_temp_files(self, form_data: dict) -> None:
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
            if form_data.get(field) is None:
                continue
            files_list = split_on_newline(form_data[field]['value'])
            if '\n' in files_list:
                files_list.remove('\n')
            for fname in files_list:
                if os.path.exists(fname):
                    os.remove(fname)

    def update_run_status_in_DB(self, run_id: ObjectId, status: str):
        return self.update_run_in_DB(run_id, {"status": status})
