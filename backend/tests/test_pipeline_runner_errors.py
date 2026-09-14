"""
Tests for how PipelineRunner turns Oligo Designer Toolsuite errors into run failures.

These pin which except clause wins, and that the toolsuite's own words reach the user.
"""

import logging
from unittest.mock import MagicMock

import pytest
from oligo_designer_toolsuite._exceptions import FileFormatError, OligoDesignerError

from backend.constants import PIPELINE_MODELS
from backend.exceptions import ODTEmptyResultError, ODTPipelineError
from backend.worker.pipeline_runner import PipelineRunner


class EmptyResultError(OligoDesignerError, SystemExit):
    """Stands in for the toolsuite's EmptyResultError, which the pinned release lacks."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.code = 1


@pytest.fixture
def runner(monkeypatch):
    """A PipelineRunner that doesn't need the pipeline's JSON schema on disk."""
    monkeypatch.setattr(PipelineRunner, "__init__", lambda self, name, logger: None)
    runner = PipelineRunner("oligoseq", logger=logging.getLogger("test"))
    runner.pipeline_name = "oligoseq"
    runner.logger = logging.getLogger("test")
    return runner


@pytest.fixture
def failing_pipeline(monkeypatch, tmp_path):
    """Points execute_pipeline at a pipeline that raises the given error, or runs the given function."""

    def run_with(error):
        config_path = tmp_path / "config_oligoseq.yml"
        config_path.write_text("general: {}\n")

        pipeline = MagicMock()
        pipeline.model.model_validate.return_value = object()
        pipeline.function.side_effect = error
        monkeypatch.setitem(PIPELINE_MODELS, "oligoseq", pipeline)
        return str(config_path)

    return run_with


def test_toolsuite_message_reaches_the_user(runner, failing_pipeline):
    """The toolsuite's own reason is shown, with the server path reduced to a file name."""
    config_path = failing_pipeline(
        FileFormatError("FASTA file '/srv/userdata/u12/genes.fna' does not exist.")
    )

    with pytest.raises(ODTPipelineError) as raised:
        runner.execute_pipeline(config_path)

    assert str(raised.value) == "FASTA file 'genes.fna' does not exist."


def test_warnings_logged_before_the_failure_become_details(runner, failing_pipeline):
    """The warning explains the failure; the message alone does not mention it."""

    def pipeline_that_warns_then_fails(config):
        logging.getLogger("oligo_designer_toolsuite").warning(
            "Region GFB69_RS0013 not available in reference file."
        )
        raise FileFormatError("No sequences were found for the requested regions.")

    config_path = failing_pipeline(pipeline_that_warns_then_fails)

    with pytest.raises(ODTPipelineError) as raised:
        runner.execute_pipeline(config_path)

    assert raised.value.details == ["Region GFB69_RS0013 not available in reference file."]


def test_empty_result_is_caught_before_the_legacy_system_exit_branch(runner, failing_pipeline):
    """EmptyResultError is also a SystemExit, so the order of except clauses decides.

    Losing that order would also let a SystemExit reach Celery, stopping the worker.
    """
    config_path = failing_pipeline(
        EmptyResultError("No oligos are left after filtering. Relax the filter settings.")
    )

    with pytest.raises(ODTEmptyResultError) as raised:
        runner.execute_pipeline(config_path)

    # Not the generic text from the `except SystemExit` fallback.
    assert "Relax the filter settings" in str(raised.value)


def test_details_survive_celery_serialization():
    """Celery rebuilds an exception from its args, and the errback writes the run document.

    An attribute set outside args is silently dropped on the way there, which leaves the
    run with a message but no warnings.
    """
    from backend.worker.celery import app

    error = ODTEmptyResultError("No sequences found.", ["Region ACTB not available in reference file."])

    backend_ = app.backend
    restored = backend_.exception_to_python(backend_.prepare_exception(error))

    assert str(restored) == "No sequences found."
    assert restored.details == ["Region ACTB not available in reference file."]
