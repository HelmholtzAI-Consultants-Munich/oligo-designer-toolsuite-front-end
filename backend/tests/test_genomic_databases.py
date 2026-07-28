"""Genomic database unit tests.

Notes:
    Network-facing FTP/HTTP behavior is replaced with fakes and mocks. Checksum,
    cache, and decompression paths use real temp files so file handling is covered
    without live network access.
"""

import gzip
import hashlib
import subprocess
from pathlib import Path
from typing import ClassVar
from unittest.mock import MagicMock, patch

import pytest

from backend.genomic_databases import (
    BaseGenomicDatabase,
    EnsemblGenomicDatabase,
    GenomicEntity,
    GenomicEntityContext,
    NCBIGenomicDatabase,
)


class ConcreteDatabase(BaseGenomicDatabase):
    """Concrete test double for exercising BaseGenomicDatabase's shared logic."""

    name: ClassVar[str] = "db"
    host: ClassVar[str] = "host"
    base_path: ClassVar[str] = "base"
    checksums_filename: ClassVar[str] = "CHECKSUMS"

    def _build_species_mapping(self, species_dirs: dict[str, list[str]]) -> dict[str, list[str]]:
        """Return the input unchanged.

        Arguments:
            species_dirs {dict[str, list[str]]} -- directories mapped to their subdirectories

        Notes:
            This lets tests assert on fetch_species_mapping's directory-discovery
            plumbing without a provider-specific reshaping step getting in the way.

        Returns:
            dict[str, list[str]] -- the input, unchanged
        """
        return species_dirs

    def _matches_checksum(self, file_path: Path, expected_checksum: str) -> bool:
        """Always pass verification.

        Arguments:
            file_path {Path} -- path to the downloaded file
            expected_checksum {str} -- checksum value from the provider

        Notes:
            This lets tests focus on download logic without checksum verification
            getting in the way.

        Returns:
            bool -- always True to bypass checksum validation in base-class tests
        """
        return True

    def _get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        """Return a fixed context.

        Arguments:
            entity {GenomicEntity} -- the genomic entity being resolved

        Notes:
            This lets tests exercise entity fetching without real FTP navigation.

        Returns:
            GenomicEntityContext -- stub context with hardcoded paths and metadata
        """
        return GenomicEntityContext("ann", "ann.gtf.gz", "seq", "seq.fna.gz", "1", "asm", None)


class FakeFTP:
    """Small FTP fake that records directory changes and returns fixed listings.

    Notes:
        A custom class rather than MagicMock is needed to record the order of
        `cwd()` calls, which is how we verify the right FTP path is navigated
        before listing directory entries.
    """

    def __init__(self, lines=None, names=None):
        """Configure the fake with controlled listing data.

        Keyword Arguments:
            lines {list} -- raw FTP listing lines returned by dir (default: {None})
            names {list} -- filenames returned by nlst (default: {None})

        Notes:
            This lets tests verify FTP navigation without a network connection.
        """
        self.lines = lines or []
        self.names = names or []
        self.cwd_calls = []
        self.login = MagicMock()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def dir(self, callback):
        for line in self.lines:
            callback(line)

    def cwd(self, path):
        self.cwd_calls.append(path)
        return path

    def nlst(self):
        return self.names


def test_get_subdirs_parses_directories_and_symlinks():
    """Directories and symlinks are both included while plain files are excluded.

    Notes:
        This ensures the download logic only navigates into actual directories.
    """
    ftp = FakeFTP(
        [
            "drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 dir_b",
            "lrwxrwxrwx 1 ftp ftp 7 Jan 01 00:00 link_a -> target",
            "-rw-r--r-- 1 ftp ftp 1 Jan 01 00:00 file.txt",
        ]
    )

    assert ConcreteDatabase()._get_subdirs(ftp) == ["dir_b", "link_a"]


def test_get_subdirs_ignores_malformed_lines():
    """Listing lines without enough whitespace-separated fields are silently skipped.

    Notes:
        A malformed line would otherwise abort the whole directory listing via
        an uncaught ValueError.
    """
    ftp = FakeFTP(["broken", "drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 dir_b"])

    assert ConcreteDatabase()._get_subdirs(ftp) == ["dir_b"]


def test_filter_allowlist_filters_when_present():
    """An allowlist restricts results to configured names.

    Notes:
        This ensures only intended organisms consume cache space.
    """
    assert ConcreteDatabase(allowlist={"a", "c"})._filter_allowlist(["a", "b"]) == ["a"]


def test_filter_allowlist_returns_all_without_allowlist():
    """Omitting the allowlist returns everything.

    Notes:
        This makes the default behavior unrestricted.
    """
    assert ConcreteDatabase()._filter_allowlist(["a", "b"]) == ["a", "b"]


def test_fetch_species_mapping_logs_in_and_builds_mapping():
    """Login and initial cwd happen before listing.

    Notes:
        This ensures anonymous FTP sessions start at the right base path.
    """
    ftp = FakeFTP(["drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 release"])
    db = ConcreteDatabase()

    with (
        patch("backend.genomic_databases.ftplib.FTP", return_value=ftp),
        patch.object(db, "_get_subdirectories", return_value={"release": ["species"]}),
    ):
        result = db.fetch_species_mapping()

    ftp.login.assert_called_once_with()
    assert ftp.cwd_calls[0] == "base"
    assert result == {"release": ["species"]}


def test_download_requires_cache_dir():
    """Downloading without a cache dir fails early rather than writing to an unknown path.

    Notes:
        Without a cache dir, files would have no persistent location.
    """
    with pytest.raises(RuntimeError, match="No caching directory"):
        ConcreteDatabase()._download("dir", "file.txt")


def test_download_writes_response_chunks_to_cache(tmp_path):
    """Responses are streamed in chunks to the cache.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the cached file

    Notes:
        This avoids loading multi-GB genome files into memory all at once.
    """
    response = MagicMock()
    response.__enter__.return_value = response
    response.status_code = 200
    response.headers = {}
    response.iter_content.return_value = [b"ab", b"cd"]

    with patch("backend.genomic_databases.requests.get", return_value=response):
        path = ConcreteDatabase(cache_dir=tmp_path)._download("dir", "file.txt")

    assert path.read_bytes() == b"abcd"


def test_download_sends_if_modified_since_for_existing_file(tmp_path):
    """An If-Modified-Since header is sent when a cached file already exists.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory containing the pre-existing cached file

    Notes:
        This avoids re-downloading multi-GB genome files that haven't changed
        since the last fetch.
    """
    db = ConcreteDatabase(cache_dir=tmp_path)
    existing = tmp_path / "db"
    existing.mkdir()
    url_hash = hashlib.md5(b"https://host/dir/file.txt").hexdigest()
    (existing / f"{url_hash}-file.txt").write_text("old")
    response = MagicMock()
    response.__enter__.return_value = response
    response.status_code = 304
    response.headers = {}

    with patch("backend.genomic_databases.requests.get", return_value=response) as get:
        db._download("dir", "file.txt")

    assert "if-modified-since" in get.call_args.kwargs["headers"]


def test_download_and_process_verifies_checksum_and_unzips(tmp_path):
    """Checksum verification happens before the archive is removed.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the gzip archive and extracted file

    Notes:
        This ensures a corrupted download is caught before it propagates.
    """
    gz_path = tmp_path / "file.fna.gz"
    with gzip.open(gz_path, "wb") as archive:
        archive.write(b">x\nAC\n")
    db = ConcreteDatabase(cache_dir=tmp_path)

    with (
        patch.object(db, "_download", return_value=gz_path),
        patch.object(db, "_matches_checksum", return_value=True),
    ):
        path = BaseGenomicDatabase._download_and_process.__wrapped__(db, "dir", "file.fna.gz", "checksum")

    assert path == tmp_path / "file.fna"
    assert path.read_bytes() == b">x\nAC\n"
    assert not gz_path.exists()


def test_download_and_process_rejects_bad_checksum(tmp_path):
    """A checksum mismatch that persists across a retry raises an error.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the downloaded file

    Notes:
        This prevents silently handing the caller a corrupted file. The current
        implementation retries the download once before giving up.
    """
    file_path = tmp_path / "file.txt"
    file_path.write_text("bad")
    db = ConcreteDatabase(cache_dir=tmp_path)

    with (
        patch.object(db, "_download", return_value=file_path) as download,
        patch.object(db, "_matches_checksum", return_value=False),
    ):
        with pytest.raises(RuntimeError, match="Checksum"):
            BaseGenomicDatabase._download_and_process.__wrapped__(db, "dir", "file.txt", "checksum")

    assert download.call_count == 2


def test_get_checksum_map_downloads_unique_dirs_once(tmp_path):
    """The checksum file is downloaded only once per unique remote dir.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the checksum file

    Notes:
        Annotation and sequence files often share the same remote dir, so
        downloading the checksum file twice would waste bandwidth.
    """
    checksum_file = tmp_path / "CHECKSUMS"
    checksum_file.write_text("123 file.txt\n")
    db = ConcreteDatabase()
    context = GenomicEntityContext("same", "a", "same", "b", "1", "asm", None)

    with patch.object(db, "_parse_checksum_line", return_value=("file", "checksum")):
        with patch.object(db, "_download", return_value=checksum_file) as download:
            result = db._get_checksum_map(context)

    download.assert_called_once_with("same", "CHECKSUMS")
    assert result == {"file": "checksum"}


def test_get_checksum_map_skips_blank_or_malformed_lines(tmp_path):
    """Blank and single-token lines in a checksums file are skipped rather than aborting the whole file.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the checksum file

    Notes:
        _parse_checksum_line raises ValueError for lines it can't parse, and
        _get_checksum_map catches that per-line so one bad line doesn't lose
        the rest of the map.
    """
    checksum_file = tmp_path / "CHECKSUMS"
    checksum_file.write_text("abcd  ./good.txt\n\nbroken\n")
    db = NCBIGenomicDatabase()
    context = GenomicEntityContext("dir", "good.txt", "dir", "good.txt", "1", "asm", None)

    with patch.object(db, "_download", return_value=checksum_file):
        result = db._get_checksum_map(context)

    assert result == {"good.txt": "abcd"}


def test_get_checksum_missing_filename_raises():
    """Looking up a filename absent from the checksum map raises a descriptive RuntimeError."""
    with pytest.raises(RuntimeError, match="Required file missing"):
        ConcreteDatabase()._get_checksum({}, "missing.fna.gz")


def test_fetch_genomic_entity_returns_resolved_files_and_metadata():
    """The returned dict includes both file paths and metadata.

    Notes:
        This means callers don't need to re-derive assembly info from the
        filenames.
    """
    db = ConcreteDatabase()
    with (
        patch.object(
            db,
            "_get_entity_context",
            return_value=GenomicEntityContext("ann", "ann.gtf.gz", "seq", "seq.fna.gz", "2", "asm", None),
        ),
        patch.object(db, "_get_checksum_map", return_value={"ann.gtf.gz": "a", "seq.fna.gz": "s"}),
        patch.object(db, "_download_and_process", side_effect=[Path("/ann.gtf"), Path("/seq.fna")]),
    ):
        result = db.fetch_genomic_entity(GenomicEntity(None, "species", "2"))

    assert result == {
        "annotation_file": "/ann.gtf",
        "sequence_file": "/seq.fna",
        "annotation_release": "2",
        "genome_assembly": "asm",
    }


def test_ncbi_parse_checksum_line_valid():
    """NCBI checksum files use `hash  ./filename` format with a leading `./` that must be stripped for filename matching."""
    assert NCBIGenomicDatabase()._parse_checksum_line("abcd  ./file.fna.gz") == ("file.fna.gz", "abcd")


def test_ncbi_parse_checksum_line_raises_on_blank_or_malformed():
    """Blank and single-token lines raise ValueError so the checksum map loader can skip them."""
    db = NCBIGenomicDatabase()
    with pytest.raises(ValueError):
        db._parse_checksum_line("")
    with pytest.raises(ValueError):
        db._parse_checksum_line("abcd")


def test_ncbi_matches_checksum_compares_md5_digest(tmp_path):
    """Verification compares the actual file digest, not just file existence.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the file under verification

    Notes:
        NCBI uses MD5 checksums for this comparison.
    """
    file_path = tmp_path / "file.txt"
    file_path.write_text("content")
    digest = hashlib.md5(b"content").hexdigest()

    assert NCBIGenomicDatabase()._matches_checksum(file_path, digest)
    assert not NCBIGenomicDatabase()._matches_checksum(file_path, "wrong")


def test_ncbi_get_all_releases_dir_prefers_annotation_releases():
    """annotation_releases is preferred over all_assembly_versions when both exist.

    Notes:
        It contains curated, stable assembly versions rather than all
        historical submissions.
    """
    ftp = FakeFTP(
        [
            "drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 annotation_releases",
            "drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 all_assembly_versions",
        ]
    )
    db = NCBIGenomicDatabase()

    assert (
        db._get_all_releases_dir(ftp, "taxon", "species")
        == "/genomes/refseq/taxon/species/annotation_releases"
    )


def test_ncbi_get_all_releases_dir_falls_back_to_all_assembly_versions():
    """Older assemblies that predate the annotation_releases directory are only available under all_assembly_versions."""
    ftp = FakeFTP(["drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 all_assembly_versions"])
    db = NCBIGenomicDatabase()

    assert (
        db._get_all_releases_dir(ftp, "taxon", "species")
        == "/genomes/refseq/taxon/species/all_assembly_versions"
    )


def test_ncbi_get_all_releases_dir_returns_none_when_neither_exists():
    """No candidate release directory returns None rather than a nonexistent path."""
    ftp = FakeFTP(["drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 something_else"])
    db = NCBIGenomicDatabase()

    assert db._get_all_releases_dir(ftp, "taxon", "species") is None


def test_ncbi_fetch_annotations_releases_filters_suppressed():
    """Assemblies under a 'suppressed' directory are excluded from results.

    Notes:
        NCBI marks withdrawn assemblies this way, so excluding them ensures
        callers never see retracted data. The filter matches when release_dir
        (a full FTP path) ends with "all_assembly_versions", so the mocked
        _get_all_releases_dir returns a realistic full path here rather than
        the bare directory name.
    """
    ftp = FakeFTP(
        ["drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 suppressed", "drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 GCF_1"]
    )
    db = NCBIGenomicDatabase()
    with (
        patch("backend.genomic_databases.ftplib.FTP", return_value=ftp),
        patch.object(
            db,
            "_get_all_releases_dir",
            return_value="/genomes/refseq/taxon/species/all_assembly_versions",
        ),
    ):
        result = NCBIGenomicDatabase.fetch_annotations_releases.__wrapped__(db, "taxon", "species")

    assert result == ["GCF_1"]


def test_ncbi_fetch_annotations_releases_returns_none_when_no_release_dir():
    """None signals the species has no releases on NCBI, distinct from an empty list which would mean releases exist but none matched."""
    db = NCBIGenomicDatabase()
    with (
        patch("backend.genomic_databases.ftplib.FTP", return_value=FakeFTP()),
        patch.object(db, "_get_all_releases_dir", return_value=None),
    ):
        assert NCBIGenomicDatabase.fetch_annotations_releases.__wrapped__(db, "taxon", "species") is None


def test_ncbi_get_assembly_information_parses_report(tmp_path):
    """Assembly name and accession are parsed from the assembly report.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the assembly report file

    Notes:
        The assembly report is the authoritative source for these values, which
        are used to construct NCBI filenames.
    """
    report = tmp_path / "assembly_report.txt"
    report.write_text("# Assembly name: GRCh38 p14\n# RefSeq assembly accession: GCF_000001405.40\n")
    db = NCBIGenomicDatabase()

    with patch.object(db, "_download", return_value=report):
        assert db._get_assembly_information("dir", "report.txt") == ("GRCh38_p14", "GCF_000001405.40")


def test_ncbi_get_assembly_information_errors_when_missing_fields(tmp_path):
    """A partial assembly report fails loudly rather than silently producing wrong filenames.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the partial assembly report

    Notes:
        Both assembly name and accession are required to construct expected
        filenames.
    """
    report = tmp_path / "assembly_report.txt"
    report.write_text("# Assembly name: GRCh38\n")
    db = NCBIGenomicDatabase()

    with patch.object(db, "_download", return_value=report):
        with pytest.raises(ValueError, match="accession"):
            db._get_assembly_information("dir", "report.txt")


def test_ncbi_get_entity_context_builds_expected_filenames():
    """The context builder produces NCBI filenames in the exact accession_assembly_genomic.ext pattern.

    Notes:
        NCBI filenames follow this strict pattern, and downloads will fail
        otherwise.
    """
    db = NCBIGenomicDatabase()
    with patch.object(db, "_resolve_release_and_dir", return_value=("110", "GRCh38", "GCF_1", "/remote/")):
        context = db._get_entity_context(GenomicEntity("taxon", "species", "current"))

    assert context.annotation_remote_filename == "GCF_1_GRCh38_genomic.gtf.gz"
    assert context.sequence_remote_filename == "GCF_1_GRCh38_genomic.fna.gz"


def test_ensembl_parse_checksum_line():
    """Ensembl checksum lines are parsed in the BSD `sum` command format (checksum size filename)."""
    assert EnsemblGenomicDatabase()._parse_checksum_line("12345 678 file.fa.gz") == ("file.fa.gz", "12345")


def test_ensembl_matches_checksum_uses_sum_command(tmp_path):
    """Verification calls the `sum` command to check Ensembl checksums.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the file under verification

    Notes:
        Ensembl checksums use `sum` rather than MD5, so calling the wrong tool
        would always mismatch.
    """
    file_path = tmp_path / "file.fa"
    file_path.write_text("AC")
    completed = subprocess.CompletedProcess(["sum"], 0, stdout="123 1 file.fa\n")

    with patch("backend.genomic_databases.subprocess.run", return_value=completed):
        assert EnsemblGenomicDatabase()._matches_checksum(file_path, "123")
        assert not EnsemblGenomicDatabase()._matches_checksum(file_path, "999")


def test_ensembl_matches_checksum_returns_false_on_called_process_error(tmp_path):
    """Verification returns False when the `sum` command is unavailable or exits with an error.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory

    Notes:
        This avoids propagating the exception to the caller.
    """
    with patch(
        "backend.genomic_databases.subprocess.run", side_effect=subprocess.CalledProcessError(1, "sum")
    ):
        assert not EnsemblGenomicDatabase()._matches_checksum(tmp_path / "file", "123")


def test_ensembl_get_subdirectories_rewrites_release_dirs_to_fasta():
    """Species listing navigates to the fasta subdirectory even though the top-level listing uses gtf paths.

    Notes:
        The two trees are structurally parallel.
    """
    ftp = FakeFTP(["drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 homo_sapiens"])
    db = EnsemblGenomicDatabase()

    assert db._get_subdirectories(["release-110"], ftp) == {"release-110/fasta": ["homo_sapiens"]}
    assert ftp.cwd_calls == ["/pub/release-110/fasta"]


def test_ensembl_build_species_mapping_reverses_species_to_releases():
    """The release->species FTP structure is inverted into a mapping keyed by species, with plain release numbers.

    Notes:
        This is the shape the dropdown UI needs.
    """
    db = EnsemblGenomicDatabase()
    species_dirs = {
        "release-110/fasta": ["human"],
        "release-111/fasta": ["human", "mouse"],
    }

    assert db._build_species_mapping(species_dirs) == {
        "human": ["110", "111"],
        "mouse": ["111"],
    }


def test_ensembl_pick_files_prefers_primary_assembly_dna_sm():
    """Ensembl FASTA selection prefers masked primary assembly over toplevel files."""
    ftp = FakeFTP(
        names=[
            "Homo_sapiens.GRCh38.110.gtf.gz",
            "Homo_sapiens.GRCh38.dna_sm.primary_assembly.fa.gz",
            "Homo_sapiens.GRCh38.dna.toplevel.fa.gz",
        ]
    )
    with patch("backend.genomic_databases.ftplib.FTP", return_value=ftp):
        assert EnsemblGenomicDatabase()._pick_files("ann", "seq") == (
            "Homo_sapiens.GRCh38.110.gtf.gz",
            "Homo_sapiens.GRCh38.dna_sm.primary_assembly.fa.gz",
            "GRCh38",
        )


def test_ensembl_pick_files_errors_without_gtf():
    """A missing GTF raises an error early.

    Notes:
        This means annotation is unavailable, and the pipeline must not proceed
        without annotation data.
    """
    with patch("backend.genomic_databases.ftplib.FTP", return_value=FakeFTP(names=["file.fa.gz"])):
        with pytest.raises(RuntimeError, match="No suitable annotation"):
            EnsemblGenomicDatabase()._pick_files("ann", "seq")


def test_ensembl_pick_files_errors_without_fasta():
    """A missing FASTA raises an error early.

    Notes:
        This means the sequence is unavailable, and the pipeline must not
        proceed without sequence data.
    """
    with patch(
        "backend.genomic_databases.ftplib.FTP", return_value=FakeFTP(names=["Homo_sapiens.GRCh38.110.gtf.gz"])
    ):
        with pytest.raises(RuntimeError, match="No suitable sequence"):
            EnsemblGenomicDatabase()._pick_files("ann", "seq")


def test_ensembl_get_entity_context_uses_current_for_non_numeric_release():
    """A non-numeric release like 'current' maps to the live release path rather than a versioned one.

    Notes:
        This ensures callers always get the latest data.
    """
    db = EnsemblGenomicDatabase()
    with patch.object(db, "_pick_files", return_value=("ann.gtf.gz", "seq.fa.gz", "GRCh38")):
        context = db._get_entity_context(GenomicEntity(None, "homo_sapiens", "current"))

    assert context.annotation_remote_dir == "/pub/current/gtf/homo_sapiens"
    assert context.sequence_remote_dir == "/pub/current/fasta/homo_sapiens/dna"
    assert context.annotation_release == "current"


def test_ensembl_get_entity_context_builds_dirs_and_metadata():
    """The context includes both remote dirs and metadata for a numeric release.

    Notes:
        This means subsequent download and annotation lookup steps don't need
        to re-navigate the FTP tree. Numeric releases map to a versioned
        release-NNN path rather than the live release path.
    """
    db = EnsemblGenomicDatabase()
    with patch.object(db, "_pick_files", return_value=("ann.gtf.gz", "seq.fa.gz", "GRCh38")):
        context = db._get_entity_context(GenomicEntity(None, "homo_sapiens", "110"))

    assert context.annotation_remote_dir == "/pub/release-110/gtf/homo_sapiens"
    assert context.sequence_remote_dir == "/pub/release-110/fasta/homo_sapiens/dna"
    assert context.annotation_release == "release-110"
    assert context.genome_assembly == "GRCh38"


def test_genomic_dropdown_returns_cached_or_fetched_options(client):
    """The dropdown endpoint returns the full nested species/taxa structure.

    Arguments:
        client {Any} -- anonymous Flask test client

    Notes:
        This lets the frontend populate selection menus without additional
        calls.
    """
    with patch(
        "backend.routes.genomic.fetch_dropdown_options", return_value={"ncbi": {"taxon": ["species"]}}
    ):
        response = client.get("/api/genomic/dropdown")

    assert response.status_code == 200
    assert response.get_json() == {"ncbi": {"taxon": ["species"]}}


def test_genomic_releases_returns_release_list(client):
    """The releases endpoint proxies the FTP listing.

    Arguments:
        client {Any} -- anonymous Flask test client

    Notes:
        This lets the frontend offer release selection without knowing FTP
        paths.
    """
    with patch(
        "backend.routes.genomic.NCBIGenomicDatabase.fetch_annotations_releases",
        return_value=["current", "110"],
    ):
        response = client.get("/api/genomic/releases/taxon/species")

    assert response.status_code == 200
    assert response.get_json() == ["current", "110"]


def test_genomic_releases_returns_404_when_none(client):
    """A 404 is returned when fetch_annotations_releases returns None.

    Arguments:
        client {Any} -- anonymous Flask test client

    Notes:
        None means the species has no releases on NCBI, and 404 prevents the
        frontend from displaying an empty selection.
    """
    with patch("backend.routes.genomic.NCBIGenomicDatabase.fetch_annotations_releases", return_value=None):
        response = client.get("/api/genomic/releases/taxon/species")

    assert response.status_code == 404
