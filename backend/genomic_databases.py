"""Shared file for retrieving genomic resources using genomic databases."""

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
from typing import ClassVar, override

import requests

from backend.cache import file_cache_region, generic_cache_region
from backend.config import Config


@dataclass(frozen=True)
class GenomicEntity:
    """Genomic entity for use with genomic databases."""

    taxon: str | None
    species: str
    release: str


@dataclass(frozen=True)
class GenomicEntityContext:
    """Context about a genomic entity for genomic databases."""

    annotation_remote_dir: str
    annotation_remote_filename: str
    sequence_remote_dir: str
    sequence_remote_filename: str
    annotation_release: str
    genome_assembly: str
    accession: str | None  # Ensembl doesn't use GCF/GCA accessions in filenames


class BaseGenomicDatabase(ABC):
    """The base class of genomic databases, which serve as our interfaces with public services like Ensembl and NCBI.

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
        """Initializes the genomic database.

        Keyword Arguments:
            cache_dir {pathlib.Path | None} -- Path to the local directory to use as a download cache. (default: {None})
            allowlist {set[str] | None} -- Set of subdirectories. If provided, queries will be limited to these. (default: {None})
        """
        self.cache_dir = cache_dir
        self.allowlist = allowlist

    # ---- Directory Discovery ----
    def _get_subdirs(self, ftp: ftplib.FTP) -> list[str]:
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
                tuple[str, str] -- (filename, file permissions).
            """
            perms, *_, filename = line.split(maxsplit=8)
            # Normalize file permissions
            perms = perms.lower()
            # The filename might be a symbolic link (e.g. "current -> release-116")
            # Split this to just get the link's name (e.g. "current")
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
            return sorted(list(set(dirs).intersection(self.allowlist)))  # sort for determinism
        return dirs

    def _get_subdirectories(self, dirs: list[str], ftp: ftplib.FTP) -> dict[str, list[str]]:
        """Retrieves all subdirectories of all directories in dirs.

        Arguments:
            dirs {list[str]} -- list of directories.
            ftp {ftplib.FTP} -- Active FTP handler.

        Returns:
            dict[str, list[str]] -- dict mapping directories from dirs to their respective subdirectories.
        """
        subdirectories_by_directory: dict[str, list[str]] = {}
        for dir in dirs:
            _ = ftp.cwd(f"{self.base_path}/{dir}")
            subdirectories_by_directory[dir] = self._get_subdirs(ftp)
        return subdirectories_by_directory

    @abstractmethod
    def _build_species_mapping(self, species_dirs: dict[str, list[str]]) -> dict[str, list[str]]:
        """Builds the result of fetch_species_mapping.

        Arguments:
            species_dirs {dict[str, list[str]]} -- dict mapping directories their respective subdirectories.

        Notes:
            This is an abstract method and must be implemented by subclasses.

        Returns:
            dict[str, list[str]] -- dict mapping genomic categories to specific variants.
        """
        pass

    def fetch_species_mapping(self) -> dict[str, list[str]]:
        """Fetches all available species for this genomic database.

        Notes:
            For Ensembl, this returns a dict mapping species to their available annotation releases.
            For NCBI, this returns a dict mapping taxons to their respective species.
            This may be confusing and is unfortunate from a maintainability standpoint.

        Returns:
            dict[str, list[str]] -- dict mapping genomic categories to specific variants.
        """
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            ftp.cwd(self.base_path)
            top_dirs = self._get_subdirs(ftp)
            top_dirs = self._filter_allowlist(top_dirs)
            species_dirs = self._get_subdirectories(top_dirs, ftp)
        return self._build_species_mapping(species_dirs)

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
            pathlib.Path -- Local file path of the downloaded resource.
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
    def _get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        """Retrieves context for a genomic entity.

        Arguments:
            entity {GenomicEntity} -- Genomic entity to get context for.

        Notes:
            This is an abstract method and must be implemented by subclasses.

        Returns:
            GenomicEntityContext -- Context for the requested entity.
        """
        pass

    def _parse_checksum_line(self, line: str) -> tuple[str, str]:
        """Parses a line of a checksums file.

        Arguments:
            line {str} -- Line of a checksums file.

        Notes:
            Expects checksum lines to start with a checksum and end in a filename with
            an arbitrary amount of other data points inbetween, separated by whitespace.
            If filenames start with "./", this prefix will be removed.

            Subclasses may want to override this method for their specific checksums file format.

        Raises:
            ValueError: Parsing was unsuccessful.

        Returns:
            tuple[str, str] -- (filename, checksum).
        """
        checksum, *_, filename = line.strip().split()
        filename = filename.removeprefix("./")
        return filename, checksum

    def _get_checksum_map(self, context: GenomicEntityContext) -> dict[str, str]:
        """Returns map of filenames to their respective checksum.

        Arguments:
            context {GenomicEntityContext} -- Context for the requested entity.

        Returns:
            dict[str, str] -- dict mapping filenames to their respective checksum.
        """
        # Combined checksum map for annotation (GTF) and sequence (FASTA) files
        filename_to_checksum_map: dict[str, str] = {}

        # Use a set for both directories -> if they are equal, the checksums are only downloaded once
        for dir in {context.annotation_remote_dir, context.sequence_remote_dir}:
            # Always download without caching in case checksums changed
            checksums_path = self._download(dir, self.checksums_filename)
            with open(checksums_path) as checksums_file:
                for line in checksums_file:
                    try:
                        filename, checksum = self._parse_checksum_line(line)
                        filename_to_checksum_map[filename] = checksum
                    except ValueError:
                        pass

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
        """Fetches genomic entity from cache or downloads it if not cached yet.

        Arguments:
            entity {GenomicEntity} -- Genomic entity to fetch.

        Raises:
            RuntimeError: No cache_dir was set.
            RuntimeError: A resource cannot be located.
            RuntimeError: A download fails.
            RuntimeError: A checksum cannot be verified.

        Returns:
            dict[str, str] -- dict containing the file paths and the resolved release and assembly.
        """

        # Obtain GenomicEntityContext (file names, location, etc.) using subclass-specific implementation
        context = self._get_entity_context(entity)
        # Obtain filename-to-checksum map
        checksum_map = self._get_checksum_map(context)

        # --- Annotation (GTF) ---
        # Verify checksum is known
        annotation_checksum = self._get_checksum(checksum_map, context.annotation_remote_filename)
        # Download from source, verify checksum of compressed file and extract if necessary
        annotation_file = self._download_and_process(
            context.annotation_remote_dir, context.annotation_remote_filename, annotation_checksum
        )

        # --- Sequence (FASTA) ---
        # Verify checksum is known
        sequence_checksum = self._get_checksum(checksum_map, context.sequence_remote_filename)
        # Download from source, verify checksum of compressed file and extract if necessary
        sequence_file = self._download_and_process(
            context.sequence_remote_dir, context.sequence_remote_filename, sequence_checksum
        )

        return {
            "annotation_file": str(annotation_file),
            "sequence_file": str(sequence_file),
            "annotation_release": context.annotation_release,
            "genome_assembly": context.genome_assembly,
        }


class EnsemblGenomicDatabase(BaseGenomicDatabase):
    """A genomic database to interface with Ensembl."""

    name: ClassVar[str] = "ensembl"
    host: ClassVar[str] = "ftp.ensembl.org"
    base_path: ClassVar[str] = "/pub"
    checksums_filename: ClassVar[str] = "CHECKSUMS"

    # ---- Directory Discovery ----
    @override
    def _get_subdirectories(self, dirs: list[str], ftp: ftplib.FTP) -> dict[str, list[str]]:
        """Retrieves all species for each release directory in dirs.

        Arguments:
            dirs {list[str]} -- list of release directories.
            ftp {ftplib.FTP} -- Active FTP handler.

        Returns:
            dict[str, list[str]] -- dict mapping releases from dirs to their respective species.
        """
        lookup_dirs = [f"{dir}/fasta" for dir in dirs]
        return super()._get_subdirectories(lookup_dirs, ftp)

    @override
    def _build_species_mapping(self, species_dirs: dict[str, list[str]]) -> dict[str, list[str]]:
        """Builds the result of fetch_species_mapping.

        Arguments:
            species_dirs {list[str]} -- dict mapping release directories to their respective species.

        Returns:
            dict[str, list[str]] -- dict mapping species to their available annotation releases.
        """

        def format_release_name(release_name: str) -> str:
            """Formats the release naming such that numeric releases are reduced to the plain number.

            Arguments:
                release_name {str} -- Name of the release to format.

            Returns:
                str -- Formatted release name.
            """
            return release_name.removeprefix("release-").removesuffix("/fasta")

        def reverse_list_dict(
            original_dict: dict[str, list[str]], key_formatter: Callable[[str], str]
        ) -> dict[str, list[str]]:
            """Reverses a dict of lists such that each list element is mapped to a list of keys it's contained in.

            Arguments:
                original_dict {dict[str, list[str]]} -- dict of lists.
                key_formatter {Callable[[str], str]} -- Function that formats keys before they are added to a result list.

            Returns:
                dict[str, list[str]] -- Reversed dict.
            """
            reversed_dict = defaultdict(list)
            for key, value_list in original_dict.items():
                for value in value_list:
                    reversed_dict[value].append(key_formatter(key))
            return dict(reversed_dict)

        # Turn version->list-of-species map into species->list-of-versions map
        return reverse_list_dict(species_dirs, format_release_name)

    # ---- Genomic Asset Fetching ----
    @override
    def _matches_checksum(self, file_path: Path, expected_checksum: str) -> bool:
        """Checks whether a file maches the expected checksum from the CHECKSUMS file using the 'sum' command.

        Arguments:
            file_path {pathlib.Path} -- Path to a local file.
            expected_checksum {str} -- Expected checksum of the file.

        Notes:
            The checksum type used is a 16-bit BSD checksum. There does not seem to be a
            neater Python implementation for this than simply calling the `sum` command.

        Returns:
            bool -- Whether the file matches the expected checksum.
        """
        try:
            result = subprocess.run(["sum", file_path], capture_output=True, check=True, text=True)
            computed_checksum = result.stdout.split(maxsplit=1)[0]
            return computed_checksum == expected_checksum
        except subprocess.CalledProcessError:
            return False

    def _pick_files(self, annotation_remote_dir: str, sequence_remote_dir: str) -> tuple[str, str, str]:
        """Chooses annotation (GTF) and sequence (FASTA) files from specified remote directories.

        Arguments:
            annotation_remote_dir {str} -- Remote directory containing annotation files.
            sequence_remote_dir {str} -- Remote directory containing sequence files.

        Notes:
            Chooses one .gtf.gz file and one .fa.gz file out of potentially multiple
            matching files in the respective directories using heuristics.

        Raises:
            RuntimeError: No suitable annotation (GTF) file found in remote annotation directory.
            RuntimeError: No suitable sequence (FASTA) file found in remote sequence directory.

        Returns:
            tuple[str, str, str] -- (annotation_filename, sequence_filename, genome_assembly)
        """

        def select_annotation_file(filenames: list[str]) -> str:
            """Select annotation (GTF) file from candidates based on filenames.

            Arguments:
                filenames {list[str]} -- list of filenames to select annotation file from.

            Raises:
                RuntimeError: No suitable annotation (GTF) file found in remote annotation directory.

            Returns:
                str -- Chosen filename.
            """
            filenames.sort()  # sort for determinism
            for name in filenames:
                # Take first filename that ends with NUMBER.gtf.gz
                if re.search(r"\d+\.gtf.gz$", name):
                    return name
            raise RuntimeError(f"No suitable annotation (GTF) file found in {annotation_remote_dir}.")

        def select_sequence_file(filenames: list[str]) -> str:
            """Select sequence (FASTA) file from candidates based on filenames.

            Arguments:
                filenames {list[str]} -- list of filenames to select sequence file from.

            Notes:
                Prefers filenames containing "primary_assembly", choosing filenames containing
                "toplevel" as a fallback. Also prefers soft-masked sequences over unmasked sequences.

                For more information on the differences between these builds, see
                https://bioinformatics.stackexchange.com/questions/540/what-ensembl-genome-version-should-i-use-for-alignments-e-g-toplevel-fa-vs-p

            Raises:
                RuntimeError: No suitable sequence (FASTA) file found in remote sequence directory.

            Returns:
                str -- Chosen filename.
            """
            suffix_precedence = [
                ".dna_sm.primary_assembly.fa.gz",
                ".dna.primary_assembly.fa.gz",
                ".dna_sm.toplevel.fa.gz",
                ".dna.toplevel.fa.gz",
            ]
            filenames.sort()  # sort for determinism
            for suffix in suffix_precedence:
                for name in sorted(filenames):
                    if name.endswith(suffix):
                        return name
            raise RuntimeError(
                f"No suitable sequence (FASTA) file found in {sequence_remote_dir} (tried primary_assembly and toplevel, with dna_sm and dna)."
            )

        with ftplib.FTP(self.host) as ftp:
            ftp.login()

            # Select annotation (GTF) file
            ftp.cwd(annotation_remote_dir)
            annotation_dir_listing = ftp.nlst()
            annotation_filename = select_annotation_file(annotation_dir_listing)

            # Try to parse assembly from annotation filename
            # e.g. Homo_sapiens.GRCh38.116.gtf.gz -> GRCh38
            # e.g. Acanthochromis_polyacanthus.ASM210954v1.116.gtf.gz -> ASM210954v1
            assembly_from_annotation_match = re.match(r"^[A-Za-z_]+\.(.+)\.\d+", annotation_filename)
            assembly_from_annotation = (
                assembly_from_annotation_match.group(1) if assembly_from_annotation_match else None
            )

            # Select sequence (FASTA) file
            ftp.cwd(sequence_remote_dir)
            sequence_dir_listing = sorted(ftp.nlst())  # sort for determinism
            sequence_filename = select_sequence_file(sequence_dir_listing)

            # Try to parse assembly from sequence filename
            # e.g. Homo_sapiens.GRCh38.dna.primary_assembly.fa.gz -> GRCh38
            # e.g. Acanthochromis_polyacanthus.ASM210954v1.dna.toplevel.fa.gz -> ASM210954v1
            assembly_from_sequence_match = re.match(r"^[A-Za-z_]+\.(.+)\.dna\.", sequence_filename)
            assembly_from_sequence = (
                assembly_from_sequence_match.group(1) if assembly_from_sequence_match else None
            )

        # Prefer assembly parsed from sequence; assembly parsed from annotation as fallback
        genome_assembly = assembly_from_sequence or assembly_from_annotation or "unknown"

        return annotation_filename, sequence_filename, genome_assembly

    @override
    def _get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        """Retrieves context for a genomic entity.

        Arguments:
            entity {GenomicEntity} -- Genomic entity to get context for.

        Returns:
            GenomicEntityContext -- Context for the requested entity.
        """
        # Treat numeric releases as a special case
        annotation_release = f"release-{entity.release}" if entity.release.isdigit() else entity.release

        # Build remote directories for annotation (GTF) and sequence (FASTA) files
        base_release_path = f"{self.base_path}/{annotation_release}"
        annotation_remote_dir = f"{base_release_path}/gtf/{entity.species}"
        sequence_remote_dir = f"{base_release_path}/fasta/{entity.species}/dna"

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


class NCBIGenomicDatabase(BaseGenomicDatabase):
    """A genomic database to interface with Ensembl."""

    name: ClassVar[str] = "ncbi"
    host: ClassVar[str] = "ftp.ncbi.nlm.nih.gov"
    base_path: ClassVar[str] = "/genomes/refseq"
    checksums_filename: ClassVar[str] = "md5checksums.txt"

    # ---- Directory Discovery ----
    @override
    def _build_species_mapping(self, species_dirs: dict[str, list[str]]) -> dict[str, list[str]]:
        """Builds the result of fetch_species_mapping.

        Arguments:
            species_dirs {dict[str, list[str]]} -- dict mapping taxon directories to their respective species.

        Returns:
            dict[str, list[str]] -- dict mapping taxons to their respective species.
        """
        return species_dirs

    def _get_all_releases_dir(self, ftp: ftplib.FTP, taxon: str, species: str) -> str | None:
        """Searches for the remote directory containing all releases for a specific species.

        Arguments:
            ftp {ftplib.FTP} -- Active FTP handler.
            taxon {str} -- Taxon of the species.
            species {str} -- Species to look up, must be contained in taxon.

        Returns:
            str | None -- Directory containing all releases or None if not found.
        """
        candidate_subdirs = ["annotation_releases", "all_assembly_versions"]
        species_base_dir = f"{self.base_path}/{taxon}/{species}"

        # Look up all subdirectories for the species
        ftp.cwd(species_base_dir)
        subdirs = set(self._get_subdirs(ftp))

        # Return first releases directory found
        for candidate_subdir in candidate_subdirs:
            if candidate_subdir in subdirs:
                return f"{species_base_dir}/{candidate_subdir}"
        return None

    @generic_cache_region.cache_on_arguments()
    def fetch_annotations_releases(self, taxon: str, species: str) -> list[str] | None:
        """Fetches all available annotation releases for a specific species.

        Arguments:
            taxon {str} -- Taxon of the species.
            species {str} -- Species, must be contained in taxon.

        Notes:
            This function is decorated with our generic cache to reduce refetching.

        Returns:
            list[str] | None -- list of available annotation releases or None if none were found.
        """

        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            release_dir = self._get_all_releases_dir(ftp, taxon, species)
            if release_dir is None:
                return None
            ftp.cwd(release_dir)
            dirs = self._get_subdirs(ftp)

        # Manually filter suppressed directories
        if release_dir == "all_assembly_versions":
            dirs = [dir for dir in dirs if dir != "suppressed"]
        return dirs

    # ---- Genomic Asset Fetching ----
    def _get_assembly_information(self, rel_dir: str, filename: str) -> tuple[str, str]:
        """Retrieves assembly name and RefSeq assembly accession from a remote accession report file.

        Arguments:
            rel_dir {str} -- Remote directory of an accession report file.
            filename {str} -- Name of the remote accession report file.

        Raises:
            ValueError: Failed to parse assembly name from assembly report.
            ValueError: Failed to parse accession from assembly report.

        Returns:
            tuple[str, str] -- (assembly name, RefSeq assembly accession).
        """
        assembly_prefix = "# Assembly name:"
        accession_prefix = "# RefSeq assembly accession:"

        def _extract_identifier(line: str, prefix: str) -> str:
            """Extracts and formats an identifier from an accession report file.

            Arguments:
                line {str} -- Line of an accession report file.
                prefix {str} -- Prefix to remove from the line.

            Returns:
                str -- Extracted identifier with prefix removed and whitespace replaced with underscores.
            """
            return "_".join(line.removeprefix(prefix).strip().split())

        # Always download without caching since accession of "latest" release could change
        file_path = self._download(rel_dir, filename)
        with open(file_path) as file:
            assembly_name, accession = None, None
            for line in file:
                if line.startswith(assembly_prefix):
                    assembly_name = _extract_identifier(line, assembly_prefix)
                    continue
                if line.startswith(accession_prefix):
                    accession = _extract_identifier(line, accession_prefix)
                    break  # we assume that the accession always comes after the assembly

        if assembly_name is None:
            raise ValueError("Failed to parse assembly name from assembly report.")

        if accession is None:
            raise ValueError("Failed to parse accession from assembly report.")

        return assembly_name, accession

    @override
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

    def _resolve_release_and_dir(self, entity: GenomicEntity) -> tuple[str, str, str, str]:
        """Resolves release, assembly and remote release directory.

        Arguments:
            entity {GenomicEntity} -- Genomic entity to look up.

        Notes:
            Also resolves non-concrete releases (e.g. "current", "110", etc.) to
            a concrete release (e.g. "GCF_000001405.40-RS_2025_08").

        Raises:
            ValueError: NCBI requires specifying a taxon but none was provided.
            RuntimeError: Could not fetch release directory.
            RuntimeError: Empty 'current' directory at NCBI.
            RuntimeError: No assembly report found in remote directory.

        Returns:
            tuple[str, str, str, str] -- (release name, assembly name, RefSeq assembly accession, release directory)
        """
        if entity.taxon is None:
            raise ValueError("NCBI requires specifying a taxon but none was provided.")

        release = entity.release

        with ftplib.FTP(self.host) as ftp:
            ftp.login()

            # Look up directory of all releases
            all_releases_dir = self._get_all_releases_dir(ftp, entity.taxon, entity.species)
            if all_releases_dir is None:
                raise RuntimeError("Could not fetch the directory containing all releases.")

            release_dir = f"{all_releases_dir}/{release}"
            ftp.cwd(release_dir)

            # Non-concrete releases (e.g. "current", "110", etc.) have an additional level of nesting
            if "GCF" not in release:
                listing = self._get_subdirs(ftp)
                if not listing:
                    raise RuntimeError("Empty release directory at NCBI.")

                # Always take the first subdir even if there are multiple options
                # TODO: investigate whether we should have a preference here
                release = listing[0]
                release_dir = f"{release_dir}/{release}"
                ftp.cwd(release_dir)

            # Find assembly report to get assembly name and RefSeq assembly accession
            assembly_report = min(
                (filename for filename in ftp.nlst() if filename.endswith("_assembly_report.txt")),
                default=None,
            )
            if not assembly_report:
                raise RuntimeError(f"No assembly report found in {release_dir}.")

            assembly_name, accession = self._get_assembly_information(release_dir, assembly_report)

            # Directories may have an additional level of nesting
            nested_subdir = f"{accession}_{assembly_name}"
            subdirs = set(self._get_subdirs(ftp))
            if nested_subdir in subdirs:
                release_dir = f"{release_dir}/{nested_subdir}"

        return release, assembly_name, accession, release_dir

    @override
    def _get_entity_context(self, entity: GenomicEntity) -> GenomicEntityContext:
        """Retrieves context for a genomic entity.

        Arguments:
            entity {GenomicEntity} -- Genomic entity to get context for.

        Returns:
            GenomicEntityContext -- Context for the requested entity.
        """
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
    """Fetches genomic dropdown options for NCBI and Ensembl.

    Notes:
        This function is decorated with our generic cache to reduce refetching.

    Returns:
        dict[str, dict[str, list[str]]] -- dict mapping database names to dicts mapping dropdown options to their suboptions.
    """

    # TODO: update allowlists

    databases = [
        NCBIGenomicDatabase(
            allowlist={"vertebrate_mammalian", "archaea", "invertebrate", "plant"},
        ),
        EnsemblGenomicDatabase(
            allowlist={"current", *[f"release-{i}" for i in range(110, 117)]},
        ),
    ]

    return {database.name: database.fetch_species_mapping() for database in databases}
