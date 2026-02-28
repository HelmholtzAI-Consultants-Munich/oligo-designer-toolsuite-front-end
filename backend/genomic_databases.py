import datetime
import ftplib
import gzip
import hashlib
import os
import pathlib
import re
import shutil
import subprocess
from collections import defaultdict
from email.utils import formatdate, parsedate_to_datetime
from pathlib import Path

import requests


class BaseGenomicDataBase:
    def __init__(
        self,
        host: str = "",
        base_path: str = "",
        allowlist: list[str] | None = None,
        cache_dir: str | None = None,
    ) -> None:
        self.host: str = host
        self.base_path: str = base_path
        self.allowlist: set[str] | None = set(allowlist) if allowlist is not None else None
        self.name: str = ""
        self.cache_dir = cache_dir

    def get_dirs(self, ftp: ftplib.FTP) -> list[str]:
        lines: list[str] = []
        _ = ftp.retrlines("LIST", lines.append)

        entries: list[str] = []
        for line in lines:
            parts = line.split(maxsplit=8)
            if len(parts) < 9:
                continue
            if parts[0][0] == "d" or parts[0][0] == "l":
                entries.append(parts[8])
        return sorted(entries)

    def _filter_allowlist(self, dirs: list[str]):
        if self.allowlist is not None:
            return list(set(dirs).intersection(self.allowlist))
        return dirs

    def _get_species_dirs(self, dirs, ftp):
        dirs.sort()

        all_species_dirs = []
        for dir in dirs:
            _ = ftp.cwd(f"/{self.base_path}/{dir}")
            all_species_dirs.extend([self.get_dirs(ftp)])
        return all_species_dirs

    def _build_directory_dict(self, top_dirs, species_dirs):
        return dict(zip(top_dirs, species_dirs))

    def fetch_ftp_directories(self):
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            ftp.cwd(self.base_path)
            top_dirs = self.get_dirs(ftp)
            top_dirs = self._filter_allowlist(top_dirs)
            species_dirs = self._get_species_dirs(top_dirs, ftp)
        return self.name, self._build_directory_dict(top_dirs, species_dirs)

    def download(self, url: str, extract_gzip: bool = False) -> Path:
        headers: dict[str, str] = {}

        url_hash = hashlib.md5(url.encode()).hexdigest()
        _, filename = url.rsplit("/", maxsplit=1)

        file_name = f"{url_hash}-{filename}"
        file_path = pathlib.Path(f"{self.cache_dir}/{file_name}").resolve()

        if os.path.exists(file_path):
            mtime = os.path.getmtime(file_path)
            headers["if-modified-since"] = formatdate(mtime, usegmt=True)

        with requests.get(url, headers=headers, stream=True) as response:
            response.raise_for_status()

            if response.status_code == requests.codes.not_modified:
                return file_path

            if response.status_code == requests.codes.ok:
                with open(file_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=10 * 1024 * 1024):
                        f.write(chunk)

                if last_modified := response.headers.get("last-modified"):
                    new_mtime = parsedate_to_datetime(last_modified).timestamp()
                    os.utime(file_path, times=(datetime.datetime.now().timestamp(), new_mtime))

        if extract_gzip:
            extracted_file_path = self.extracted_file_path(file_path)

            if os.path.exists(extracted_file_path):
                return file_path

            with gzip.open(file_path, "rb") as archive:
                with open(extracted_file_path, "wb") as extract:
                    shutil.copyfileobj(archive, extract)

        return file_path

    def extracted_file_path(self, file_path: str | pathlib.Path):
        return pathlib.Path(str(file_path) + "-extract")


class EnsemblGenomicDataBase(BaseGenomicDataBase):
    # release 116 changes structure => could be a problem once they set this to current
    def __init__(self, host="ftp.ensembl.org", base_path="/pub/", allowlist=None, cache_dir=None) -> None:
        super().__init__(host, base_path, allowlist, cache_dir)
        self.name = "ensembl"
        self.orig_top_dirs = [""]

    def _get_species_dirs(self, dirs, ftp):
        self.orig_top_dirs = dirs
        dirs = [f"{dir}/fasta" if dir.startswith("release") else dir for dir in dirs]
        return super()._get_species_dirs(dirs, ftp)

    def _build_directory_dict(self, top_dirs, species_dirs):
        # only use number to list release so e.g. "release-115" -> "115"
        self.orig_top_dirs = [dir[-3:] for dir in self.orig_top_dirs]
        return self.reverse_dict(super()._build_directory_dict(self.orig_top_dirs, species_dirs))

    def reverse_dict(self, directories):
        reversed_directories = defaultdict(list)
        for release, species_dirs in directories.items():
            for species_dir in species_dirs:
                reversed_directories[species_dir].append(release)
        return dict(reversed_directories)

    def _verify_file(self, file_path: Path, expected_checksum: str) -> bool:
        try:
            result = subprocess.run(["sum", file_path], capture_output=True, check=True, text=True)
            computed_checksum = result.stdout.split()[0]
            return computed_checksum == expected_checksum
        except subprocess.CalledProcessError:
            return False

    def _parse_checksums(self, checksums_path: str | Path):
        filename_to_checksum_map = {}
        with open(checksums_path) as checksums_file:
            for line in checksums_file:
                line = line.strip()
                split_line = line.split()
                filename_to_checksum_map[split_line[len(split_line) - 1]] = split_line[0]
        return filename_to_checksum_map

    def _release_dirs(self, release: str | int):
        """
        Return tuple (gtf_dir, fasta_dir, resolved_release_is_current_flag).
        Uses 'current_gtf' and 'current_fasta' when release == 'current',
        otherwise 'pub/release-<rel>/(gtf|fasta)/...'
        """
        if str(release) == "current":
            return ("pub/current_gtf", "pub/current_fasta", True)
        else:
            return (f"pub/release-{release}/gtf", f"pub/release-{release}/fasta", False)

    def _pick_files(self, gtf_dir, fasta_dir):
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
            for name in sorted(gtf_listing):
                if name.endswith(".gtf.gz"):
                    gtf_gz = name
                    break
            if not gtf_gz:
                raise RuntimeError(f"No .gtf.gz found in {gtf_dir}")

            # Try to parse assembly from GTF filename: e.g., Homo_sapiens.GRCh38.110.gtf.gz
            asm_match = re.match(r"^[A-Za-z_]+\.([A-Za-z0-9\.]+)\.", gtf_gz)
            assembly_from_gtf = asm_match.group(1) if asm_match else None

            # FASTA directory (already includes species + dna)
            ftp.cwd(f"/{fasta_dir}")
            fa_listing = sorted(ftp.nlst())

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

    def get_plain_file_path(self, dir, remote_filename):
        checksum_path = self.download(f"https://{self.host}/{dir}/CHECKSUMS")
        checksum = self._parse_checksums(checksum_path)[remote_filename]

        local_path = self.download(f"https://{self.host}/{dir}/{remote_filename}", extract_gzip=True)

        if not self._verify_file(local_path, checksum):
            raise RuntimeError(f"Couldn't match checksum for {local_path}")

        return str(self.extracted_file_path(local_path))

    def prepare_cached_assets(self, species, release):
        """
        URL based cache for Ensembl GTF/FASTA.
        - Resolves 'current' vs numeric release to the right directories.
        - Selects one .gtf.gz and one DNA FASTA (prefers dna_sm.primary_assembly, then primary_assembly, then toplevel).
        - Attempts to fetch .md5 sidecar for each for MD5 verification.
        - verifies checksums parsed from CHECKSUMS file using 'sum' command
        - Gunzips once into 'decompressed' and returns local paths and metadata.
        """

        gtf_root, fasta_root, is_current = self._release_dirs(release)
        # species should be like 'homo_sapiens'
        gtf_dir = f"{gtf_root}/{species}"
        fasta_dir = f"{fasta_root}/{species}/dna"

        # Pick filenames and assembly
        gtf_gz, fasta_gz, assembly = self._pick_files(gtf_dir, fasta_dir)

        # Use 'current' literally if current; else use the numeric/label release
        rel_label = "current" if is_current else str(release)

        gtf_plain = self.get_plain_file_path(gtf_dir, gtf_gz)
        fasta_plain = self.get_plain_file_path(fasta_dir, fasta_gz)

        return {
            "annotation_file": gtf_plain,
            "sequence_file": fasta_plain,
            "annotation_release": rel_label,
            "genome_assembly": assembly,
            "accession": None,  # Ensembl doesn't use GCF/GCA accessions in filenames
        }


class NCBIGenomicDataBase(BaseGenomicDataBase):
    def __init__(
        self, host="ftp.ncbi.nlm.nih.gov", base_path="genomes/refseq/", allowlist=None, cache_dir=None
    ) -> None:
        super().__init__(host, base_path, allowlist, cache_dir)
        self.name = "ncbi"

    def _try_change_directory(self, ftp: ftplib.FTP, taxon: str, species: str, dir: str):
        try:
            return ftp.cwd(f"/{self.base_path}/{taxon}/{species}/{dir}")
        except ftplib.Error:
            return None

    def _get_releases_dir(self, ftp, taxon, species):
        possible_dirs = ["annotation_releases", "all_assembly_versions"]

        for dir in possible_dirs:
            if self._try_change_directory(ftp, taxon, species, dir) is not None:
                return dir

        return None

    def fetch_annotations_releases(self, taxon: str, species: str):
        with ftplib.FTP(self.host) as ftp:
            ftp.login()
            dir = self._get_releases_dir(ftp, taxon, species)
            if dir is None:
                return None
            dirs = self.get_dirs(ftp)

        # split to avoid including locations that symbolic links point to in the list so "current -> test/4711" -> "current"
        dirs = [dir.split(maxsplit=1)[0] for dir in dirs]
        if dir == "all_assembly_versions":
            dirs = [dir for dir in dirs if dir != "suppressed"]
        return dirs

    def _get_assembly_information(self, rel_dir: str, file_name: str) -> tuple[str | None, str | None]:
        url = f"https://{self.host}{rel_dir}/{file_name}"
        file_path = self.download(url)

        if file_path is None:
            raise ValueError("Could not fetch assembly information")

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

    def _resolve_release_and_dir(self, taxon, species, release):
        # Resolve "current" to a concrete release; also read README to get assembly/accession
        with ftplib.FTP(self.host) as ftp:
            ftp.login()

            releases_dir = self._get_releases_dir(ftp, taxon, species)
            if releases_dir is None:
                raise RuntimeError("Could not fetch release dir")
            base = f"/{self.base_path}{taxon}/{species}/{releases_dir}/"
            rel_dir = base + f"{release}/"

            ftp.cwd(rel_dir)

            if "GCF" not in release:
                # Be deterministic
                listing = self.get_dirs(ftp)
                if not listing:
                    raise RuntimeError("Empty 'current' directory at NCBI.")

                old_release = release
                release = listing[0]

                rel_dir = base + f"{old_release}/{release}"
                ftp.cwd(release)

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
        return str(release), assembly_name, accession, final_dir

    def _parse_checksums(self, line, filename_idx: int, checksum_idx: int):
        line = line.strip()
        if not line:
            return None
        line = line.split()
        if len(line) < 2:
            return None
        filename = line[filename_idx].lstrip("./")
        checksum = line[checksum_idx]
        return filename, checksum

    def _parse_md5checksums(self, md5_text_path):
        # Lines like: "<md5>  ./GCF_..._genomic.gtf.gz"
        filename_to_checksum_map = {}
        with open(md5_text_path) as f:
            if "uncompressed" in str(md5_text_path):
                filename_idx = 0
                checksum_idx = 1
            else:
                filename_idx = 1
                checksum_idx = 0

            for line in f:
                filename, checksum = self._parse_checksums(line, filename_idx, checksum_idx)
                filename_to_checksum_map[filename] = checksum
        return filename_to_checksum_map

    def prepare_cached_assets(self, taxon, species, release):
        """
        Returns cached, MD5-verified local paths for .gtf and .fna (decompressed),
        plus metadata: release, assembly, accession.
        """
        release, assembly, accession, final_dir = self._resolve_release_and_dir(taxon, species, release)
        #
        # md5 manifests (compressed + optional uncompressed)
        md5_local = self.download(f"https://{self.host}/{final_dir}/md5checksums.txt")

        compressed_checksum_map = self._parse_md5checksums(md5_local)

        try:
            uncompressed_local = self.download(f"https://{self.host}/{final_dir}/uncompressed_checksums.txt")
            uncompressed_checksum_map = self._parse_md5checksums(uncompressed_local)
        except requests.exceptions.HTTPError:
            uncompressed_checksum_map = None
            # Not all NCBI directories publish this file; proceed without it.
            pass

        file_types = ["gtf", "fna"]
        file_endings = ["_genomic.gtf.gz", "_genomic.fna.gz"]
        files = {
            file_type: {"remote_path": f"{accession}_{assembly}{file_ending}"}
            for file_type, file_ending in zip(file_types, file_endings)
        }

        # Ensure raw files present & verified (store in our cache /raw regardless of NCBI nesting)
        for key in files.keys():
            try:
                expected_archive_checksum = compressed_checksum_map[files[key]["remote_path"]]
            except KeyError as e:
                raise RuntimeError(f"Required file missing in md5checksums.txt: {e}") from e

            archive_local_path = self.download(
                f"https://{self.host}/{final_dir}/{files[key]['remote_path']}", True
            )

            if not self._verify_file(archive_local_path, expected_archive_checksum):
                raise RuntimeError(f"Checksum for {archive_local_path} doesn't match")

            uncompressed_local_path = self.extracted_file_path(archive_local_path)

            # Optional: verify uncompressed files using uncompressed_checksums.txt (if available)
            # possibly not necessary
            if uncompressed_checksum_map is not None:
                expected_uncompressed_checksum = uncompressed_checksum_map[
                    files[key]["remote_path"].rstrip(".gz")
                ]
                if not self._verify_file(uncompressed_local_path, expected_uncompressed_checksum):
                    raise RuntimeError(f"Checksum for {uncompressed_local_path} doesn't match")
            files[key]["local_path"] = str(uncompressed_local_path)

        return {
            "annotation_file": files["gtf"]["local_path"],
            "sequence_file": files["fna"]["local_path"],
            "annotation_release": release,
            "genome_assembly": assembly,
            "accession": accession,
        }


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
