"""PipelineRunner unit tests.

The runner is constructed with a lightweight test instance so these tests can
focus on config shaping, subprocess error mapping, visualization handoff, and
cleanup behavior without requiring worker-only schema or Biopython dependencies.
"""

import subprocess
import sys
import types
from unittest.mock import MagicMock, patch

import pytest
import yaml

from backend.exceptions import ODTEmptyResultError, ODTPipelineError

genomic_regions_module = types.ModuleType("backend.worker.genomic_regions_file")
genomic_regions_module.GenomicRegionsFile = MagicMock()
sys.modules.setdefault("backend.worker.genomic_regions_file", genomic_regions_module)


@pytest.fixture
def runner():
    """Build a PipelineRunner-like instance without reading schema files."""
    from backend.worker.pipeline_runner import PipelineRunner

    runner = PipelineRunner.__new__(PipelineRunner)
    runner.logger = MagicMock()
    runner.pipeline_name = "merfish"
    runner.subprocess_name = "merfish_probe_designer"
    runner.schema = {}
    return runner


@pytest.fixture
def form_data():
    """Minimal MERFISH form data with all path-wrapper fields present."""
    return {
        "file_regions": "GeneA,GeneB",
        "files_fasta_target_probe_database": {"files": [], "fasta_form": []},
        "files_fasta_reference_database_target_probe": {"files": [], "fasta_form": []},
        "files_fasta_reference_database_readout_probe": {"files": [], "fasta_form": []},
        "files_fasta_reference_database_primer": {"files": [], "fasta_form": []},
    }


def test_populate_temp_file_writes_gene_list(runner, form_data):
    runner.populate_temp_file(form_data)

    path = form_data["file_regions"]
    with open(path) as handle:
        assert handle.read() == "GeneA\nGeneB\n"


def test_populate_temp_file_converts_empty_to_none(runner, form_data):
    form_data["file_regions"] = ""

    runner.populate_temp_file(form_data)

    assert form_data["file_regions"] is None


def test_populate_temp_file_leaves_existing_txt_path(runner, form_data, tmp_path):
    regions = tmp_path / "regions.txt"
    regions.write_text("GeneA\n")
    form_data["file_regions"] = str(regions)

    runner.populate_temp_file(form_data)

    assert form_data["file_regions"] == str(regions)


def test_write_config_file_creates_output_dir_and_yaml(runner, form_data, tmp_path):
    """Writing config creates the output directory and serializes ODT-ready YAML."""
    output_path = tmp_path / "out"

    config_path = runner.write_config_file(form_data, str(output_path), [])

    assert output_path.is_dir()
    config = yaml.safe_load(open(config_path))
    assert config["dir_output"] == str(output_path)
    assert config["files_fasta_target_probe_database"] == []


def test_write_config_file_converts_kmer_threshold_keys_to_int(runner, form_data, tmp_path):
    form_data["target_probe_kmer_abundance_threshold"] = {"15": 0.5}

    config_path = runner.write_config_file(form_data, str(tmp_path), [])

    config = yaml.safe_load(open(config_path))
    assert config["target_probe_kmer_abundance_threshold"] == {15: 0.5}


def test_populate_form_data_path_fields_replaces_upload_wrappers_with_file_lists(runner, form_data):
    form_data["files_fasta_target_probe_database"]["files"] = ["uploaded.fna"]

    runner.populate_form_data_path_fields(form_data, [])

    assert form_data["files_fasta_target_probe_database"] == ["uploaded.fna"]
    assert form_data["files_fasta_reference_database_target_probe"] == []


def test_populate_form_data_path_fields_adds_generated_region_paths(runner, form_data):
    runner.populate_form_data_path_fields(
        form_data, [("files_fasta_target_probe_database", ["generated.fna"])]
    )

    assert form_data["files_fasta_target_probe_database"] == ["generated.fna"]


def test_call_subprocess_success(runner):
    with patch("backend.worker.pipeline_runner.subprocess.run") as run:
        runner.call_subprocess("/tmp/config.yml")

    run.assert_called_once_with(
        ["merfish_probe_designer", "-c", "/tmp/config.yml"],
        capture_output=True,
        text=True,
        check=True,
    )


def test_call_subprocess_maps_oom_to_user_error(runner):
    """SIGKILL-style subprocess failures are mapped to the memory-specific error."""
    error = subprocess.CalledProcessError(-9, "cmd", output="", stderr="killed")

    with patch("backend.worker.pipeline_runner.subprocess.run", side_effect=error):
        with pytest.raises(ODTPipelineError, match="insufficient memory"):
            runner.call_subprocess("/tmp/config.yml")


def test_call_subprocess_maps_empty_result_to_empty_result_error(runner):
    error = subprocess.CalledProcessError(1, "cmd", output="The oligo database is empty", stderr="")

    with patch("backend.worker.pipeline_runner.subprocess.run", side_effect=error):
        with pytest.raises(ODTEmptyResultError):
            runner.call_subprocess("/tmp/config.yml")


def test_call_subprocess_maps_other_failure_to_pipeline_error(runner):
    error = subprocess.CalledProcessError(1, "cmd", output="bad", stderr="bad")

    with patch("backend.worker.pipeline_runner.subprocess.run", side_effect=error):
        with pytest.raises(ODTPipelineError, match="failed to execute"):
            runner.call_subprocess("/tmp/config.yml")


def test_generate_genomic_regions_file_skips_without_regions_file(runner, form_data, tmp_path):
    form_data["file_regions"] = None

    runner.generate_genomic_regions_file(form_data, str(tmp_path))

    runner.logger.debug.assert_called()


def test_generate_genomic_regions_file_skips_without_fasta_paths(runner, form_data, tmp_path):
    runner.generate_genomic_regions_file(form_data, str(tmp_path))

    runner.logger.debug.assert_called()


def test_generate_genomic_regions_file_writes_visualization_when_probe_yaml_exists(
    runner, form_data, tmp_path
):
    """Visualization generation is delegated when regions, FASTA, and probes exist."""
    regions = tmp_path / "regions.txt"
    regions.write_text("GeneA\n")
    probes = tmp_path / "probes.yml"
    probes.write_text("probes: []\n")
    form_data["file_regions"] = str(regions)
    form_data["files_fasta_target_probe_database"] = ["target.fna"]

    with patch("backend.worker.pipeline_runner.GenomicRegionsFile") as regions_file:
        runner.generate_genomic_regions_file(form_data, str(tmp_path))

    regions_file.assert_called_once_with(
        str(regions), ["target.fna"], str(probes), "merfish", logger=runner.logger
    )
    regions_file.return_value.yaml_dump.assert_called_once_with(str(tmp_path / "genomic_regions.yaml"))


def test_cleanup_temp_files_removes_temp_regions_and_config(runner, tmp_path):
    regions = tmp_path / "regions.txt"
    config = tmp_path / "config.yml"
    regions.write_text("GeneA\n")
    config.write_text("config")
    form_data = {"file_regions": str(regions)}

    runner.cleanup_temp_files(form_data, str(config))

    assert not regions.exists()
    assert not config.exists()


def test_cleanup_temp_files_removes_uploaded_user_data_files_only(runner, tmp_path):
    """Cleanup removes uploaded user-data files but keeps generated/cache files."""
    user_file = tmp_path / "user_data" / "upload.fna"
    keep_file = tmp_path / "cache" / "generated.fna"
    user_file.parent.mkdir()
    keep_file.parent.mkdir()
    user_file.write_text("delete")
    keep_file.write_text("keep")
    form_data = {
        "file_regions": None,
        "files_fasta_target_probe_database": [str(user_file), str(keep_file)],
    }

    runner.cleanup_temp_files(form_data, str(tmp_path / "missing.yml"))

    assert not user_file.exists()
    assert keep_file.exists()
