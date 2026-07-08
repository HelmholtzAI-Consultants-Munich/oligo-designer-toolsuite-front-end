import datetime
import ftplib
import gzip
import hashlib
import os
import re
import shutil
import subprocess
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from email.utils import formatdate, parsedate_to_datetime
from pathlib import Path
from typing import ClassVar

import requests

from backend.cache import file_cache_region, generic_cache_region
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


class BaseGenomicDataBase(ABC):
    """The base class of genomic databases, our interfaces with public services like Ensembl and NCBI.

    Notes:
        This is a base class and should not be used directly.
        For details on the caching procedure see 'Caching FASTA Files' in the developer documentation.

    Class Variables:
        name {str} -- Name of the genomic database.
        host {str} -- Hostname of the genomic database service.
        base_path {str} -- Path to the subdirectory containing genomic files.
        checksums_filename {str} -- Filename of checksum files for this database.
    """

    name: ClassVar[str]
    host: ClassVar[str]
    base_path: ClassVar[str]
    checksums_filename: ClassVar[str]

    def __init__(
        self,
        cache_dir: Path | None = None,
        allowlist: set[str] | None = None,
    ) -> None:
        """Initializes the BaseGenomicDatabase.

        Notes:
            This is a base class and should only be initialized by subclasses.

        Keyword Arguments:
            cache_dir {Path | None} -- Path to the local directory to use as a download cache. (default: {None})
            allowlist {set[str] | None} -- Set of subdirectories. If provided, queries will be limited to these. (default: {None})
        """
        self.cache_dir = cache_dir
        self.allowlist = allowlist

    # ---- Directory Discovery ----
    def _get_dirs(self, ftp: ftplib.FTP) -> list[str]:
        """Retrieves a list of subdirectories at the current FTP cursor.

        Notes:
            This does not use ftplib.FTP.mlsd as Ensembl's FTP server does not support that option.

        Arguments:
            ftp {ftplib.FTP} -- Active FTP handler.

        Returns:
            list[str] -- list of subdirectories at the current FTP cursor.
        """
        file_lines: list[str] = []
        ftp.dir(file_lines.append)

        def parse_file_line(line: str) -> tuple[str, str]:
            """Parses filename and file permissions from a line returned by ftplib.FTP.dir.

            Arguments:
                line {str} -- Line returned from ftplib.FTP.dir.

            Returns:
                tuple[str, str] -- Tuple of filename and file permissions.
            """
            perms, *_, filename = line.split(maxsplit=8)
            # Normalize file permissions
            perms = perms.lower()
            # The filename might be a symbolic link (e.g. "current_fasta -> release-116/fasta")
            # Split this to just get the link's name (e.g. "current_fasta")
            filename = filename.split(maxsplit=1)[0]
            return filename, perms

        def is_likely_directory(filename: str, perms: str) -> bool:
            """Checks whether a file is likely a directory.

            Notes:
                Returns True for symbolic links if is does not have specific file extensions.
                As this is a very inaccurate heuristic, the function may misclassify symbolic links.

            Arguments:
                filename {str} -- Filename to check.
                perms {str} -- Permissions of the file.

            Returns:
                bool -- Whether the file is likely a directory.
            """
            non_dir_extensions = {"txt", "pdf", "gz"}
            _, _, file_suffix = filename.rpartition(".")

            return perms[0] == "d" or (perms[0] == "l" and file_suffix not in non_dir_extensions)

        dirs = [
            filename
            for filename, perms in map(parse_file_line, file_lines)
            if is_likely_directory(filename, perms)
        ]

        return sorted(dirs)  # sort for determinism

    def _filter_allowlist(self, dirs: list[str]) -> list[str]:
        """Filters the directories according to the allowlist.

        Arguments:
            dirs {list[str]} -- list of directories.

        Returns:
            list[str] -- list of all directories that are also in the allowlist.
        """
        if self.allowlist is not None:
            return sorted(list(set(dirs).intersection(self.allowlist)))
        return dirs

    def _get_species_dirs(self, dirs: list[str], ftp: ftplib.FTP) -> dict[str, list[str]]:
        """Retrieves all subdirectories of all directories in dirs.

        Arguments:
            dirs {list[str]} -- list of directories.
            ftp {ftplib.FTP} -- Active FTP handler.

        Returns:
            dict[str, list[str]] -- dict mapping directories from dirs to their respective subdirectories.
        """
        all_species_dirs: dict[str, list[str]] = {}
        for dir in dirs:
            _ = ftp.cwd(f"/{self.base_path}/{dir}")
            all_species_dirs[dir] = self._get_dirs(ftp)
        return all_species_dirs

    def fetch_ftp_directories(self) -> dict[str, list[str]]:
        """Fetches all available species directories for this genomic database.

        Returns:
            dict[str, list[str]] -- dict mapping top-level directories to their respective subdirectories.
        """
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            ftp.cwd(self.base_path)
            top_dirs = self._get_dirs(ftp)
            top_dirs = self._filter_allowlist(top_dirs)
            species_dirs = self._get_species_dirs(top_dirs, ftp)
        return species_dirs

    # ---- Genomic Asset Fetching ----
    def _download(self, dir: str, remote_filename: str) -> Path:
        """Downloads a remote file if it changed.

        Arguments:
            dir {str} -- Remote directory where the to-be-dowloaded file is located.
            remote_filename {str} -- Name of the remote file to download.

        Notes:
            This function avoids redownloads if the file is already present and up-to-date.
            Since compressed files are deleted after extraction, this does not suffice as
            a caching solution for genomic downloads - see _download_and_process for that.

        Raises:
            RuntimeError: No caching directory set for genomic downloads.

        Returns:
            pathlib.Path -- Local file path of the downloaded resource.
        """
        url = f"https://{self.host}/{dir}/{remote_filename}"
        url_hash = hashlib.md5(url.encode()).hexdigest()

        # Build local file path to save file at
        if self.cache_dir is None:
            raise RuntimeError("No caching directory set for genomic downloads.")
        file_path = (self.cache_dir / self.name / f"{url_hash}-{remote_filename}").resolve()
        file_path.parent.mkdir(parents=True, exist_ok=True)

        headers: dict[str, str] = {}

        # Check whether the file was downloaded before
        if file_path.exists():
            mtime = file_path.stat().st_mtime
            headers["if-modified-since"] = formatdate(mtime, usegmt=True)

        with requests.get(url, headers=headers, stream=True) as response:
            response.raise_for_status()

            if response.status_code == requests.codes.not_modified:
                # Local file is already up-to-date
                return file_path

            if response.status_code == requests.codes.ok:
                # Download the remote file
                with open(file_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=Config.DOWNLOAD_CHUNK_SIZE):
                        f.write(chunk)

                # Set local modification time to remote's 'last-modified' to use for future requests
                if last_modified := response.headers.get("last-modified"):
                    new_mtime = parsedate_to_datetime(last_modified).timestamp()
                    os.utime(file_path, times=(datetime.datetime.now().timestamp(), new_mtime))
        return file_path

    @abstractmethod
    def _matches_checksum(self, file_path: Path, expected_checksum: str) -> bool:
        """Checks whether a file maches the expected checksum.

        Arguments:
            file_path {pathlib.Path} -- Path to a local file.
            expected_checksum {str} -- Expected checksum of the file.

        Notes:
            This is an abstract method and must be implemented by subclasses.

        Returns:
            bool -- Whether the file matches the expected checksum.
        """
        pass

    @file_cache_region.cache_on_arguments()
    def _download_and_process(self, dir: str, remote_filename: str, expected_checksum: str | None) -> Path:
        """Downloads a remote file and processes it as needed.

        Arguments:
            dir {str} -- Remote directory where the to-be-dowloaded file is located.
            remote_filename {str} -- Name of the remote file to download.
            expected_checksum {str | None} -- Expected checksum of the file.

        Notes:
            Processing includes optional verification of a checksum and extraction of .gz files.

            This function is decorated with our file cache to serve as the level 2 cache.
            Since expected_checksum is part of the caching key and the download of checksums
            is not being cached, a redownload will occur if the checksum changes.

        Raises:
            RuntimeError: Checksum for provided file does not match.

        Returns:
            Path -- Local file path of the downloaded resource.
        """
        # Download file
        file_path = self._download(dir, remote_filename)

        # Verify checksum if provided
        if expected_checksum is not None and not self._matches_checksum(file_path, expected_checksum):
            # TODO: we could also retry the download a set amount of times at this point
            raise RuntimeError(f"Checksum for {remote_filename} does not match.")

        # Extract file if extension is .gz
        if file_path.suffix == ".gz":
            extracted_file_path = file_path.with_suffix("")  # remove .gz extension
            with gzip.open(file_path, "rb") as archive:
                with open(extracted_file_path, "wb") as extract:
                    shutil.copyfileobj(archive, extract)

            # Delete compressed file
            file_path.unlink()
            file_path = extracted_file_path

        return file_path

    @abstractmethod
    def get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        """Retrieve context for a genomic entity.

        Arguments:
            entity {GenomicEntity} -- Genomic entity to get context for.

        Notes:
            This is an abstract method and must be implemented by subclasses.

        Returns:
            GenomicEntityContext -- Context for the requested entity.
        """
        pass

    @abstractmethod
    def _parse_checksum_line(self, line: str) -> tuple[str, str] | None:
        """Parse a line of a checksums file.

        Arguments:
            line {str} -- Line of a checksums file.

        Notes:
            This is an abstract method and must be implemented by subclasses.

        Returns:
            tuple[str, str] | None -- tuple of filename and checksum or None if parsing was unsuccessful.
        """
        pass

    def _get_checksum_map(self, context: GenomicEntityContext) -> dict[str, str]:
        """Returns map of filenames to their respective checksum

        Arguments:
            context {GenomicEntityContext} -- Context for the requested entity.

        Returns:
            dict[str, str] -- dict mapping filenames to their respective checksum.
        """
        # Combined checksum map for annotation (GTF) and sequence (FASTA) files
        filename_to_checksum_map: dict[str, str] = {}

        # set -> if the dirs are equal, the checksums are only downloaded once
        for dir in {context.annotation_remote_dir, context.sequence_remote_dir}:
            # Always download without caching in case checksums changed
            checksums_path = self._download(dir, self.checksums_filename)
            with open(checksums_path) as checksums_file:
                for line in checksums_file:
                    if (parsed_line := self._parse_checksum_line(line)) is not None:
                        filename, checksum = parsed_line
                        filename_to_checksum_map[filename] = checksum

        return filename_to_checksum_map

    def _get_checksum(self, checksum_map: dict[str, str], filename: str) -> str:
        """Gets a checksum from a checksum map and handles key errors.

        Arguments:
            checksum_map {dict[str, str]} -- dict mapping filenames to their respective checksum.
            filename {str} -- Name of the file to look up in the checksum map.

        Notes:
            This method's purpose is to map the usual KeyError to a custom RuntimeError
            for easier downstream error catching and handling.

        Raises:
            RuntimeError: File not found in checksum map.

        Returns:
            str -- Checksum of the specified file.
        """
        try:
            return checksum_map[filename]
        except KeyError as e:
            raise RuntimeError(
                f"Required file missing in {self.name}'s {self.checksums_filename}: {e}"
            ) from e

    def fetch_genomic_entity(self, entity: GenomicEntity) -> dict[str, str]:
        """Fetch genomic entity from cache or download it if not cached yet.

        Arguments:
            entity {GenomicEntity} -- Genomic entity to fetch.

        Workflow:
            - Obtain GenomicEntityContext (file names, location, etc.) using subclass-specific implementation.
            - Obtain map of filename-to-checksum from subclass-specific location.
            - For the annotation and sequence files:
                - Verify checksum is known.
                - Download from source, verify checksum of compressed file and extract if possible.

        Raises:
            RuntimeError: No cache_dir was set.
            RuntimeError: A resource cannot be located.
            RuntimeError: A download fails.
            RuntimeError: A checksum cannot be verified.

        Returns:
            dict[str, str] -- dict containing the file paths and the resolved release and assembly.
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
    name: ClassVar[str] = "ensembl"
    host: ClassVar[str] = "ftp.ensembl.org"
    base_path: ClassVar[str] = "/pub/"
    checksums_filename: ClassVar[str] = "CHECKSUMS"

    # release 116 changes structure => could be a problem once they set this to current
    def __init__(
        self,
        cache_dir: Path | None = None,
        allowlist: set[str] | None = None,
    ) -> None:
        super().__init__(cache_dir, allowlist)

    # ---- Directory Discovery ----
    def _get_species_dirs(self, dirs: list[str], ftp: ftplib.FTP) -> dict[str, list[str]]:

        def format_release_dirname(dirname: str) -> str:
            return dirname.removeprefix("release-").removesuffix("/fasta").removesuffix("_fasta")

        def reverse_list_dict(
            species_by_release: dict[str, list[str]], key_formatter: Callable[[str], str]
        ) -> dict[str, list[str]]:
            reversed_dict = defaultdict(list)
            for key, value_list in species_by_release.items():
                for value in value_list:
                    reversed_dict[value].append(key_formatter(key))
            return dict(reversed_dict)

        lookup_dirs = [f"{dir}/fasta" if dir.startswith("release") else dir for dir in dirs]

        species_by_release = super()._get_species_dirs(lookup_dirs, ftp)
        release_by_species = reverse_list_dict(species_by_release, format_release_dirname)

        return release_by_species

    # ---- Genomic Asset Fetching ----
    def _matches_checksum(self, file_path: Path, expected_checksum: str) -> bool:
        """Checks whether a file maches the expected checksum from the CHECKSUMS file using the 'sum' command.

        Arguments:
            file_path {pathlib.Path} -- Path to a local file.
            expected_checksum {str} -- Expected checksum of the file.

        Notes:
            The checksum type used is a 16-bit BSD checksum.
            There does not seem to be a neater Python implementation for this than simply calling the `sum` command.

        Returns:
            bool -- Whether the file matches the expected checksum.
        """
        try:
            result = subprocess.run(["sum", file_path], capture_output=True, check=True, text=True)
            computed_checksum = result.stdout.split()[0]
            return computed_checksum == expected_checksum
        except subprocess.CalledProcessError:
            return False

    def _parse_checksum_line(self, line: str) -> tuple[str, str] | None:
        # returns tuple of file name and its checksum
        checksum, *_, filename = line.strip().split()
        return filename, checksum

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
    name: ClassVar[str] = "ncbi"
    host: ClassVar[str] = "ftp.ncbi.nlm.nih.gov"
    base_path: ClassVar[str] = "genomes/refseq/"
    checksums_filename: ClassVar[str] = "md5checksums.txt"

    def __init__(
        self,
        cache_dir: Path | None = None,
        allowlist: set[str] | None = None,
    ) -> None:
        super().__init__(cache_dir, allowlist)

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

    @generic_cache_region.cache_on_arguments()
    def fetch_annotations_releases(self, taxon: str, species: str) -> list[str] | None:
        """
        Notes:
            This function is decorated with our generic cache to reduce refetching.
        """
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            dir = self._get_releases_dir(ftp, taxon, species)
            if dir is None:
                return None
            dirs = self._get_dirs(ftp)

        if dir == "all_assembly_versions":
            dirs = [dir for dir in dirs if dir != "suppressed"]
        return dirs

    # ---- Genomic Asset Fetching ----
    def _get_assembly_information(self, rel_dir: str, filename: str) -> tuple[str, str]:
        assembly_prefix = "# Assembly name:"
        accession_prefix = "# RefSeq assembly accession:"

        def _extract_identifier(line: str, prefix: str) -> str:
            return "_".join(line.removeprefix(prefix).strip().split())

        # always download without caching since accession of "latest" release could change
        file_path = self._download(rel_dir, filename)
        with open(file_path) as file:
            assembly_name, accession = None, None
            for line in file:
                if line.startswith(assembly_prefix):
                    assembly_name = _extract_identifier(line, assembly_prefix)
                    continue
                if line.startswith(accession_prefix):
                    accession = _extract_identifier(line, accession_prefix)
                    break

        if assembly_name is None:
            raise ValueError("Failed to parse assembly name from assembly report.")

        if accession is None:
            raise ValueError("Failed to parse accession from assembly report.")

        return assembly_name, accession

    def _matches_checksum(self, file_path: Path, expected_checksum: str) -> bool:
        """Checks whether a file maches the expected checksum from the md5checksums.txt file using an md5 hash.

        Arguments:
            file_path {pathlib.Path} -- Path to a local file.
            expected_checksum {str} -- Expected checksum of the file.

        Notes:
            The checksum type used is an md5 hash.

        Returns:
            bool -- Whether the file matches the expected checksum.
        """
        with open(file_path, "rb") as f:
            digest = hashlib.file_digest(f, "md5")

        return digest.hexdigest() == expected_checksum

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


@generic_cache_region.cache_on_arguments()
def fetch_dropdown_options() -> dict[str, dict[str, list[str]]]:
    """
    Notes:
        This function is decorated with our generic cache to reduce refetching.
    """
    # TODO: check allowlists to apply same behaviour like before

    databases = [
        NCBIGenomicDataBase(
            allowlist={"vertebrate_mammalian", "archaea", "invertebrate", "plant"},
        ),
        EnsemblGenomicDataBase(
            allowlist={"current_gtf", "current_fasta", *[f"release-{i}" for i in range(110, 116)]},
        ),
    ]

    return {database.name: database.fetch_ftp_directories() for database in databases}
