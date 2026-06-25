"""Unit tests for PipelineRunner that must be isolated from the scheduler and task infrastructure.

The module-level sys.modules injection below replaces genomic_regions_file so tests can
import pipeline_runner without pulling in Biopython and visualization dependencies that are
not installed in CI. Currently only oligoseq is tested since it is the only pipeline with
Pydantic integration. The runner fixture is already parametrized — to add a new pipeline,
add its name to PIPELINE_NAMES and extend PIPELINE_FORM_DATA with its minimal form shape.
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
    """Build a PipelineRunner instance for each supported pipeline without reading its schema file from disk.

    Arguments:
        request {SubRequest} -- pytest sub-request carrying the current pipeline name parameter

    Returns:
        PipelineRunner -- partially initialised runner with a mock logger and empty schema
    """
    from backend.worker.pipeline_runner import PipelineRunner

    instance = PipelineRunner.__new__(PipelineRunner)
    instance.logger = MagicMock()
    instance.pipeline_name = request.param
    instance.schema = {}
    return instance


@pytest.fixture
def form_data(runner):
    """Provide a deep copy of the minimal form shape so mutations in one test do not bleed into parametrized siblings.

    Arguments:
        runner {PipelineRunner} -- runner fixture that identifies the pipeline under test

    Returns:
        dict -- fresh copy of PIPELINE_FORM_DATA for the current pipeline
    """
    return copy.deepcopy(PIPELINE_FORM_DATA[runner.pipeline_name])


def oligo_generation(form_data):
    """Return the nested oligo_generation section so assertions stay readable without repeating the full path.

    Arguments:
        form_data {dict} -- pipeline form data dict

    Returns:
        dict -- the oligo_generation sub-dict from target_probe
    """
    return form_data["target_probe"]["oligo_generation"]


@pytest.fixture
def populated_regions_file(runner, form_data) -> Iterator[Path]:
    """Write a temporary gene list file and clean it up after the test so callers can assert on content without managing file lifecycle.

    Arguments:
        runner {PipelineRunner} -- runner whose populate_temp_file method is under test
        form_data {dict} -- form data dict that receives the generated file path

    Yields:
        Path -- path to the written gene list file
    """
    runner.populate_temp_file(form_data)
    path = Path(oligo_generation(form_data)["file_region_ids"])

    yield path

    path.unlink(missing_ok=True)


def test_populate_temp_file_writes_gene_list(populated_regions_file):
    """Gene IDs must be written one per line so the pipeline tool can read them sequentially without custom parsing.

    Args:
        populated_regions_file (Path): path to the written gene list file
    """
    assert populated_regions_file.read_text() == "GeneA\nGeneB\n"


def test_populate_temp_file_strips_whitespace_around_genes(runner, form_data, tmp_path):
    """Extra spaces in user-entered gene lists must be stripped so downstream tools do not fail on padded identifiers.

    Args:
        runner (PipelineRunner): runner whose populate_temp_file method is under test
        form_data (dict): form data dict that will receive the generated file path
        tmp_path (Path): pytest-provided temp directory
    """
    oligo_generation(form_data)["file_region_ids"] = "GeneA, GeneB,  GeneC "

    runner.populate_temp_file(form_data)
    path = Path(oligo_generation(form_data)["file_region_ids"])

    try:
        assert path.read_text() == "GeneA\nGeneB\nGeneC\n"
    finally:
        path.unlink(missing_ok=True)


def test_populate_temp_file_leaves_none_unchanged(runner, form_data):
    """Optional gene-list fields left empty by the user must pass through as None so downstream config serialization can omit them.

    Args:
        runner (PipelineRunner): runner whose populate_temp_file method is under test
        form_data (dict): form data dict with file_region_ids set to None
    """
    oligo_generation(form_data)["file_region_ids"] = None

    runner.populate_temp_file(form_data)

    assert oligo_generation(form_data)["file_region_ids"] is None


def test_write_config_file_creates_output_dir_and_yaml(runner, form_data, tmp_path):
    """The output directory must be created by the runner and dir_output must be set in the YAML so the pipeline tool writes results to the correct location.

    Args:
        runner (PipelineRunner): runner whose write_config_file method is under test
        form_data (dict): form data dict providing initial config values
        tmp_path (Path): pytest-provided temp directory used as the target output path
    """
    output_path = tmp_path / "out"

    config_path = runner.write_config_file(form_data, str(output_path), [])

    assert output_path.is_dir()
    with open(config_path) as handle:
        config = yaml.safe_load(handle)
    assert config["general"]["dir_output"] == str(output_path)


def test_populate_form_data_path_fields_adds_generated_region_paths(runner, form_data):
    """Generated FASTA paths from header tasks must be injected into form data before config serialization so the pipeline task receives the correct input files.

    Args:
        runner (PipelineRunner): runner whose populate_form_data_path_fields method is under test
        form_data (dict): form data dict whose file list field will receive the generated paths
    """
    field = "target_probe.oligo_generation.files_fasta_probe_database"

    runner.populate_form_data_path_fields(form_data, [(field, ["generated.fna"])])

    assert oligo_generation(form_data)["files_fasta_probe_database"] == ["generated.fna"]


def write_config(tmp_path, data):
    """Write a minimal YAML config file so execute_pipeline tests can exercise parsing and validation without a real pipeline config.

    Arguments:
        tmp_path {Path} -- directory in which to create the config file
        data {dict} -- YAML-serializable config content

    Returns:
        str -- absolute path to the written config file
    """
    path = tmp_path / "config.yml"
    path.write_text(yaml.safe_dump(data))
    return str(path)


def test_execute_pipeline_validates_config_and_calls_pipeline(runner, tmp_path):
    """Pydantic validation must run before the pipeline function is called so misconfigured runs are caught before expensive computation starts.

    Args:
        runner (PipelineRunner): runner whose execute_pipeline method is under test
        tmp_path (Path): pytest-provided temp directory for the config file
    """
    function = MagicMock()
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=function)

    with patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))

    function.assert_called_once()
    assert function.call_args.args[0].required_value == 1


def test_execute_pipeline_rejects_invalid_configuration(runner, tmp_path):
    """A config missing required fields must raise ODTPipelineError so the task can set the run status to failed with a readable message.

    Args:
        runner (PipelineRunner): runner whose execute_pipeline method is under test
        tmp_path (Path): pytest-provided temp directory for the config file
    """
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock())

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTPipelineError, match="Invalid configuration file"),
    ):
        runner.execute_pipeline(write_config(tmp_path, {}))


def test_execute_pipeline_rejects_unknown_pipeline(runner, tmp_path):
    """An unregistered pipeline name must raise NotImplementedError rather than silently proceeding with no-op behavior.

    Args:
        runner (PipelineRunner): runner with pipeline_name set to an unregistered value
        tmp_path (Path): pytest-provided temp directory for the config file
    """
    runner.pipeline_name = "missing"

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {}),
        pytest.raises(NotImplementedError, match="not implemented"),
    ):
        runner.execute_pipeline(write_config(tmp_path, {}))


@pytest.mark.parametrize("error", [ValueError("bad input"), OligoDesignerError("domain error")])
def test_execute_pipeline_maps_known_errors_to_pipeline_error(runner, tmp_path, error):
    """Domain and validation errors from the pipeline library must be wrapped in ODTPipelineError so the task handler has a single exception type to catch.

    Args:
        runner (PipelineRunner): runner whose execute_pipeline method is under test
        tmp_path (Path): pytest-provided temp directory for the config file
        error (Exception): one of the parametrized known error types
    """
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock(side_effect=error))

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTPipelineError),
    ):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))


def test_execute_pipeline_maps_unexpected_exception_to_pipeline_error_and_logs(runner, tmp_path):
    """Unexpected errors must be logged with their subprocess stderr before being wrapped so ops can diagnose failures from tool output.

    Args:
        runner (PipelineRunner): runner whose execute_pipeline method is under test
        tmp_path (Path): pytest-provided temp directory for the config file
    """
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
    """Some pipeline tools call sys.exit(1) when they produce no results; this must map to ODTEmptyResultError so the UI shows a distinct "no results" state instead of a generic failure.

    Args:
        runner (PipelineRunner): runner whose execute_pipeline method is under test
        tmp_path (Path): pytest-provided temp directory for the config file
    """
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock(side_effect=SystemExit(1)))

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTEmptyResultError, match="did not generate any results"),
    ):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))


def test_execute_pipeline_maps_other_system_exit(runner, tmp_path):
    """Non-zero exit codes other than 1 indicate abnormal process termination and must raise ODTPipelineError rather than the "no results" variant.

    Args:
        runner (PipelineRunner): runner whose execute_pipeline method is under test
        tmp_path (Path): pytest-provided temp directory for the config file
    """
    pipeline = SimpleNamespace(model=PipelineConfigFixture, function=MagicMock(side_effect=SystemExit(2)))

    with (
        patch("backend.worker.pipeline_runner.PIPELINE_MODELS", {"oligoseq": pipeline}),
        pytest.raises(ODTPipelineError),
    ):
        runner.execute_pipeline(write_config(tmp_path, {"required_value": 1}))


def test_generate_genomic_regions_file_skips_without_fasta_paths(runner, form_data, tmp_path):
    """FASTA probe databases are optional; silently skipping avoids a hard failure for pipeline configurations that do not require sequence-level visualization.

    Args:
        runner (PipelineRunner): runner whose generate_genomic_regions_file method is under test
        form_data (dict): form data dict with an empty FASTA list
        tmp_path (Path): output directory path passed to the method
    """
    runner.generate_genomic_regions_file(form_data, str(tmp_path))

    runner.logger.debug.assert_called_once()


def test_generate_genomic_regions_file_skips_without_probe_yaml(runner, form_data, tmp_path):
    """When no probe YAML output exists the visualization step must be skipped and logged so callers can tell the skip was intentional rather than a silent failure.

    Args:
        runner (PipelineRunner): runner whose generate_genomic_regions_file method is under test
        form_data (dict): form data dict with a FASTA path but no corresponding probe YAML in tmp_path
        tmp_path (Path): output directory that contains no probe YAML file
    """
    oligo_generation(form_data)["files_fasta_probe_database"] = ["target.fna"]

    runner.generate_genomic_regions_file(form_data, str(tmp_path))

    assert "No output YAML" in runner.logger.debug.call_args.args[0]


def test_generate_genomic_regions_file_writes_visualization_when_probe_yaml_exists(
    runner, form_data, tmp_path
):
    """GenomicRegionsFile must be called with the exact right arguments so visualization output lands in the run's output directory and references the correct input files.

    Args:
        runner (PipelineRunner): runner whose generate_genomic_regions_file method is under test
        form_data (dict): form data dict with FASTA and region ID fields populated
        tmp_path (Path): output directory containing a pre-existing probe YAML file
    """
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
    """Temporary files must be deleted after the pipeline completes so they do not consume disk space across runs or interfere with future jobs.

    Args:
        runner (PipelineRunner): runner whose cleanup_temp_files method is under test
        form_data (dict): form data dict whose file paths point to files in tmp_path
        tmp_path (Path): pytest-provided temp directory containing the files to clean up
    """
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
    """Cleanup must run even when execution raises so failed runs do not leave orphaned temp files that could interfere with future runs.

    Args:
        runner (PipelineRunner): runner whose run method is under test
        form_data (dict): form data dict passed through to the mocked pipeline steps
        tmp_path (Path): pytest-provided temp directory used as the output path
    """
    with (
        patch.object(runner, "populate_temp_file"),
        patch.object(runner, "write_config_file", return_value=str(tmp_path / "config.yml")),
        patch.object(runner, "execute_pipeline", side_effect=ODTPipelineError("failed")),
        patch.object(runner, "cleanup_temp_files") as cleanup,
        pytest.raises(ODTPipelineError),
    ):
        runner.run(form_data, str(tmp_path), [])

    cleanup.assert_called_once_with(form_data, str(tmp_path / "config.yml"))
