"""
Tests for how GenomicRegionGeneratorRunner reports failures to the user.
"""

import ftplib
import json
import logging
import os
from unittest.mock import MagicMock

import pytest
import requests
from oligo_designer_toolsuite._exceptions import FileFormatError

from backend.exceptions import ODTPipelineError
from backend.worker import genomic_region_generator_runner as module
from backend.worker.genomic_region_generator_runner import GenomicRegionGeneratorRunner

FORM_PATH = os.path.join(os.path.dirname(__file__), "data/genomic_ncbi_mock_form_data.json")


@pytest.fixture
def region_form():
    with open(FORM_PATH) as handle:
        return json.load(handle)


@pytest.fixture
def runner(monkeypatch, tmp_path):
    """A runner writing to tmp_path, whose NCBI download succeeds with local files."""
    monkeypatch.setattr(GenomicRegionGeneratorRunner, "__init__", lambda self, logger: None)
    runner = GenomicRegionGeneratorRunner(logger=logging.getLogger("test"))
    runner.logger = logging.getLogger("test")
    runner.cache_dir = tmp_path

    database = MagicMock()
    database.return_value.fetch_genomic_entity.return_value = {
        "genome_assembly": "GRCh38",
        "annotation_release": "110",
        "annotation_file": str(tmp_path / "annotation.gtf"),
        "sequence_file": str(tmp_path / "sequence.fna"),
    }
    monkeypatch.setattr(module, "NCBIGenomicDatabase", database)
    return runner


def generate_regions(runner, region_form):
    """Bypasses the file cache, which would otherwise remember results across tests."""
    return GenomicRegionGeneratorRunner.generate_regions.original(runner, region_form)


def test_toolsuite_message_and_warnings_reach_the_user(runner, region_form, monkeypatch):
    def load_annotations(**kwargs):
        logging.getLogger("oligo_designer_toolsuite").warning(
            "Could not calculate the number of total transcripts."
        )
        raise FileFormatError(f"GTF file '{runner.cache_dir}/annotation.gtf' has incorrect format.")

    generator = MagicMock()
    generator.return_value.load_annotations.side_effect = load_annotations
    monkeypatch.setattr(module, "GenomicRegionGenerator", generator)

    with pytest.raises(ODTPipelineError) as raised:
        generate_regions(runner, region_form)

    assert str(raised.value) == "GTF file 'annotation.gtf' has incorrect format."
    assert raised.value.details == ["Could not calculate the number of total transcripts."]


def test_a_failed_download_says_why(runner, region_form):
    module.NCBIGenomicDatabase.return_value.fetch_genomic_entity.side_effect = RuntimeError(
        "No assembly report found in /genomes/refseq/archaea/Acidianus/latest."
    )

    with pytest.raises(ODTPipelineError) as raised:
        generate_regions(runner, region_form)

    assert (
        str(raised.value) == "Could not fetch the genomic data from NCBI: No assembly report found in latest."
    )


@pytest.mark.parametrize(
    "error",
    [ftplib.error_temp("421 Service not available"), requests.ConnectionError("Connection refused")],
)
def test_a_network_failure_says_why(runner, region_form, error):
    module.NCBIGenomicDatabase.return_value.fetch_genomic_entity.side_effect = error

    with pytest.raises(ODTPipelineError) as raised:
        generate_regions(runner, region_form)

    assert str(raised.value) == f"Could not fetch the genomic data from NCBI: {error}"
