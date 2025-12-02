from collections import defaultdict
import json
import shutil
import subprocess
import tempfile
from typing import Any

from celery import Celery
from helpers import split_commas_and_newlines, split_on_newline, to_bool, to_int, to_null
import os
import yaml

from Bio import SeqIO
from oligo_designer_toolsuite.utils import FastaParser

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

    PIPELINE_SUBPROCESS: dict[str, str] = {
        "scrinshot": "scrinshot_probe_designer",
        "seqfish": "seqfish_plus_probe_designer",
        "merfish": "merfish_probe_designer",
        "oligoseq": "oligo_seq_probe_designer",
    }

    def __init__(self, pipeline_name: str, task: Celery.Task):
        schema_path = os.path.join(
            os.path.dirname(__file__), f"schemas/{pipeline_name}.schema.json"
        )
        with open(schema_path, "r") as f:
            schema = json.load(f)

        self.pipeline_name = pipeline_name  # e.g., 'merfish'
        self.subprocess_name = self.PIPELINE_SUBPROCESS[
            pipeline_name
        ]  # e.g., 'merfish_probe_designer'
        self.schema = schema  # JSON schema
        self.task = task

    def run(self, form_data: dict[str, Any], upload_path: str, uploaded_files: bytes | None) -> bytes | None:
        # Temp File Creation (if needed)
        self.populate_temp_file(form_data)

        # Extract uploaded files (if needed)
        self.extract_uploaded_files(upload_path, uploaded_files)

        # Prepare output directory
        # TODO: in separate function
        output_path = os.path.join(tempfile.gettempdir(), "output")
        os.makedirs(output_path, exist_ok=True)

        # Build Config and Write to YAML
        config_path = self.write_config_file(form_data, output_path)

        # Subprocess Call
        try:
            self.call_subprocess(config_path)
        except Exception:
            self.task.update_state(state="FAILURE")

        # Generate Visualization Files
        self.generate_genomic_regions_file(form_data, output_path)

        # Cleanup of Temporary Files
        self.cleanup_temp_files(form_data, config_path)

        # Serialize output
        archive = self.serialize_output_directory(output_path)

        # Delete temporary directory
        if os.path.exists(output_path):
            shutil.rmtree(output_path)

        # Response
        return archive

    def populate_temp_file(self, form_data: dict) -> None:
        if form_data["file_regions"]["value"] != "":
            if ".txt" not in form_data["file_regions"]["value"]:
                with tempfile.NamedTemporaryFile(
                    mode="w", delete=False, suffix=".txt"
                ) as temp_file:
                    file_path = temp_file.name
                    # Write each gene on a new line
                    temp_file.writelines(
                        gene.strip() + "\n"
                        for gene in form_data["file_regions"]["value"].split(",")
                    )
                # Update the path in form_data to point to the temp file
                form_data["file_regions"]["value"] = file_path
        else:
            form_data["file_regions"]["value"] = None

    def extract_uploaded_files(self, upload_path: str, uploaded_files: bytes | None):
        if uploaded_files:
            # General upload directory
            os.makedirs(upload_path, exist_ok=True)

            archive_path = os.path.join(tempfile.gettempdir(), "upload-archive.zip")
            print(f"Writing archive to {archive_path}")
            with open(archive_path, "xb") as f:
                f.write(uploaded_files)
            
            print(f"Unpacking archive at {archive_path}")
            shutil.unpack_archive(archive_path, extract_dir=upload_path)
            os.remove(archive_path)

    def write_config_file(self, form_data: dict, output_path: str) -> str:
        config = form_data

        # Override output directory
        config["dir_output"] = output_path

        config_path = os.path.join(output_path, f"config_{self.pipeline_name}.yaml")

        # Write config to YAML file
        print(f"Writing config to {config_path}")

        # Ensure parent directory exists
        config_dir = os.path.dirname(config_path)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
        with open(config_path, "w") as f:
            yaml.dump(config, f, sort_keys=False)
        return config_path

    def call_subprocess(self, config_path: str):
        result = subprocess.run(
            [self.subprocess_name, "-c", config_path], capture_output=True, text=True
        )
        print("STDERR:", result.stderr)
        print("STDOUT (partial logs):", result.stdout)
        if result.returncode != 0:
            raise Exception("Pipeline execution was unsuccessful")

    def generate_genomic_regions_file(self, form_data: dict, output_path: str) -> None:
        # find files_fasta_target_probe_database fasta file and read it
        print("Generating visualization files...")
        regions_file = form_data.get("file_regions", None)
        if not regions_file:
            print("No regions file provided, skipping visualization generation.")
            return
        genes = []
        with open(regions_file, "r") as rf:
            genes = [line.strip() for line in rf]
        fasta_paths = form_data.get("files_fasta_target_probe_database", [])
        if not fasta_paths:
            print("No fasta files provided, skipping visualization generation.")
            return
        
        regions = {gene: defaultdict(list) for gene in genes}

        fasta_parser = FastaParser()
        for fname in fasta_paths:
            if not os.path.exists(fname):
                print(f"Fasta file {fname} not found, skipping.")
                continue
            seq_record = SeqIO.index(fname, "fasta")
            for idx in seq_record:
                region_name, additional_info, coordinates = fasta_parser.parse_fasta_header(idx)
                gene = region_name.lstrip(">")
                record = seq_record[idx]

                if not gene in genes:
                    continue
                transcript_ids = additional_info.get('transcript_id', ['transcript_unknown'])
                for transcript_index, transcript_id in enumerate(transcript_ids):
                    region_type = additional_info['regiontype'][0] if 'regiontype' in additional_info else 'unknown'
                    total_sequence = str(record.seq)
                    starts = coordinates['start']
                    ends = coordinates['end']
                    start_ends = list(zip(starts, ends))
                    start_ends.sort(key=lambda x: x[0]) # sort by start position
                    for i, (start, end) in enumerate(start_ends):
                        # assume start < end
                        sequence, total_sequence = total_sequence[: end - start + 1], total_sequence[end - start + 1 :]
                        regions[gene][transcript_id].append({
                            "regiontype": region_type,
                            "exon_number": additional_info['exon_number'][transcript_index] if 'exon_number' in additional_info else None,
                            "sequence": sequence,
                            "start": start,
                            "end": end,
                            "chromosome": coordinates['chromosome'][i],
                            "strand": coordinates['strand'][i],
                        })

                    if region_type == 'exonexonjunction':
                        # add introns between exons
                        for j in range(len(start_ends) - 1):
                            intron_start = start_ends[j][1] + 1
                            intron_end = start_ends[j + 1][0] - 1
                            regions[gene][transcript_id].append({
                                "regiontype": "intron",
                                "exon_number": None,
                                "sequence": None,
                                "start": intron_start,
                                "end": intron_end,
                                "chromosome": coordinates['chromosome'][0],
                                "strand": coordinates['strand'][0],
                            })
        
        # write regions to a temp file in user_dir
        # convert defaultdict to normal dict for yaml serialization
        regions_dict = {gene: dict(transcripts) for gene, transcripts in regions.items()}
        vis_path = os.path.join(output_path, f"genomic_regions.yaml")
        with open(vis_path, "w") as vis_file:
            yaml.dump(regions_dict, vis_file)

    def cleanup_temp_files(self, form_data: dict, config_path: str) -> None:
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
        
        if os.path.exists(config_path):
            os.remove(config_path)
            print("deleted config:", config_path)
        else:
            print("config not found, skipped:", config_path)

    def serialize_output_directory(self, output_path: str) -> bytes | None:
        if not os.path.exists(output_path) or len(os.listdir(output_path)) == 0:
            return None

        archive_base_path = os.path.join(tempfile.gettempdir(), "output-archive")
        archive_path = shutil.make_archive(
            archive_base_path, "zip", root_dir=output_path
        )

        with open(archive_path, "br") as f:
            archive = f.read()
        
        return archive
