import json
import os
import subprocess
import tempfile
from collections.abc import Mapping
from logging import Logger
from typing import Any

import yaml

from backend.constants import PIPELINE_FILE_INPUT
from backend.exceptions import ODTEmptyResultError, ODTPipelineError
from backend.utils import deserialize_form_data_path, retrieve_form_data_value
from backend.worker.genomic_regions_file import GenomicRegionsFile


class PipelineRunner:
    """
    Executes the pipeline by invoking the corresponding oligo designer toolsuite tool while managing temporary files.

    - Prepares input files as needed (e.g., writes gene list as a temp file).
    - Builds the configuration dictionary for the probe designer pipeline based on the submitted form.
    - Writes this configuration as a YAML file to the user's directory.
    - Launches the external `[<pipeline_name>]_probe_designer` process as a subprocess, passing the YAML config.
    - Cleans up any temporary files created during input preparation.

    For more information on the input parameters and configuration options, refer to the pipeline documentation.

    """

    PIPELINE_SUBPROCESS: Mapping[str, str] = {
        "scrinshot": "scrinshot_probe_designer",
        "seqfish": "seqfish_plus_probe_designer",
        "merfish": "merfish_probe_designer",
        "oligoseq": "oligo_seq_probe_designer",
    }

    def __init__(self, pipeline_name: str, logger: Logger):
        self.logger = logger

        # TODO: pass root_dir config to worker, use config for absolute path
        #   here and in genomic_region_generator_runner.py
        schema_path = os.path.join(os.path.dirname(__file__), f"../../schemas/{pipeline_name}.schema.json")
        with open(schema_path) as f:
            schema = json.load(f)

        self.pipeline_name = pipeline_name  # e.g., 'merfish'
        self.subprocess_name = self.PIPELINE_SUBPROCESS[pipeline_name]  # e.g., 'merfish_probe_designer'
        self.schema = schema  # JSON schema

    def run(
        self, form_data: dict[str, Any], output_path: str, generated_region_paths: list[tuple[str, list[str]]]
    ) -> None:
        # Temp File Creation (if needed)
        self.populate_temp_file(form_data)

        # Build Config and Write to YAML
        config_path = self.write_config_file(form_data, output_path, generated_region_paths)

        try:
            # Subprocess Call
            self.call_subprocess(config_path)

            # Generate Visualization Files
            self.generate_genomic_regions_file(form_data, output_path)
        finally:
            # Cleanup of Temporary Files
            self.cleanup_temp_files(form_data, config_path)

    def populate_temp_file(self, form_data: dict) -> None:
        oligo_generation_form = retrieve_form_data_value(["target_probe", "oligo_generation"], form_data)
        file_region_ids = oligo_generation_form["file_region_ids"]
        if file_region_ids != "":
            if ".txt" not in file_region_ids:
                with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
                    file_path = temp_file.name
                    # Write each gene on a new line
                    temp_file.writelines(gene.strip() + "\n" for gene in file_region_ids.split(","))
                # Update the path in form_data to point to the temp file
                oligo_generation_form["file_region_ids"] = file_path
        else:
            oligo_generation_form["file_region_ids"] = None

    def populate_form_data_path_fields(
        self, config: dict, generated_region_paths: list[tuple[str, list[str]]]
    ) -> None:
        """
        This method converts the form_data sent by the frontend to the format used by ODT.
        It is necessary because the Oligo Designer Toolsuite expects a list of file paths per `files_[...]` field like:
        ```py
        {"files_field": ["input_file.fna"]}
        ```
        Since we forbid passing file paths directly and we allow creation of custom genomic regions via the region generator, the form_data has the following scheme:
        ```py
        {"files_field": {
            "files": [FileStorageObject],
            "fasta_form": [FastaFormObject]
        }}
        ```
        The files listed under `"files":` are saved to disk and the resulting paths are injected into the form data.
        The forms listed under `"fasta_form":` are processed by the genomic_region_generator which results in a list of tuples like:
        ```py
        [("files_field", ["generated_genomic_regions_file_path"])]
        ```
        These paths also get injected into the form data here.

        Arguments:
            config {dict} -- Form Data of request
            generated_region_paths {list[tuple[str, list[str]]]} -- list of tuples of input_field_id and belonging paths of generated genomic regions
        """

        # Add paths of generated regions to config
        for id, paths in generated_region_paths:
            genomic_input_field_path = deserialize_form_data_path(id)
            genomic_input_field_parent = retrieve_form_data_value(genomic_input_field_path[:-1], config)
            genomic_input_field_parent[genomic_input_field_path[-1]] = paths

    def write_config_file(
        self, form_data: dict, output_path: str, generated_region_paths: list[tuple[str, list[str]]]
    ) -> str:
        config = form_data

        # Override output directory
        config["general"]["dir_output"] = output_path

        self.populate_form_data_path_fields(config, generated_region_paths)

        # Write config to YAML file
        config_path = os.path.join(output_path, f"config_{self.pipeline_name}.yml")
        self.logger.info(f"Writing config to {config_path}")

        # Ensure parent directory exists
        config_dir = os.path.dirname(config_path)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
        with open(config_path, "w") as f:
            yaml.dump(config, f, sort_keys=False)
        return config_path

    def call_subprocess(self, config_path: str) -> None:
        # NOTE: This might require locking input files once we add automatic cleanup for generated regions
        try:
            subprocess.run(
                [self.subprocess_name, "-c", config_path], capture_output=True, text=True, check=True
            )
        except subprocess.CalledProcessError as error:
            if error.stderr:
                self.logger.error(f"STDERR: {error.stderr}")
            self.logger.debug(f"STDOUT: {error.stdout}")
            if (
                error.returncode == -9
            ):  # SIGKILL, likely due to OOM (this is Unix-specific and will not work on Windows)
                raise ODTPipelineError(
                    "The pipeline was terminated unexpectedly, likely due to insufficient memory. Please try again with smaller input or contact us for assistance."
                )
            if "The oligo database is empty" in error.stdout:
                raise ODTEmptyResultError(
                    "The pipeline did not generate any results. Please tweak your input parameters."
                )
            raise ODTPipelineError(
                "The pipeline failed to execute. Please check your input and try again. If the error persists, please inform us of the issue."
            )

    def generate_genomic_regions_file(self, form_data: dict, output_path: str) -> None:
        # find files_fasta_target_probe_database fasta file and read it
        regions_file = retrieve_form_data_value(
            ["target_probe", "oligo_generation", "file_region_ids"], form_data
        )
        if not regions_file:
            self.logger.debug("No regions file provided, skipping visualization generation.")
            return

        fasta_paths = retrieve_form_data_value(
            [
                "target_probe",
                "oligo_generation",
                "files_fasta_probe_database",
            ],
            form_data,
        )
        if not fasta_paths:
            self.logger.debug("No fasta files provided, skipping visualization generation.")
            return

        # find output file name containing "probes" or "probeset"
        output_yaml = next(
            (
                fname
                for fname in os.listdir(output_path)
                if ("probes" in fname or "probeset" in fname)
                and "order" not in fname
                and (fname.endswith(".yml") or fname.endswith(".yaml"))
            ),
            None,
        )
        if not output_yaml:
            self.logger.debug(
                "No output YAML file containing 'probes' or 'probeset' found, skipping visualization generation."
            )
            return
        probes_path = os.path.join(output_path, output_yaml)

        regions_file = GenomicRegionsFile(
            regions_file, fasta_paths, probes_path, self.pipeline_name, logger=self.logger
        )
        regions_file_path = os.path.join(output_path, "genomic_regions.yaml")
        regions_file.yaml_dump(regions_file_path)

    def cleanup_temp_files(self, form_data: dict, config_path: str) -> None:
        oligo_generation_form = retrieve_form_data_value(["target_probe", "oligo_generation"], form_data)
        # Remove temp file for file_regions if it was created
        if oligo_generation_form["file_region_ids"]:
            temp_path = oligo_generation_form["file_region_ids"].strip()
            if os.path.exists(temp_path):
                os.remove(temp_path)
                self.logger.debug(f"Deleted temp file_region_ids: {temp_path}")
            else:
                self.logger.debug(f"Temp files cleanup skipped, file_region_ids path not found: {temp_path}")
        for path in PIPELINE_FILE_INPUT[self.pipeline_name]:
            files_list = retrieve_form_data_value(path, form_data)
            if files_list is None or len(files_list) < 1:
                continue
            for fname in files_list:
                # Delete user-uploaded files, but not generated regions so they can be cached
                # TODO: make the distinction logic more robust
                if os.path.exists(fname):
                    os.remove(fname)

        if os.path.exists(config_path):
            os.remove(config_path)
            self.logger.debug(f"Deleted config: {config_path}")
        else:
            self.logger.debug(f"Config cleanup skipped, config file not found: {config_path}")
