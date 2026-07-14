"""Genomic database unit tests.

Network-facing FTP/HTTP behavior is replaced with fakes and mocks. Checksum,
cache, and decompression paths use real temp files so file handling is covered
without live network access.
"""

import ftplib
import gzip
import hashlib
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend.genomic_databases import (
    BaseGenomicDataBase,
    EnsemblGenomicDataBase,
    GenomicEntity,
    GenomicEntityContext,
    NCBIGenomicDataBase,
)


class ConcreteDatabase(BaseGenomicDataBase):
    """Concrete test double for exercising BaseGenomicDataBase behavior."""

    def _verify_file(self, file_path: Path, expected_checksum: str) -> bool:
        """Always pass verification so tests can focus on download logic without checksum getting in the way.

        Arguments:
            file_path {Path} -- path to the downloaded file
            expected_checksum {str} -- checksum value from the provider

        Returns:
            bool -- always True to bypass checksum validation in base-class tests
        """
        return True

    def get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        """Return a fixed context so tests can exercise entity fetching without real FTP navigation.

        Arguments:
            entity {GenomicEntity} -- the genomic entity being resolved

        Returns:
            GenomicEntityContext -- stub context with hardcoded paths and metadata
        """
        return GenomicEntityContext("ann", "ann.gtf.gz", "seq", "seq.fna.gz", "1", "asm", None)

    def _checksum_filename(self) -> str:
        """Return a fixed name to avoid coupling base-class tests to provider-specific checksum filenames.

        Returns:
            str -- fixed checksum filename used across base-class tests
        """
        return "CHECKSUMS"

    def _parse_checksum_line(self, line):
        """Return a fixed tuple so checksum map tests don't depend on provider-specific line parsing.

        Arguments:
            line {Any} -- raw line from the checksum file

        Returns:
            tuple -- fixed (filename, checksum) pair
        """
        return ("file", "checksum")


class FakeFTP:
    """Small FTP fake that records directory changes and returns fixed listings.

    A custom class rather than MagicMock is needed to record the order of
    `cwd()` calls, which is how we verify the right FTP path is navigated
    before listing directory entries.
    """

    def __init__(self, lines=None, names=None):
        """Configure the fake with controlled listing data so tests can verify FTP navigation without a network connection.

        Keyword Arguments:
            lines {list} -- raw FTP listing lines returned by retrlines (default: {None})
            names {list} -- filenames returned by nlst (default: {None})
        """
        self.lines = lines or []
        self.names = names or []
        self.cwd_calls = []
        self.login = MagicMock()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def retrlines(self, command, callback):
        for line in self.lines:
            callback(line)

    def cwd(self, path):
        self.cwd_calls.append(path)
        return path

    def nlst(self):
        return self.names


def test_get_dirs_parses_directories_and_symlinks():
    """Directories and symlinks must both be included while plain files are excluded so the download logic only navigates into actual directories."""
    ftp = FakeFTP(
        [
            "drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 dir_b",
            "lrwxrwxrwx 1 ftp ftp 7 Jan 01 00:00 link_a -> target",
            "-rw-r--r-- 1 ftp ftp 1 Jan 01 00:00 file.txt",
        ]
    )

    assert ConcreteDatabase()._get_dirs(ftp) == ["dir_b", "link_a -> target"]


def test_get_dirs_ignores_malformed_lines():
    """Malformed FTP listing lines must be silently skipped rather than crashing so a partial listing doesn't abort the whole fetch."""
    ftp = FakeFTP(["broken", "drwxr-xr-x too-short"])

    assert ConcreteDatabase()._get_dirs(ftp) == []


def test_filter_allowlist_filters_when_present():
    """An allowlist must restrict results to configured names so only intended organisms consume cache space."""
    assert ConcreteDatabase(allowlist=["a", "c"])._filter_allowlist(["a", "b"]) == ["a"]


def test_filter_allowlist_returns_all_without_allowlist():
    """Omitting the allowlist must return everything so the default behavior is unrestricted."""
    assert ConcreteDatabase()._filter_allowlist(["a", "b"]) == ["a", "b"]


def test_fetch_ftp_directories_logs_in_and_builds_directory_dict():
    """Login and initial cwd must happen before listing so anonymous FTP sessions start at the right base path."""
    ftp = FakeFTP(["drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 release"])
    with (
        patch("backend.genomic_databases.ftplib.FTP", return_value=ftp),
        patch.object(ConcreteDatabase, "_get_species_dirs", return_value=[["species"]]),
    ):
        name, directories = ConcreteDatabase(name="db", host="host", base_path="base").fetch_ftp_directories()

    ftp.login.assert_called_once_with()
    assert ftp.cwd_calls[0] == "base"
    assert name == "db"
    assert directories == {"release": ["species"]}


def test_download_requires_cache_dir():
    """Downloading without a cache dir would leave files with no persistent location, so it must fail early rather than writing to an unknown path."""
    with pytest.raises(RuntimeError, match="No caching directory"):
        ConcreteDatabase(name="db", host="host")._download("dir", "file.txt")


def test_download_writes_response_chunks_to_cache(tmp_path):
    """Responses must be streamed in chunks to avoid loading multi-GB genome files into memory all at once.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the cached file
    """
    response = MagicMock()
    response.__enter__.return_value = response
    response.status_code = 200
    response.headers = {}
    response.iter_content.return_value = [b"ab", b"cd"]

    with patch("backend.genomic_databases.requests.get", return_value=response):
        path = ConcreteDatabase(name="db", host="host", cache_dir=tmp_path)._download("dir", "file.txt")

    assert path.read_bytes() == b"abcd"


def test_download_sends_if_modified_since_for_existing_file(tmp_path):
    """If-Modified-Since avoids re-downloading multi-GB genome files that haven't changed since the last fetch.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory containing the pre-existing cached file
    """
    db = ConcreteDatabase(name="db", host="host", cache_dir=tmp_path)
    existing = db._download.__self__.cache_dir / "db"
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
    """Checksum verification must happen before the archive is removed so a corrupted download is caught before it propagates.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the gzip archive and extracted file
    """
    gz_path = tmp_path / "file.fna.gz"
    with gzip.open(gz_path, "wb") as archive:
        archive.write(b">x\nAC\n")
    db = ConcreteDatabase(cache_dir=tmp_path)

    with (
        patch.object(db, "_download", return_value=gz_path),
        patch.object(db, "_verify_file", return_value=True),
    ):
        path = BaseGenomicDataBase._download_and_process.__wrapped__(db, "dir", "file.fna.gz", "checksum")

    assert path == tmp_path / "file.fna"
    assert path.read_bytes() == b">x\nAC\n"
    assert not gz_path.exists()


def test_download_and_process_rejects_bad_checksum(tmp_path):
    """A checksum mismatch must raise an error rather than silently handing the caller a corrupted file.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the downloaded file
    """
    file_path = tmp_path / "file.txt"
    file_path.write_text("bad")
    db = ConcreteDatabase(cache_dir=tmp_path)

    with (
        patch.object(db, "_download", return_value=file_path),
        patch.object(db, "_verify_file", return_value=False),
    ):
        with pytest.raises(RuntimeError, match="Checksum"):
            BaseGenomicDataBase._download_and_process.__wrapped__(db, "dir", "file.txt", "checksum")


def test_get_checksum_map_downloads_unique_dirs_once(tmp_path):
    """Annotation and sequence files often share the same remote dir; downloading the checksum file twice would waste bandwidth.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the checksum file
    """
    checksum_file = tmp_path / "CHECKSUMS"
    checksum_file.write_text("123 file.txt\n")
    db = ConcreteDatabase()
    context = GenomicEntityContext("same", "a", "same", "b", "1", "asm", None)

    with patch.object(db, "_download", return_value=checksum_file) as download:
        result = db._get_checksum_map(context)

    download.assert_called_once_with("same", "CHECKSUMS")
    assert result == {"file": "checksum"}


def test_get_checksum_missing_filename_raises():
    with pytest.raises(RuntimeError, match="Required file missing"):
        ConcreteDatabase()._get_checksum({}, "missing.fna.gz")


def test_fetch_genomic_entity_returns_resolved_files_and_metadata():
    """The returned dict must include both file paths and metadata so callers don't need to re-derive assembly info from the filenames."""
    db = ConcreteDatabase()
    with (
        patch.object(
            db,
            "get_entity_context",
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
    assert NCBIGenomicDataBase()._parse_checksum_line("abcd  ./file.fna.gz") == ("file.fna.gz", "abcd")


def test_ncbi_parse_checksum_line_blank_or_malformed_returns_none():
    """Blank and truncated lines in NCBI checksum files must be skipped rather than crashing the parse loop."""
    db = NCBIGenomicDataBase()
    assert db._parse_checksum_line("") is None
    assert db._parse_checksum_line("abcd") is None


def test_ncbi_verify_file_matches_md5(tmp_path):
    """NCBI uses MD5 checksums; verification must compare the actual file digest, not just file existence.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the file under verification
    """
    file_path = tmp_path / "file.txt"
    file_path.write_text("content")
    digest = hashlib.md5(b"content").hexdigest()

    assert NCBIGenomicDataBase()._verify_file(file_path, digest)
    assert not NCBIGenomicDataBase()._verify_file(file_path, "wrong")


def test_ncbi_get_releases_dir_prefers_annotation_releases():
    """annotation_releases is preferred because it contains curated, stable assembly versions rather than all historical submissions."""
    ftp = FakeFTP()

    assert (
        NCBIGenomicDataBase(base_path="base")._get_releases_dir(ftp, "taxon", "species")
        == "annotation_releases"
    )


def test_ncbi_get_releases_dir_falls_back_to_all_assembly_versions():
    """Older assemblies that predate the annotation_releases directory are only available under all_assembly_versions."""
    ftp = FakeFTP()
    ftp.cwd = MagicMock(side_effect=[ftplib.error_perm("missing"), "ok"])

    assert (
        NCBIGenomicDataBase(base_path="base")._get_releases_dir(ftp, "taxon", "species")
        == "all_assembly_versions"
    )


def test_ncbi_fetch_annotations_releases_filters_suppressed():
    """NCBI marks withdrawn assemblies with a 'suppressed' directory that must be excluded so callers never see retracted data."""
    ftp = FakeFTP(
        ["drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 suppressed", "drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 GCF_1"]
    )
    db = NCBIGenomicDataBase()
    with (
        patch("backend.genomic_databases.ftplib.FTP", return_value=ftp),
        patch.object(db, "_get_releases_dir", return_value="all_assembly_versions"),
    ):
        result = NCBIGenomicDataBase.fetch_annotations_releases.__wrapped__(db, "taxon", "species")

    assert result == ["GCF_1"]


def test_ncbi_fetch_annotations_releases_returns_none_when_no_release_dir():
    """None signals the species has no releases on NCBI, distinct from an empty list which would mean releases exist but none matched."""
    db = NCBIGenomicDataBase()
    with (
        patch("backend.genomic_databases.ftplib.FTP", return_value=FakeFTP()),
        patch.object(db, "_get_releases_dir", return_value=None),
    ):
        assert NCBIGenomicDataBase.fetch_annotations_releases.__wrapped__(db, "taxon", "species") is None


def test_ncbi_get_assembly_information_parses_report(tmp_path):
    """The assembly report is the authoritative source for the assembly name and accession used to construct NCBI filenames.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the assembly report file
    """
    report = tmp_path / "assembly_report.txt"
    report.write_text("# Assembly name: GRCh38 p14\n# RefSeq assembly accession: GCF_000001405.40\n")
    db = NCBIGenomicDataBase()

    with patch.object(db, "_download", return_value=report):
        assert db._get_assembly_information("dir", "report.txt") == ("GRCh38_p14", "GCF_000001405.40")


def test_ncbi_get_assembly_information_errors_when_missing_fields(tmp_path):
    """Both assembly name and accession are required to construct expected filenames; a partial report must fail loudly rather than silently producing wrong filenames.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the partial assembly report
    """
    report = tmp_path / "assembly_report.txt"
    report.write_text("# Assembly name: GRCh38\n")
    db = NCBIGenomicDataBase()

    with patch.object(db, "_download", return_value=report):
        with pytest.raises(ValueError, match="accession"):
            db._get_assembly_information("dir", "report.txt")


def test_ncbi_get_entity_context_builds_expected_filenames():
    """NCBI filenames follow a strict pattern (accession_assembly_genomic.ext); the context builder must produce that pattern exactly or downloads will fail."""
    db = NCBIGenomicDataBase()
    with patch.object(db, "_resolve_release_and_dir", return_value=("110", "GRCh38", "GCF_1", "/remote/")):
        context = db.get_entity_context(GenomicEntity("taxon", "species", "current"))

    assert context.annotation_remote_filename == "GCF_1_GRCh38_genomic.gtf.gz"
    assert context.sequence_remote_filename == "GCF_1_GRCh38_genomic.fna.gz"


def test_ensembl_release_dirs_current():
    """'current' is a special keyword that maps to the live release paths rather than a versioned path so callers always get the latest data."""
    assert EnsemblGenomicDataBase()._release_dirs("current") == ("pub/current_gtf", "pub/current_fasta")


def test_ensembl_release_dirs_numeric():
    """Numeric releases map to versioned paths so historical data can be fetched without the paths changing when a new release is published."""
    assert EnsemblGenomicDataBase()._release_dirs("110") == ("pub/release-110/gtf", "pub/release-110/fasta")


def test_ensembl_parse_checksum_line():
    """Ensembl uses the BSD `sum` command format (checksum size filename) which differs from NCBI's MD5 format and must be parsed separately."""
    assert EnsemblGenomicDataBase()._parse_checksum_line("12345 678 file.fa.gz") == ("file.fa.gz", "12345")


def test_ensembl_verify_file_uses_sum_command(tmp_path):
    """Ensembl checksums use the `sum` command rather than MD5, so verification must call the right tool or it will always mismatch.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory for the file under verification
    """
    file_path = tmp_path / "file.fa"
    file_path.write_text("AC")
    completed = subprocess.CompletedProcess(["sum"], 0, stdout="123 1 file.fa\n")

    with patch("backend.genomic_databases.subprocess.run", return_value=completed):
        assert EnsemblGenomicDataBase()._verify_file(file_path, "123")
        assert not EnsemblGenomicDataBase()._verify_file(file_path, "999")


def test_ensembl_verify_file_returns_false_on_called_process_error(tmp_path):
    """If the `sum` command is unavailable or exits with an error, verification must return False rather than propagating the exception.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory
    """
    with patch(
        "backend.genomic_databases.subprocess.run", side_effect=subprocess.CalledProcessError(1, "sum")
    ):
        assert not EnsemblGenomicDataBase()._verify_file(tmp_path / "file", "123")


def test_ensembl_get_species_dirs_rewrites_release_dirs_to_fasta():
    """Species listing must navigate to the fasta subdirectory even though the top-level listing uses gtf paths — the two trees are structurally parallel."""
    ftp = FakeFTP(["drwxr-xr-x 2 ftp ftp 4096 Jan 01 00:00 homo_sapiens"])
    db = EnsemblGenomicDataBase(base_path="pub")

    assert db._get_species_dirs(["release-110"], ftp) == [["homo_sapiens"]]
    assert ftp.cwd_calls == ["/pub/release-110/fasta"]


def test_ensembl_build_directory_dict_reverses_species_to_releases():
    """The directory dict must be keyed by species for the dropdown UI, so the release→species FTP structure must be inverted."""
    db = EnsemblGenomicDataBase()
    db.orig_top_dirs = ["release-110", "release-111"]

    assert db._build_directory_dict(["ignored"], [["human"], ["human", "mouse"]]) == {
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
        assert EnsemblGenomicDataBase()._pick_files("ann", "seq") == (
            "Homo_sapiens.GRCh38.110.gtf.gz",
            "Homo_sapiens.GRCh38.dna_sm.primary_assembly.fa.gz",
            "GRCh38.110.gtf",
        )


def test_ensembl_pick_files_errors_without_gtf():
    """A missing GTF means annotation is unavailable; the error must be raised early so the pipeline doesn't proceed without annotation data."""
    with patch("backend.genomic_databases.ftplib.FTP", return_value=FakeFTP(names=["file.fa.gz"])):
        with pytest.raises(RuntimeError, match=r"No \.gtf\.gz"):
            EnsemblGenomicDataBase()._pick_files("ann", "seq")


def test_ensembl_pick_files_errors_without_fasta():
    """A missing FASTA means the sequence is unavailable; the error must be raised early so the pipeline doesn't proceed without sequence data."""
    with patch(
        "backend.genomic_databases.ftplib.FTP", return_value=FakeFTP(names=["Homo_sapiens.GRCh38.110.gtf.gz"])
    ):
        with pytest.raises(RuntimeError, match="No suitable sequence"):
            EnsemblGenomicDataBase()._pick_files("ann", "seq")


def test_ensembl_get_entity_context_builds_dirs_and_metadata():
    """The context must include both remote dirs and metadata so subsequent download and annotation lookup steps don't need to re-navigate the FTP tree."""
    db = EnsemblGenomicDataBase()
    with patch.object(db, "_pick_files", return_value=("ann.gtf.gz", "seq.fa.gz", "GRCh38")):
        context = db.get_entity_context(GenomicEntity(None, "homo_sapiens", "110"))

    assert context.annotation_remote_dir == "pub/release-110/gtf/homo_sapiens"
    assert context.sequence_remote_dir == "pub/release-110/fasta/homo_sapiens/dna"
    assert context.annotation_release == "110"
    assert context.genome_assembly == "GRCh38"


def test_genomic_dropdown_returns_cached_or_fetched_options(client):
    """The dropdown endpoint must return the full nested species/taxa structure so the frontend can populate selection menus without additional calls.

    Arguments:
        client {Any} -- anonymous Flask test client
    """
    with patch(
        "backend.routes.genomic.fetch_dropdown_options", return_value={"ncbi": {"taxon": ["species"]}}
    ):
        response = client.get("/api/genomic/dropdown")

    assert response.status_code == 200
    assert response.get_json() == {"ncbi": {"taxon": ["species"]}}


def test_genomic_releases_returns_release_list(client):
    """The releases endpoint must proxy the FTP listing so the frontend can offer release selection without knowing FTP paths.

    Arguments:
        client {Any} -- anonymous Flask test client
    """
    with patch(
        "backend.routes.genomic.NCBIGenomicDataBase.fetch_annotations_releases",
        return_value=["current", "110"],
    ):
        response = client.get("/api/genomic/releases/taxon/species")

    assert response.status_code == 200
    assert response.get_json() == ["current", "110"]


def test_genomic_releases_returns_404_when_none(client):
    """None from fetch_annotations_releases means the species has no releases on NCBI; 404 prevents the frontend from displaying an empty selection.

    Arguments:
        client {Any} -- anonymous Flask test client
    """
    with patch("backend.routes.genomic.NCBIGenomicDataBase.fetch_annotations_releases", return_value=None):
        response = client.get("/api/genomic/releases/taxon/species")

    assert response.status_code == 404
