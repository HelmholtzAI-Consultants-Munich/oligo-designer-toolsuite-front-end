"""Unit tests for the PipelineRunner.

Currently only oligoseq is tested since it is the only pipeline with Pydantic
integration. The runner fixture is already parametrized — to add a new pipeline,
add its name to PIPELINE_NAMES and extend PIPELINE_FORM_DATA with its minimal
form shape.
"""

import copy
import sys
import types
from collections.abc import Iterator
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import yaml
from oligo_designer_toolsuite._exceptions import OligoDesignerError
from pydantic import BaseModel

from backend.exceptions import ODTEmptyResultError, ODTPipelineError

# PipelineRunner only needs the class interface in these unit tests. Providing
# this lightweight module avoids importing visualization dependencies here.
genomic_regions_module = types.ModuleType("backend.worker.genomic_regions_file")
genomic_regions_module.GenomicRegionsFile = MagicMock()
sys.modules.setdefault("backend.worker.genomic_regions_file", genomic_regions_module)


class PipelineConfigFixture(BaseModel):
    required_value: int


# TODO: add "merfish", "seqfish", "scrinshot" once their Pydantic integration is complete.
PIPELINE_NAMES = ["oligoseq"]

# Minimal form shape per pipeline consumed by PipelineRunner.
# TODO: add an entry per pipeline when extending PIPELINE_NAMES.
PIPELINE_FORM_DATA = {
    "oligoseq": {
        "general": {"dir_output": "old-output"},
        "target_probe": {
            "oligo_generation": {
                "file_region_ids": "GeneA,GeneB",
                "files_fasta_probe_database": [],
            },
            "specificity_filters": {
                "variant_filter": {"files_vcf_reference_database": []},
            },
        },
    }
}


@pytest.fixture(params=PIPELINE_NAMES)
def runner(request):
    """Build a runner for each supported pipeline without reading its schema file from disk."""
    from backend.worker.pipeline_runner import PipelineRunner

    instance = PipelineRunner.__new__(PipelineRunner)
    instance.logger = MagicMock()
    instance.pipeline_name = request.param
    instance.schema = {}
    return instance


@pytest.fixture
def form_data(runner):
    """Return the minimal form shape for the pipeline under test."""
    return copy.deepcopy(PIPELINE_FORM_DATA[runner.pipeline_name])


def oligo_generation(form_data):
    return form_data["target_probe"]["oligo_generation"]


@pytest.fixture
def populated_regions_file(runner, form_data) -> Iterator[Path]:
    """Create a generated regions file and remove it after the test."""
    runner.populate_temp_file(form_data)
    path = Path(oligo_generation(form_data)["file_region_ids"])

    yield path

    path.unlink(missing_ok=True)


def test_populate_temp_file_writes_gene_list(populated_regions_file):
    assert populated_regions_file.read_text() == "GeneA\nGeneB\n"


def test_populate_temp_file_strips_whitespace_around_genes(runner, form_data, tmp_path):
    oligo_generation(form_data)["file_region_ids"] = "GeneA, GeneB,  GeneC "

    runner.populate_temp_file(form_data)
    path = Path(oligo_generation(form_data)["file_region_ids"])

    try:
        assert path.read_text() == "GeneA\nGeneB\nGeneC\n"
    finally:
        path.unlink(missing_ok=True)


def test_populate_temp_file_leaves_none_unchanged(runner, form_data):
    oligo_generation(form_data)["file_region_ids"] = None

    runner.populate_temp_file(form_data)

    assert oligo_generation(form_data)["file_region_ids"] is None


def test_write_config_file_creates_output_dir_and_yaml(runner, form_data, tmp_path):
    output_path = tmp_path / "out"

    config_path = runner.write_config_file(form_data, str(output_path), [])

    assert output_path.is_dir()
    with open(config_path) as handle:
        config = yaml.safe_load(handle)
    assert config["general"]["dir_output"] == str(output_path)


def test_populate_form_data_path_fields_adds_generated_region_paths(runner, form_data):
    field = "target_probe.oligo_generation.files_fasta_probe_database"

    runner.populate_form_data_path_fields(form_data, [(field, ["generated.fna"])])

    assert oligo_generation(form_data)["files_fasta_probe_database"] == ["generated.fna"]


def write_config(tmp_path, data):
    path = tmp_path / "config.yml"
    path.write_text(yaml.safe_dump(data))
    return str(path)


def test_execute_pipeline_validates_config_and_calls_pipeline(runner, tmp_path):
    function = MagicMock()
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=function)

    with patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))

    function.assert_called_once()
    assert function.call_args.args[0].required_value == 1


def test_execute_pipeline_rejects_invalid_configuration(runner, tmp_path):
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock())

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTPipelineError, match="Invalid configuration file"),
    ):
        runner.execute_pipeline(write_config(tmp_path, {}))


def test_execute_pipeline_rejects_unknown_pipeline(runner, tmp_path):
    runner.pipeline_name = "missing"

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {}),
        pytest.raises(NotImplementedError, match="not implemented"),
    ):
        runner.execute_pipeline(write_config(tmp_path, {}))


@pytest.mark.parametrize("error", [ValueError("bad input"), OligoDesignerError("domain error")])
def test_execute_pipeline_maps_known_errors_to_pipeline_error(runner, tmp_path, error):
    """ValueError and OligoDesignerError are caught by the specific except clause."""
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock(side_effect=error))

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTPipelineError),
    ):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))


def test_execute_pipeline_maps_unexpected_exception_to_pipeline_error_and_logs(runner, tmp_path):
    """Unexpected exceptions fall through to the broad except clause, which logs stderr before raising."""
    error = RuntimeError("unexpected")
    error.stderr = "subprocess stderr output"
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock(side_effect=error))

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTPipelineError),
    ):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))

    runner.logger.debug.assert_any_call("STDERR: subprocess stderr output")


def test_execute_pipeline_maps_empty_result(runner, tmp_path):
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock(side_effect=SystemExit(1)))

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTEmptyResultError, match="did not generate any results"),
    ):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))


def test_execute_pipeline_maps_other_system_exit(runner, tmp_path):
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock(side_effect=SystemExit(2)))

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTPipelineError),
    ):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))


def test_generate_genomic_regions_file_skips_without_fasta_paths(runner, form_data, tmp_path):
    runner.generate_genomic_regions_file(form_data, str(tmp_path))

    runner.logger.debug.assert_called_once()


def test_generate_genomic_regions_file_skips_without_probe_yaml(runner, form_data, tmp_path):
    oligo_generation(form_data)["files_fasta_probe_database"] = ["target.fna"]

    runner.generate_genomic_regions_file(form_data, str(tmp_path))

    assert "No output YAML" in runner.logger.debug.call_args.args[0]


def test_generate_genomic_regions_file_writes_visualization_when_probe_yaml_exists(
    runner, form_data, tmp_path
):
    probes = tmp_path / "probes.yml"
    probes.write_text("probes: []\n")
    oligo_generation(form_data)["file_region_ids"] = "regions.txt"
    oligo_generation(form_data)["files_fasta_probe_database"] = ["target.fna"]

    with patch("backend.worker.pipeline_runner.GenomicRegionsFile") as regions_file:
        runner.generate_genomic_regions_file(form_data, str(tmp_path))

    regions_file.assert_called_once_with(
        "regions.txt", ["target.fna"], str(probes), "oligoseq", logger=runner.logger
    )
    regions_file.return_value.yaml_dump.assert_called_once_with(str(tmp_path / "genomic_regions.yaml"))


def test_cleanup_temp_files_removes_temp_regions_config_and_upload(runner, form_data, tmp_path):
    regions = tmp_path / "regions.txt"
    config = tmp_path / "config.yml"
    upload = tmp_path / "upload.vcf"
    regions.write_text("GeneA\n")
    config.write_text("config")
    upload.write_text("variants")
    oligo_generation(form_data)["file_region_ids"] = str(regions)
    form_data["target_probe"]["specificity_filters"]["variant_filter"]["files_vcf_reference_database"] = [
        str(upload)
    ]

    runner.cleanup_temp_files(form_data, str(config))

    assert not regions.exists()
    assert not config.exists()
    assert not upload.exists()


def test_run_cleans_up_when_pipeline_execution_fails(runner, form_data, tmp_path):
    with (
        patch.object(runner, "populate_temp_file"),
        patch.object(runner, "write_config_file", return_value=str(tmp_path / "config.yml")),
        patch.object(runner, "execute_pipeline", side_effect=ODTPipelineError("failed")),
        patch.object(runner, "cleanup_temp_files") as cleanup,
        pytest.raises(ODTPipelineError),
    ):
        runner.run(form_data, str(tmp_path), [])

    cleanup.assert_called_once_with(form_data, str(tmp_path / "config.yml"))
