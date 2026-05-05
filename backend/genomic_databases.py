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

from backend.cache import file_cache_region
from backend.config import Config


@dataclass
class GenomicEntity:
    taxon: str | None
    species: str
    release: str


@dataclass
class GenomicEntityContext:
    annotation_remote_dir: str
    annotation_remote_filename: str
    sequence_remote_dir: str
    sequence_remote_filename: str
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
    def _download(self, dir: str, remote_filename: str) -> Path:
        """Downloads the file if it changed.

        Notes:
            This function avoids redownloads if the file is already present and up-to-date.
            Since compressed files are deleted after decompression, this does not suffice as
            a caching solution for genomic downloads - see _download_and_process for that.

        Returns:
            pathlib.Path -- The local file path of the downloaded resource.
        """
        url = f"https://{self.host}/{dir}/{remote_filename}"
        url_hash = hashlib.md5(url.encode()).hexdigest()
        if self.cache_dir is None:
            raise RuntimeError("No caching directory set for genomic downloads.")
        file_path = (self.cache_dir / self.name / f"{url_hash}-{remote_filename}").resolve()
        file_path.parent.mkdir(parents=True, exist_ok=True)

        headers: dict[str, str] = {}

        if file_path.exists():
            mtime = file_path.stat().st_mtime
            headers["if-modified-since"] = formatdate(mtime, usegmt=True)

        with requests.get(url, headers=headers, stream=True) as response:
            response.raise_for_status()

            if response.status_code == requests.codes.not_modified:  # type: ignore
                return file_path

            if response.status_code == requests.codes.ok:  # type: ignore
                with open(file_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=Config.DOWNLOAD_CHUNK_SIZE):
                        f.write(chunk)

                if last_modified := response.headers.get("last-modified"):
                    new_mtime = parsedate_to_datetime(last_modified).timestamp()
                    os.utime(file_path, times=(datetime.datetime.now().timestamp(), new_mtime))
        return file_path

    @abstractmethod
    def _verify_file(self, file_path: Path, expected_checksum: str) -> bool:
        pass

    @file_cache_region.cache_on_arguments()
    def _download_and_process(self, dir: str, remote_filename: str, expected_checksum: str | None) -> Path:
        """Downloads the file and processes it as needed.

        Handles:
            - Optional verification of checksum.
            - Uncompression of .gz files.

        Notes:
            This function is decorated with our file cache to serve as the level 2 cache.
            Since expected_checksum is part of the caching key and the download of checksums
            is not being cached, a redownload will occur if the checksum changes.

        Returns:
            pathlib.Path -- The local file path of the downloaded resource.
        """
        # Download file
        file_path = self._download(dir, remote_filename)

        # Verify checksum if provided
        if expected_checksum is not None and not self._verify_file(file_path, expected_checksum):
            # TODO: we could also retry the download a set amount of times at this point
            raise RuntimeError(f"Checksum for {file_path} does not match.")

        # Uncompress file if extension is .gz
        if file_path.suffix == ".gz":
            uncompressed_file_path = file_path.with_suffix("")  # remove .gz extension
            with gzip.open(file_path, "rb") as archive:
                with open(uncompressed_file_path, "wb") as extract:
                    shutil.copyfileobj(archive, extract)

            # Delete compressed file
            file_path.unlink()
            file_path = uncompressed_file_path

        return file_path

    @abstractmethod
    def get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        pass

    @abstractmethod
    def _checksum_filename(self) -> str:
        pass

    @abstractmethod
    def _parse_checksum_line(self, line) -> tuple[str, str] | None:
        pass

    def _get_checksum_map(self, context: GenomicEntityContext) -> dict[str, str]:
        """Returns map of filenames to their respective checksum"""

        # Combined checksum map for annotation (GTF) and sequence (FASTA) files
        filename_to_checksum_map: dict[str, str] = {}
        checksums_filename = self._checksum_filename()

        # set -> if the dirs are equal, the checksums are only downloaded once
        for dir in {context.annotation_remote_dir, context.sequence_remote_dir}:
            # always download without caching in case checksums changed
            checksums_path = self._download(dir, checksums_filename)
            with open(checksums_path) as checksums_file:
                for line in checksums_file:
                    if (parsed_line := self._parse_checksum_line(line)) is not None:
                        filename, checksum = parsed_line
                        filename_to_checksum_map[filename] = checksum

        return filename_to_checksum_map

    def _get_checksum(self, checksum_map: dict[str, str], filename: str) -> str:
        try:
            return checksum_map[filename]
        except KeyError as e:
            raise RuntimeError(
                f"Required file missing in {self.name}'s {self._checksum_filename()}: {e}"
            ) from e

    def fetch_genomic_entity(self, entity: GenomicEntity) -> dict[str, str]:
        """Fetch genomic entity from cache or download it if not cached yet.

        Workflow:
            - Obtain GenomicEntityContext (file names, location, etc.) using subclass-specific implementation.
            - Obtain map of filename-to-checksum from subclass-specific location.
            - For the annotation and sequence files:
                - Verify checksum is known.
                - Download from source, verify checksum of compressed file and uncompress if possible.

        Raises:
            RuntimeError: No cache_dir was set.
            RuntimeError: A resource cannot be located.
            RuntimeError: A download fails.
            RuntimeError: A checksum cannot be verified.

        Returns:
            dict[str, str] -- A dict containing the file paths and the resolved release and assembly.
        """

        context = self.get_entity_context(entity)
        checksum_map = self._get_checksum_map(context)

        # Annotation (GTF)
        annotation_checksum = self._get_checksum(checksum_map, context.annotation_remote_filename)
        annotation_file = self._download_and_process(
            context.annotation_remote_dir, context.annotation_remote_filename, annotation_checksum
        )

        # Sequence (FASTA)
        sequence_checksum = self._get_checksum(checksum_map, context.sequence_remote_filename)
        sequence_file = self._download_and_process(
            context.sequence_remote_dir, context.sequence_remote_filename, sequence_checksum
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
        """Verifies checksums parsed from CHECKSUMS file using 'sum' command.

        Notes:
            The checksum type used is a 16-bit BSD checksum.
            There does not seem to be a neater Python implementation for this than simply calling the `sum` command.
        """
        try:
            result = subprocess.run(["sum", file_path], capture_output=True, check=True, text=True)
            computed_checksum = result.stdout.split()[0]
            return computed_checksum == expected_checksum
        except subprocess.CalledProcessError:
            return False

    def _checksum_filename(self) -> str:
        return "CHECKSUMS"

    def _parse_checksum_line(self, line: str) -> tuple[str, str] | None:
        # returns tuple of file name and its checksum
        line = line.strip()
        split_line = line.split()
        return split_line[-1], split_line[0]

    def _release_dirs(self, release: str) -> tuple[str, str]:
        """Resolves 'current' vs numeric release to the right directories.

        Notes:
            Uses 'current_gtf' and 'current_fasta' when release == 'current',
            otherwise 'pub/release-<rel>/(gtf|fasta)/...'

        Returns:
            tuple[str, str] -- (annotation_remote_dir, sequence_remote_dir)
        """
        if release == "current":
            return ("pub/current_gtf", "pub/current_fasta")
        else:
            return (f"pub/release-{release}/gtf", f"pub/release-{release}/fasta")

    def _pick_files(self, annotation_remote_dir: str, sequence_remote_dir: str) -> tuple[str, str, str]:
        """Chooses annotation (GTF) and sequence (FASTA) files from specified remote directories.

        Notes:
            Chooses one .gtf.gz file and one .fa.gz file out of potentially multiple
            matching files in the respective directories.
            Prefers primary_assembly for annotation (FASTA) with toplevel as fallback.

        Returns:
            tuple[str, str, str] -- (annotation_filename, sequence_filename, genome_assembly)
        """
        with ftplib.FTP(self.host) as ftp:
            ftp.login()

            # Annotation (GTF) directory (already includes species)
            ftp.cwd(annotation_remote_dir)
            annotation_dir_listing = ftp.nlst()
            annotation_filename = None
            for name in sorted(annotation_dir_listing):  # sort for determinism
                # ends with NUMBER.gtf.gz
                if re.search(r"^.+\.\d+\.gtf.gz$", name):
                    annotation_filename = name
                    break
            if not annotation_filename:
                raise RuntimeError(f"No .gtf.gz found in {annotation_remote_dir}")

            # Try to parse assembly from annotation filename: e.g. Homo_sapiens.GRCh38.110.gtf.gz
            assembly_from_annotation_match = re.match(r"^[A-Za-z_]+\.([A-Za-z0-9\.]+)\.", annotation_filename)
            assembly_from_annotation = (
                assembly_from_annotation_match.group(1) if assembly_from_annotation_match else None
            )

            # Sequence (FASTA) directory (already includes species + dna)
            ftp.cwd(f"/{sequence_remote_dir}")
            sequence_dir_listing = sorted(ftp.nlst())  # sort for determinism

            sequence_filename = None
            suffix_precedence = [
                ".dna_sm.primary_assembly.fa.gz",
                ".dna.primary_assembly.fa.gz",
                ".dna_sm.toplevel.fa.gz",
                ".dna.toplevel.fa.gz",
            ]
            for suffix in suffix_precedence:
                for name in sequence_dir_listing:
                    if name.endswith(suffix):
                        sequence_filename = name
                        break
                if sequence_filename:
                    break

            if not sequence_filename:
                raise RuntimeError(
                    f"No suitable sequence (FASTA) file found in {sequence_remote_dir} (tried primary_assembly and toplevel, with dna_sm and dna)."
                )

            # Try to parse assembly from sequence filename: e.g. Homo_sapiens.GRCh38.dna.primary_assembly.fa.gz
            assembly_from_sequence_match = re.match(
                r"^[A-Za-z_]+\.([A-Za-z0-9\.]+)\.dna\.", sequence_filename
            )
            assembly_from_sequence = (
                assembly_from_sequence_match.group(1) if assembly_from_sequence_match else None
            )

        # Prefer assembly parsed from sequence; annotation-based as fallback
        genome_assembly = assembly_from_sequence or assembly_from_annotation or "unknown"

        return annotation_filename, sequence_filename, genome_assembly

    def get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        annotation_remote_root_dir, sequence_remote_root_dir = self._release_dirs(entity.release)

        annotation_remote_dir = f"{annotation_remote_root_dir}/{entity.species}"
        sequence_remote_dir = f"{sequence_remote_root_dir}/{entity.species}/dna"
        annotation_release = entity.release

        # Resolve filenames and assembly
        annotation_remote_filename, sequence_remote_filename, genome_assembly = self._pick_files(
            annotation_remote_dir, sequence_remote_dir
        )

        return GenomicEntityContext(
            annotation_remote_dir,
            annotation_remote_filename,
            sequence_remote_dir,
            sequence_remote_filename,
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
    def _get_assembly_information(self, rel_dir: str, filename: str) -> tuple[str | None, str | None]:
        # always download without caching since accession of "latest" release could change
        file_path = self._download(rel_dir, filename)
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

    def _checksum_filename(self) -> str:
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
        annotation_remote_filename = f"{accession}_{genome_assembly}_genomic.gtf.gz"
        sequence_remote_filename = f"{accession}_{genome_assembly}_genomic.fna.gz"

        return GenomicEntityContext(
            annotation_remote_dir,
            annotation_remote_filename,
            sequence_remote_dir,
            sequence_remote_filename,
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
