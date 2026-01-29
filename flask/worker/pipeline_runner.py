from collections import defaultdict
import json
import os
import subprocess
import tempfile
from collections.abc import Mapping
from typing import Any

import yaml
from celery import Celery

from Bio import SeqIO
from oligo_designer_toolsuite.utils import FastaParser


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

    def __init__(self, pipeline_name: str, task: Celery.Task):
        # TODO: pass root_dir config to worker, use config for absolute path
        schema_path = os.path.join(os.path.dirname(__file__), f"../../schemas/{pipeline_name}.schema.json")
        with open(schema_path) as f:
            schema = json.load(f)

        self.pipeline_name = pipeline_name  # e.g., 'merfish'
        self.subprocess_name = self.PIPELINE_SUBPROCESS[pipeline_name]  # e.g., 'merfish_probe_designer'
        self.schema = schema  # JSON schema
        self.task = task

    def run(self, form_data: dict[str, Any], upload_path: str, output_path: str) -> bool:
        # Temp File Creation (if needed)
        self.populate_temp_file(form_data)

        # Build Config and Write to YAML
        config_path = self.write_config_file(form_data, output_path)

        # Subprocess Call
        ok = self.call_subprocess(config_path)

        # Generate Visualization Files
        self.generate_genomic_regions_file(form_data, output_path)

        # Cleanup of Temporary Files
        self.cleanup_temp_files(form_data, config_path)

        # Response
        return ok

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

    def write_config_file(self, form_data: dict, output_path: str) -> str:
        config = form_data

        # Override output directory
        config["dir_output"] = output_path

        # Write config to YAML file
        config_path = os.path.join(output_path, f"config_{self.pipeline_name}.yml")
        print(f"Writing config to {config_path}")

        # Ensure parent directory exists
        config_dir = os.path.dirname(config_path)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
        with open(config_path, "w") as f:
            yaml.dump(config, f, sort_keys=False)
        return config_path

    def call_subprocess(self, config_path: str) -> bool:
        result = subprocess.run([self.subprocess_name, "-c", config_path], capture_output=True, text=True)
        # TODO: replace with logger
        print("STDERR:", result.stderr)
        print("STDOUT (partial logs):", result.stdout)
        return result.returncode == 0

    def generate_genomic_regions_file(self, form_data: dict, output_path: str) -> None:
        # find files_fasta_target_probe_database fasta file and read it
        print("Generating visualization files...")
        regions_file = form_data.get("file_regions", None)
        if not regions_file:
            print("No regions file provided, skipping visualization generation.")
            return
        genes = []
        with open(regions_file) as rf:
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

                if gene not in genes:
                    continue
                transcript_ids = additional_info.get("transcript_id", ["transcript_unknown"])
                for transcript_index, transcript_id in enumerate(transcript_ids):
                    region_type = (
                        additional_info["regiontype"][0] if "regiontype" in additional_info else "unknown"
                    )
                    total_sequence = str(record.seq)
                    starts = coordinates["start"]
                    ends = coordinates["end"]
                    strand = coordinates['strand'][0] if 'strand' in coordinates else '+'
                    if strand == '-':
                        # reverse sequence for negative strand
                        total_sequence = total_sequence[::-1]
                    start_ends = list(zip(starts, ends))
                    start_ends.sort(key=lambda x: x[0])  # sort by start position
                    for i, (start, end) in enumerate(start_ends):
                        # assume start < end
                        sequence, total_sequence = (
                            total_sequence[: end - start + 1],
                            total_sequence[end - start + 1 :],
                        )
                        regions[gene][transcript_id].append(
                            {
                                "regiontype": region_type,
                                "exon_number": additional_info["exon_number"][transcript_index]
                                if "exon_number" in additional_info
                                else None,
                                "sequence": sequence,
                                "start": start,
                                "end": end,
                                "chromosome": coordinates["chromosome"][i],
                                "strand": coordinates["strand"][i],
                            }
                        )

                    if region_type == "exonexonjunction":
                        # add introns between exons
                        for j in range(len(start_ends) - 1):
                            intron_start = start_ends[j][1] + 1
                            intron_end = start_ends[j + 1][0] - 1
                            regions[gene][transcript_id].append(
                                {
                                    "regiontype": "intron",
                                    "exon_number": None,
                                    "sequence": None,
                                    "start": intron_start,
                                    "end": intron_end,
                                    "chromosome": coordinates["chromosome"][0],
                                    "strand": coordinates["strand"][0],
                                }
                            )

        # write regions to a temp file in user_dir
        # convert defaultdict to normal dict for yaml serialization
        regions_dict = {gene: dict(transcripts) for gene, transcripts in regions.items()}
        vis_path = os.path.join(output_path, "genomic_regions.yaml")
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
