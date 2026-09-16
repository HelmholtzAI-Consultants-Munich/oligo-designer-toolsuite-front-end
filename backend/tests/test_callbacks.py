"""
Tests for the pipeline chord errback, which writes a failed run's document.

The message and the toolsuite's warnings arrive on the exception; this is where they
are turned into the fields the run page reads.
"""

from unittest.mock import MagicMock

import pytest
from bson import ObjectId

from backend.exceptions import ODTEmptyResultError, ODTPipelineError
from backend.types import RunStatus
from backend.worker.callbacks import pipeline_chord_errback

DETAILS = ["Region GFB69_RS0013 not available in reference file."]


@pytest.fixture
def errback(monkeypatch):
    """Runs the errback for a run that already started and returns what it wrote."""
    update_run = MagicMock()
    database = MagicMock()
    database.__enter__.return_value.runs.find_one.return_value = None
    monkeypatch.setattr("backend.worker.callbacks.mongo_database", lambda: database)
    monkeypatch.setattr("backend.worker.callbacks.queue_accounting_lock", lambda: MagicMock())
    monkeypatch.setattr("backend.worker.callbacks._update_run", update_run)

    def run(exc):
        pipeline_chord_errback(MagicMock(id=str(ObjectId())), exc, None)
        update_run.assert_called_once()
        return update_run.call_args.args[1]

    return run


def test_the_warnings_are_written_next_to_the_message(errback):
    update = errback(ODTPipelineError("FASTA file 'genes.fna' does not exist.", DETAILS))

    assert update == {
        "status": RunStatus.FAILURE,
        "error_message": "FASTA file 'genes.fna' does not exist.",
        "error_details": DETAILS,
    }


def test_an_empty_result_keeps_its_status_and_its_warnings(errback):
    update = errback(ODTEmptyResultError("No sequences were found for the requested regions.", DETAILS))

    assert update["status"] == RunStatus.EMPTY_RESULT
    assert update["error_details"] == DETAILS


def test_a_failure_without_warnings_writes_no_details_field(errback):
    update = errback(ODTPipelineError("Something failed."))

    assert update == {"status": RunStatus.FAILURE, "error_message": "Something failed."}
