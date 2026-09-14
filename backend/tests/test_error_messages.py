"""
Tests for making Oligo Designer Toolsuite messages safe to show users.
"""

import logging

import pytest

from backend.worker.error_messages import (
    MAX_COLLECTED_WARNINGS,
    MAX_MESSAGE_LENGTH,
    ODT_LOGGER_NAME,
    UserWarningCollector,
    clean,
)

OUTPUT_DIR = "/app/backend/data-access/user_data/u12/output_oligoseq_probe_designer_ab12"


class TestClean:
    @pytest.mark.parametrize(
        "message,expected",
        [
            (
                f"FASTA file '{OUTPUT_DIR}/genes.fna' does not exist.",
                "FASTA file 'genes.fna' does not exist.",
            ),
            ("Failed to write to C:\\Users\\someone\\out\\probes.tsv", "Failed to write to probes.tsv"),
            ("Cache miss for ~/.cache/odt/blastdb", "Cache miss for blastdb"),
            # Glued to a flag or a scheme, where a word-anchored check would miss them.
            ("blastn --out=/srv/userdata/u12/db.fna failed", "blastn --out=db.fna failed"),
            ("could not open file:/srv/userdata/u12/x.fna", "could not open file:x.fna"),
        ],
    )
    def test_paths_become_file_names(self, message, expected):
        """The file is what the user recognises; where it sits describes our server."""
        assert clean(message) == expected

    @pytest.mark.parametrize(
        "message",
        [
            "Table column must contain non-empty DNA sequences (A/C/G/T only).",
            "Codebook must contain only 0/1 values.",
            "Columns must be named bit_1/bit_2 style.",
            "'Tm_min' (60) must be <= 'Tm_max' (50) & got <class 'list'>.",
        ],
    )
    def test_ordinary_text_is_left_alone(self, message):
        """Separators and markup in a message are content; the frontend escapes it on render."""
        assert clean(message) == message

    @pytest.mark.parametrize("message", ["", "   "])
    def test_empty_messages_are_unusable(self, message):
        assert clean(message) is None

    def test_long_messages_are_cut_not_dropped(self):
        """A tool printing its usage text must still say which tool failed."""
        message = clean("bowtie2 failed with exit status 1: " + "usage " * 1000)

        assert message.startswith("bowtie2 failed with exit status 1: usage")
        assert len(message) == MAX_MESSAGE_LENGTH + 1


class TestUserWarningCollector:
    @pytest.fixture(autouse=True)
    def odt_logger(self):
        """Lets INFO through the logger itself, so only the collector's own level filters it."""
        logger = logging.getLogger(ODT_LOGGER_NAME)
        previous = logger.level
        logger.setLevel(logging.DEBUG)
        yield logger
        logger.setLevel(previous)

    def test_warnings_are_collected_and_cleaned(self, odt_logger):
        collector = UserWarningCollector()

        with collector:
            odt_logger.warning("Region GFB69_RS0013 not available in reference file.")
            odt_logger.warning(f"Could not read {OUTPUT_DIR}/genes.fna")
            odt_logger.info(f"Parameter: dir_output = {OUTPUT_DIR}")
            odt_logger.error("The oligo database is empty. Exiting program...")

        assert collector.messages == [
            "Region GFB69_RS0013 not available in reference file.",
            "Could not read genes.fna",
        ]

    def test_duplicates_are_collapsed_and_the_total_is_capped(self, odt_logger):
        """A run that drops hundreds of regions must not produce a wall of text."""
        collector = UserWarningCollector()

        with collector:
            for _ in range(5):
                odt_logger.warning("Region ACTB not available in reference file.")
            for i in range(100):
                odt_logger.warning("Region R%d not available in reference file.", i)

        assert collector.messages[:2] == [
            "Region ACTB not available in reference file.",
            "Region R0 not available in reference file.",
        ]
        assert len(collector.messages) == MAX_COLLECTED_WARNINGS

    def test_the_handler_is_detached_afterwards(self, odt_logger):
        """A handler left attached would leak warnings into later runs in the same worker."""
        collector = UserWarningCollector()

        with collector:
            pass
        odt_logger.warning("Region ACTB not available in reference file.")

        assert collector.messages == []
        assert collector not in odt_logger.handlers
