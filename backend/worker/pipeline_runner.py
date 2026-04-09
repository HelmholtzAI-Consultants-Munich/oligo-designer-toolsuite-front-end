import json
import os
import subprocess
import tempfile
import threading
import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

import psutil
import yaml
from celery import Celery
from celery.utils.log import get_task_logger

from backend.worker.genomic_regions_file import GenomicRegionsFile

DEFAULT_SAMPLE_INTERVAL = 0.5  # seconds
MAX_SAMPLES = 3_600  # ~30 min at 0.5s; older samples roll off after this


@dataclass
class PipelineMetrics:
    runtime_seconds: float = 0.0
    peak_memory_mb: float = 0.0
    memory_samples: list[list[float]] = field(default_factory=list)  # [[elapsed_s, rss_mb], ...]
    cpu_samples: list[list[float]] = field(default_factory=list)  # [[elapsed_s, cpu_pct], ...]
    total_read_mb: float = 0.0
    total_write_mb: float = 0.0

    def to_dict(self) -> dict:
        return {
            "runtime_seconds": self.runtime_seconds,
            "peak_memory_mb": self.peak_memory_mb,
            "memory_samples": self.memory_samples,
            "cpu_samples": self.cpu_samples,
            "total_read_mb": self.total_read_mb,
            "total_write_mb": self.total_write_mb,
        }


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
        # Create logger using task name (Celery tasks have a 'name' attribute)
        self.logger = get_task_logger(getattr(task, "name", __name__))

    def run(
        self, form_data: dict[str, Any], upload_path: str, output_path: str
    ) -> tuple[bool, PipelineMetrics]:
        # Temp File Creation (if needed)
        self.populate_temp_file(form_data)

        # Build Config and Write to YAML
        config_path = self.write_config_file(form_data, output_path)

        # Subprocess Call with metrics collection
        ok, metrics = self.call_subprocess_with_metrics(config_path)

        # Generate Visualization Files
        self.generate_genomic_regions_file(form_data, output_path)

        # Cleanup of Temporary Files
        self.cleanup_temp_files(form_data, config_path)

        # Response
        return ok, metrics

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
        self.logger.info(f"Writing config to {config_path}")

        # Ensure parent directory exists
        config_dir = os.path.dirname(config_path)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
        with open(config_path, "w") as f:
            yaml.dump(config, f, sort_keys=False)
        return config_path

    @staticmethod
    def _sample_metrics(
        pid: int, stop_event: threading.Event, metrics: PipelineMetrics, start_time: float
    ) -> None:
        try:
            proc = psutil.Process(pid)
        except psutil.NoSuchProcess:
            return

        proc.cpu_percent(interval=None)  # prime the CPU counter; first value is always 0.0

        while not stop_event.is_set():
            try:
                children = proc.children(recursive=True)

                # Memory (RSS including children)
                rss_bytes = proc.memory_info().rss
                for child in children:
                    try:
                        rss_bytes += child.memory_info().rss
                    except psutil.NoSuchProcess:
                        pass
                rss_mb = rss_bytes / (1024 * 1024)

                # CPU (process + children)
                cpu_pct = proc.cpu_percent(interval=None)
                for child in children:
                    try:
                        cpu_pct += child.cpu_percent(interval=None)
                    except psutil.NoSuchProcess:
                        pass

                elapsed = round(time.monotonic() - start_time, 2)

                # Memory samples (rolling window)
                if len(metrics.memory_samples) >= MAX_SAMPLES:
                    metrics.memory_samples.pop(0)
                metrics.memory_samples.append([elapsed, round(rss_mb, 2)])
                if rss_mb > metrics.peak_memory_mb:
                    metrics.peak_memory_mb = round(rss_mb, 2)

                # CPU samples (rolling window)
                if len(metrics.cpu_samples) >= MAX_SAMPLES:
                    metrics.cpu_samples.pop(0)
                metrics.cpu_samples.append([elapsed, round(cpu_pct, 1)])

                # Disk I/O — update cumulative totals
                try:
                    io = proc.io_counters()
                    read_mb = io.read_bytes / (1024 * 1024)
                    write_mb = io.write_bytes / (1024 * 1024)
                    for child in children:
                        try:
                            child_io = child.io_counters()
                            read_mb += child_io.read_bytes / (1024 * 1024)
                            write_mb += child_io.write_bytes / (1024 * 1024)
                        except (psutil.NoSuchProcess, psutil.AccessDenied, AttributeError):
                            pass
                    metrics.total_read_mb = round(read_mb, 2)
                    metrics.total_write_mb = round(write_mb, 2)
                except (psutil.AccessDenied, AttributeError):
                    pass  # io_counters not available on all platforms

            except (psutil.NoSuchProcess, psutil.AccessDenied):
                break

            stop_event.wait(DEFAULT_SAMPLE_INTERVAL)

    def call_subprocess_with_metrics(self, config_path: str) -> tuple[bool, PipelineMetrics]:
        metrics = PipelineMetrics()
        stop_event = threading.Event()
        start_time = time.monotonic()
        try:
            proc = subprocess.Popen(
                [self.subprocess_name, "-c", config_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except FileNotFoundError:
            return False, metrics
        sampler = threading.Thread(
            target=self._sample_metrics,
            args=(proc.pid, stop_event, metrics, start_time),
            daemon=True,
        )
        sampler.start()
        try:
            stdout_raw, stderr_raw = proc.communicate()
        finally:
            stop_event.set()
            sampler.join(timeout=5.0)
        metrics.runtime_seconds = round(time.monotonic() - start_time, 3)
        self.logger.debug(f"STDERR: {stderr_raw}")
        self.logger.debug(f"STDOUT (partial logs): {stdout_raw[:500]}")
        return proc.returncode == 0, metrics

    def generate_genomic_regions_file(self, form_data: dict, output_path: str) -> None:
        # find files_fasta_target_probe_database fasta file and read it
        self.logger.info("Generating visualization files...")
        regions_file = form_data.get("file_regions", None)
        if not regions_file:
            self.logger.warning("No regions file provided, skipping visualization generation.")
            return

        fasta_paths = form_data.get("files_fasta_target_probe_database", [])
        if not fasta_paths:
            self.logger.warning("No fasta files provided, skipping visualization generation.")
            return

        # find output file name containing "probes" or "probeset"
        output_yaml = next(
            (
                fname
                for fname in os.listdir(output_path)
                if ("probes" in fname or "probeset" in fname)
                and (fname.endswith(".yml") or fname.endswith(".yaml"))
            ),
            None,
        )
        if not output_yaml:
            print(
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
        # Remove temp file for file_regions if it was created
        if form_data["file_regions"]:
            temp_path = form_data["file_regions"].strip()
            if os.path.exists(temp_path):
                os.remove(temp_path)
                self.logger.debug(f"deleted temp file_regions: {temp_path}")
            else:
                self.logger.debug(f"file_regions not found, skipped: {temp_path}")

        # Remove temp files for fasta inputs
        fasta_fields = [
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
            "files_fasta_reference_database_readout_probe",
            "files_fasta_reference_database_primer",
        ]
        for fasta_field in fasta_fields:
            if fasta_field not in form_data:
                continue
            files_list = form_data[fasta_field]
            for fname in files_list:
                if os.path.exists(fname):
                    os.remove(fname)

        if os.path.exists(config_path):
            os.remove(config_path)
            self.logger.debug(f"deleted config: {config_path}")
        else:
            self.logger.debug(f"config not found, skipped: {config_path}")
