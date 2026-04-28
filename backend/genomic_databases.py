import datetime
import ftplib
import gzip
import hashlib
import os
import re
import shutil
import subprocess
from abc import abstractmethod
from collections import defaultdict
from dataclasses import dataclass
from email.utils import formatdate, parsedate_to_datetime
from pathlib import Path

import requests
from filelock import SoftReadWriteLock

from backend.config import Config


@dataclass
class GenomicEntity:
    taxon: str | None
    species: str
    release: str


@dataclass
class GenomicEntityContext:
    annotation_remote_dir: str
    annotation_remote_file_name: str
    sequence_remote_dir: str
    sequence_remote_file_name: str
    annotation_release: str
    genome_assembly: str
    accession: str | None  # Ensembl doesn't use GCF/GCA accessions in filenames


class BaseGenomicDataBase:
    """
    For details on the caching procedure see 'Caching FASTA Files' in the developer documentation.
    """

    def __init__(
        self,
        name: str = "",
        host: str = "",
        base_path: str = "",
        cache_dir: Path | None = None,
        allowlist: list[str] | None = None,
    ) -> None:
        self.name: str = name
        self.host: str = host
        self.base_path: str = base_path
        self.cache_dir = cache_dir
        self.allowlist: set[str] | None = set(allowlist) if allowlist is not None else None

    # ---- Directory Discovery ----
    def _get_dirs(self, ftp: ftplib.FTP) -> list[str]:
        lines: list[str] = []
        _ = ftp.retrlines("LIST", lines.append)

        entries: list[str] = []
        for line in lines:
            parts = line.split(maxsplit=8)
            if len(parts) < 9:
                continue
            if parts[0][0] == "d" or parts[0][0] == "l":
                entries.append(parts[8])
        return sorted(entries)  # sort for determinism

    def _filter_allowlist(self, dirs: list[str]) -> list[str]:
        if self.allowlist is not None:
            return list(set(dirs).intersection(self.allowlist))
        return dirs

    def _get_species_dirs(self, dirs: list[str], ftp: ftplib.FTP) -> list[list[str]]:
        dirs.sort()  # sort for determinism

        all_species_dirs: list[list[str]] = []
        for dir in dirs:
            _ = ftp.cwd(f"/{self.base_path}/{dir}")
            all_species_dirs.extend([self._get_dirs(ftp)])
        return all_species_dirs

    def _build_directory_dict(
        self, top_dirs: list[str], species_dirs: list[list[str]]
    ) -> dict[str, list[str]]:
        return dict(zip(top_dirs, species_dirs))

    def fetch_ftp_directories(self) -> tuple[str, dict[str, list[str]]]:
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            ftp.cwd(self.base_path)
            top_dirs = self._get_dirs(ftp)
            top_dirs = self._filter_allowlist(top_dirs)
            species_dirs = self._get_species_dirs(top_dirs, ftp)
        return self.name, self._build_directory_dict(top_dirs, species_dirs)

    # ---- Genomic Asset Fetching ----
    def _download(self, url: str, file_path: Path) -> None:
        """Downloads the file if it changed."""
        headers: dict[str, str] = {}

        if file_path.exists():
            mtime = file_path.stat().st_mtime
            headers["if-modified-since"] = formatdate(mtime, usegmt=True)

        with requests.get(url, headers=headers, stream=True) as response:
            response.raise_for_status()

            if response.status_code == requests.codes.not_modified:  # type: ignore
                return

            if response.status_code == requests.codes.ok:  # type: ignore
                with open(file_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=Config.DOWNLOAD_CHUNK_SIZE):
                        f.write(chunk)

                if last_modified := response.headers.get("last-modified"):
                    new_mtime = parsedate_to_datetime(last_modified).timestamp()
                    os.utime(file_path, times=(datetime.datetime.now().timestamp(), new_mtime))

    @abstractmethod
    def _verify_file(self, file_path: Path, expected_checksum: str) -> bool:
        pass

    def _download_and_process(self, dir: str, remote_file_name: str, expected_checksum: str | None) -> Path:
        """Downloads the file and processes it as needed.

        Handles:
        - optional verification of checksum
        - uncompression of .gz files

        Returns the new local file path.
        """
        url = f"https://{self.host}/{dir}/{remote_file_name}"
        url_hash = hashlib.md5(url.encode()).hexdigest()
        if self.cache_dir is None:
            raise RuntimeError("No caching directory set for genomic downloads.")
        file_path = (self.cache_dir / self.name / f"{url_hash}-{remote_file_name}").resolve()

        # Acquire lock to avoid downloading the same file multiple times at once
        # "Soft" lock is required for network file systems
        file_lock = SoftReadWriteLock(file_path.with_name(file_path.name + ".lock"))
        with file_lock.write_lock():
            # Download file
            self._download(url, file_path)

            # Verify checksum if provided
            if expected_checksum is not None and not self._verify_file(file_path, expected_checksum):
                raise RuntimeError(f"Checksum for {file_path} does not match")

            # Uncompress file if extension is .gz
            if file_path.suffix == ".gz":
                uncompressed_file_path = file_path.with_suffix("")  # remove .gz extension
                uncompressed_file_lock = SoftReadWriteLock(
                    uncompressed_file_path.with_name(uncompressed_file_path.name + ".lock")
                )
                with uncompressed_file_lock.write_lock(), gzip.open(file_path, "rb") as archive:
                    with open(uncompressed_file_path, "wb") as extract:
                        shutil.copyfileobj(archive, extract)

                # NOTE: The compressed files are currently still kept since the download caching
                #   is based on their file metadata.
                # TODO: Find a neat solution for avoiding redundant files.
                #   Option 1: use separate metadata for download caching
                #   Option 2: don't uncompress files & make genomic region generator handle compressed files
                # # Delete compressed file
                # file_path.unlink()
                file_path = uncompressed_file_path

        return file_path

    @abstractmethod
    def get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        pass

    @abstractmethod
    def _checksum_file_name(self) -> str:
        pass

    @abstractmethod
    def _parse_checksum_line(self, line) -> tuple[str, str] | None:
        pass

    def _get_checksum_map(self, context: GenomicEntityContext) -> dict[str, str]:
        """Returns map of filenames to their respective checksum"""

        # Combined checksum map for gtf and fasta files
        filename_to_checksum_map: dict[str, str] = {}
        checksums_file_name = self._checksum_file_name()

        # set -> if the dirs are equal, the checksums are only downloaded once
        for dir in {context.annotation_remote_dir, context.sequence_remote_dir}:
            checksums_path = self._download_and_process(dir, checksums_file_name, expected_checksum=None)

            file_lock = SoftReadWriteLock(checksums_path.with_name(checksums_path.name + ".lock"))
            with file_lock.acquire_read():
                with open(checksums_path) as checksums_file:
                    for line in checksums_file:
                        if (parsed_line := self._parse_checksum_line(line)) is not None:
                            filename, checksum = parsed_line
                            filename_to_checksum_map[filename] = checksum

        return filename_to_checksum_map

    def _get_checksum(self, checksum_map: dict[str, str], file_name: str) -> str:
        try:
            return checksum_map[file_name]
        except KeyError as e:
            raise RuntimeError(f"Required file missing in md5checksums.txt: {e}") from e

    def fetch_genomic_entity(self, entity: GenomicEntity) -> dict[str, str]:
        """Fetch genomic entity from cache or download it if not cached yet.
        TODO:
        Ensembl:
        URL based cache for Ensembl GTF/FASTA.
        - Resolves 'current' vs numeric release to the right directories.
        - Selects one .gtf.gz and one DNA FASTA (prefers dna_sm.primary_assembly, then primary_assembly, then toplevel).
        - Verifies checksums parsed from CHECKSUMS file using 'sum' command
        - Decompresses downloaded files and returns local paths and metadata.
        NCBI:
        Returns cached, MD5-verified local paths for .gtf and .fna (decompressed),
        plus metadata: release, assembly.
        """

        context = self.get_entity_context(entity)
        checksum_map = self._get_checksum_map(context)

        # Annotation (GTF)
        annotation_checksum = checksum_map[context.annotation_remote_file_name]
        annotation_file = self._download_and_process(
            context.annotation_remote_dir, context.annotation_remote_file_name, annotation_checksum
        )

        # Sequence (FASTA)
        sequence_checksum = checksum_map[context.sequence_remote_file_name]
        sequence_file = self._download_and_process(
            context.sequence_remote_dir, context.sequence_remote_file_name, sequence_checksum
        )

        return {
            "annotation_file": str(annotation_file),
            "sequence_file": str(sequence_file),
            "annotation_release": context.annotation_release,
            "genome_assembly": context.genome_assembly,
        }


class EnsemblGenomicDataBase(BaseGenomicDataBase):
    # release 116 changes structure => could be a problem once they set this to current
    def __init__(
        self,
        name: str = "ensembl",
        host: str = "ftp.ensembl.org",
        base_path: str = "/pub/",
        cache_dir: Path | None = None,
        allowlist: list[str] | None = None,
    ) -> None:
        super().__init__(name, host, base_path, cache_dir, allowlist)
        self.orig_top_dirs = [""]

    # ---- Directory Discovery ----
    def _get_species_dirs(self, dirs: list[str], ftp: ftplib.FTP) -> list[list[str]]:
        self.orig_top_dirs = dirs
        dirs = [f"{dir}/fasta" if dir.startswith("release") else dir for dir in dirs]
        return super()._get_species_dirs(dirs, ftp)

    def _reverse_dict(self, directories: dict) -> dict:
        reversed_directories = defaultdict(list)
        for release, species_dirs in directories.items():
            for species_dir in species_dirs:
                reversed_directories[species_dir].append(release)
        return dict(reversed_directories)

    def _build_directory_dict(
        self, top_dirs: list[str], species_dirs: list[list[str]]
    ) -> dict[str, list[str]]:
        # only use number to list release so e.g. "release-115" -> "115"
        self.orig_top_dirs = [dir[-3:] for dir in self.orig_top_dirs]
        return self._reverse_dict(super()._build_directory_dict(self.orig_top_dirs, species_dirs))

    # ---- Genomic Asset Fetching ----
    def _verify_file(self, file_path: Path, expected_checksum: str) -> bool:
        try:
            result = subprocess.run(["sum", file_path], capture_output=True, check=True, text=True)
            computed_checksum = result.stdout.split()[0]
            return computed_checksum == expected_checksum
        except subprocess.CalledProcessError:
            return False

    def _checksum_file_name(self) -> str:
        return "CHECKSUMS"

    def _parse_checksum_line(self, line: str) -> tuple[str, str] | None:
        # returns tuple of file name and its checksum
        line = line.strip()
        split_line = line.split()
        return split_line[-1], split_line[0]

    def _release_dirs(self, release: str) -> tuple[str, str]:
        """
        Return tuple (gtf_dir, fasta_dir).
        Uses 'current_gtf' and 'current_fasta' when release == 'current',
        otherwise 'pub/release-<rel>/(gtf|fasta)/...'
        """
        if release == "current":
            return ("pub/current_gtf", "pub/current_fasta")
        else:
            return (f"pub/release-{release}/gtf", f"pub/release-{release}/fasta")

    def _pick_files(self, gtf_dir: str, fasta_dir: str) -> tuple[str, str, str]:
        """
        Given fully-qualified remote directories for GTF and DNA FASTA
        (e.g., 'pub/current_gtf/homo_sapiens' and 'pub/current_fasta/homo_sapiens/dna'),
        choose one .gtf.gz and one .fa.gz. Prefer primary_assembly for FASTA; fallback to toplevel.
        Returns (gtf_filename, fasta_filename, assembly_name).
        """
        with ftplib.FTP(self.host) as ftp:
            ftp.login()

            # GTF directory (already includes species)
            ftp.cwd(gtf_dir)
            gtf_listing = ftp.nlst()
            gtf_gz = None
            for name in sorted(gtf_listing):  # sort for determinism
                # ends with NUMBER.gtf.gz
                if re.search(r"^.+\.\d+\.gtf.gz$", name):
                    gtf_gz = name
                    break
            if not gtf_gz:
                raise RuntimeError(f"No .gtf.gz found in {gtf_dir}")

            # Try to parse assembly from GTF filename: e.g., Homo_sapiens.GRCh38.110.gtf.gz
            asm_match = re.match(r"^[A-Za-z_]+\.([A-Za-z0-9\.]+)\.", gtf_gz)
            assembly_from_gtf = asm_match.group(1) if asm_match else None

            # FASTA directory (already includes species + dna)
            ftp.cwd(f"/{fasta_dir}")
            fa_listing = sorted(ftp.nlst())  # sort for determinism

            fasta_gz = None
            suffix_precedence = [
                ".dna_sm.primary_assembly.fa.gz",
                ".dna.primary_assembly.fa.gz",
                ".dna_sm.toplevel.fa.gz",
                ".dna.toplevel.fa.gz",
            ]
            for suffix in suffix_precedence:
                for name in fa_listing:
                    if name.endswith(suffix):
                        fasta_gz = name
                        break
                if fasta_gz:
                    break

            if not fasta_gz:
                raise RuntimeError(
                    f"No suitable DNA FASTA found in {fasta_dir} (tried primary_assembly and toplevel, with dna_sm and dna)."
                )

            # Try to parse assembly from FASTA filename: Homo_sapiens.GRCh38.dna.primary_assembly.fa.gz
            asm_match_fa = re.match(r"^[A-Za-z_]+\.([A-Za-z0-9\.]+)\.dna\.", fasta_gz)
            assembly_from_fa = asm_match_fa.group(1) if asm_match_fa else None

        # Prefer assembly parsed from FASTA; otherwise fallback to GTF-derived
        assembly = assembly_from_fa or assembly_from_gtf or "unknown"

        return gtf_gz, fasta_gz, assembly

    def get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        annotation_remote_root_dir, sequence_remote_root_dir = self._release_dirs(entity.release)

        annotation_remote_dir = f"{annotation_remote_root_dir}/{entity.species}"
        sequence_remote_dir = f"{sequence_remote_root_dir}/{entity.species}/dna"
        annotation_release = entity.release

        # Resolve filenames and assembly
        annotation_remote_file_name, sequence_remote_file_name, genome_assembly = self._pick_files(
            annotation_remote_dir, sequence_remote_dir
        )

        return GenomicEntityContext(
            annotation_remote_dir,
            annotation_remote_file_name,
            sequence_remote_dir,
            sequence_remote_file_name,
            annotation_release,
            genome_assembly,
            accession=None,
        )


class NCBIGenomicDataBase(BaseGenomicDataBase):
    def __init__(
        self,
        name: str = "ncbi",
        host: str = "ftp.ncbi.nlm.nih.gov",
        base_path: str = "genomes/refseq/",
        cache_dir: Path | None = None,
        allowlist: list[str] | None = None,
    ) -> None:
        super().__init__(name, host, base_path, cache_dir, allowlist)

    # ---- Directory Discovery ----
    def _try_change_directory(self, ftp: ftplib.FTP, taxon: str, species: str, dir: str) -> str | None:
        try:
            return ftp.cwd(f"/{self.base_path}/{taxon}/{species}/{dir}")
        except ftplib.Error:
            return None

    def _get_releases_dir(self, ftp: ftplib.FTP, taxon: str, species: str) -> str | None:
        possible_dirs = ["annotation_releases", "all_assembly_versions"]

        for dir in possible_dirs:
            if self._try_change_directory(ftp, taxon, species, dir) is not None:
                return dir

        return None

    def fetch_annotations_releases(self, taxon: str, species: str) -> list[str] | None:
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            dir = self._get_releases_dir(ftp, taxon, species)
            if dir is None:
                return None
            dirs = self._get_dirs(ftp)

        # split to avoid including locations that symbolic links point to in the list so "current -> test/4711" -> "current"
        dirs = [dir.split(maxsplit=1)[0] for dir in dirs]
        if dir == "all_assembly_versions":
            dirs = [dir for dir in dirs if dir != "suppressed"]
        return dirs

    # ---- Genomic Asset Fetching ----
    def _get_assembly_information(self, rel_dir: str, file_name: str) -> tuple[str | None, str | None]:
        file_path = self._download_and_process(rel_dir, file_name, expected_checksum=None)

        file_lock = SoftReadWriteLock(file_path.with_name(file_path.name + ".lock"))
        with file_lock.acquire_read():
            with open(file_path) as file:
                assembly_name, accession = None, None
                for line in file:
                    if line.startswith("# Assembly name:"):
                        _, assembly_name = line.strip().rsplit(maxsplit=1)
                    if line.startswith("# RefSeq assembly accession:"):
                        _, accession = line.strip().rsplit(maxsplit=1)
                        break
            return assembly_name, accession

    def _verify_file(self, file_path: Path, expected_checksum: str) -> bool:
        with open(file_path, "rb") as f:
            digest = hashlib.file_digest(f, "md5")

        return digest.hexdigest() == expected_checksum

    def _checksum_file_name(self) -> str:
        return "md5checksums.txt"

    def _parse_checksum_line(self, line: str) -> tuple[str, str] | None:
        # Lines like: "<md5>  ./GCF_..._genomic.gtf.gz"
        line = line.strip()
        if not line:
            return None
        split_line = line.split()
        if len(split_line) < 2:
            return None
        checksum = split_line[0]
        filename = split_line[1].lstrip("./")
        return filename, checksum

    def _resolve_release_and_dir(self, entity: GenomicEntity) -> tuple[str, str, str, str]:
        # Resolve "current" to a concrete release; also read README to get assembly/accession
        if entity.taxon is None:
            raise ValueError("NCBI requires specifying a taxon but none was provided.")

        with ftplib.FTP(self.host) as ftp:
            ftp.login()

            releases_dir = self._get_releases_dir(ftp, entity.taxon, entity.species)
            if releases_dir is None:
                raise RuntimeError("Could not fetch release dir")
            base = f"/{self.base_path}{entity.taxon}/{entity.species}/{releases_dir}/"
            rel_dir = base + f"{entity.release}/"

            ftp.cwd(rel_dir)

            if "GCF" not in entity.release:
                listing = self._get_dirs(ftp)
                if not listing:
                    raise RuntimeError("Empty 'current' directory at NCBI.")

                old_release = entity.release
                entity.release = listing[0]

                rel_dir = base + f"{old_release}/{entity.release}"
                ftp.cwd(entity.release)

            # find README
            assembly_report = min((n for n in ftp.nlst() if n.endswith("_assembly_report.txt")), default=None)
            if not assembly_report:
                raise RuntimeError(f"No assembly report found in {rel_dir}")

        assembly_name, accession = self._get_assembly_information(rel_dir, assembly_report)
        if not assembly_name or not accession:
            raise RuntimeError("Failed to parse assembly/accession from README.")

        nested = f"{rel_dir}{accession}_{assembly_name}/"

        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            try:
                ftp.cwd(nested)
                final_dir = nested
            except ftplib.error_perm:
                final_dir = rel_dir
        return entity.release, assembly_name, accession, final_dir

    def get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        annotation_release, genome_assembly, accession, remote_dir = self._resolve_release_and_dir(entity)

        annotation_remote_dir = sequence_remote_dir = remote_dir
        annotation_remote_file_name = f"{accession}_{genome_assembly}_genomic.gtf.gz"
        sequence_remote_file_name = f"{accession}_{genome_assembly}_genomic.fna.gz"

        return GenomicEntityContext(
            annotation_remote_dir,
            annotation_remote_file_name,
            sequence_remote_dir,
            sequence_remote_file_name,
            annotation_release,
            genome_assembly,
            accession,
        )


def prefetch_dropdown_options():
    # TODO: check allowlists to apply same behaviour like before

    return dict(
        [
            NCBIGenomicDataBase(
                allowlist=["vertebrate_mammalian", "archaea", "invertebrate", "plant"],
            ).fetch_ftp_directories(),
            EnsemblGenomicDataBase(
                allowlist=["current_gtf", "current_fasta", *[f"release-{i}" for i in range(110, 116)]],
            ).fetch_ftp_directories(),
        ]
    )
