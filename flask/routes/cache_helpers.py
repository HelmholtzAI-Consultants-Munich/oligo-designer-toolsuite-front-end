import gzip
import hashlib
import os
import re
import shutil
import requests
from ftplib import FTP, error_perm
from pathlib import Path
from flask import current_app


def _md5sum(path, chunk=1024 * 1024):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for blk in iter(lambda: f.read(chunk), b""):
            h.update(blk)
    return h.hexdigest()


def _parse_md5checksums(md5_text_path):
    # Lines like: "<md5>  ./GCF_..._genomic.gtf.gz"
    m = {}
    with open(md5_text_path) as f:
        for line in f:
            line = line.strip()
            if not line or "  " not in line:
                continue
            digest, rel = line.split("  ", 1)
            rel = rel.lstrip("./")
            m[rel] = digest
    return m


def _get_md5_for_filename(md5map, filename):
    """
    Look up the expected MD5 by matching basename against keys in md5map,
    which may contain nested relative paths from md5checksums.txt.
    """
    for relpath, md5 in md5map.items():
        if os.path.basename(relpath) == filename:
            return md5
    raise KeyError(f"'{filename}' not found in md5checksums.txt")


def _parse_uncompressed_checksums(manifest_path):
    """
    Parse uncompressed_checksums.txt if present and return a dict of
    basename -> md5 for convenient lookups of decompressed files.
    """
    if not os.path.exists(manifest_path):
        return {}
    m = _parse_md5checksums(manifest_path)
    # normalize to basename keys for easy matching
    return {os.path.basename(k): v for k, v in m.items()}


def download_file(ftp_host, remote_dir, filename, local_path):
    with (
        requests.get(f"https://{ftp_host}/{remote_dir}{filename}", stream=True) as r,
        open(local_path, mode="wb") as file,
    ):
        for chunk in r.iter_content(chunk_size=current_app.config["DOWNLOAD_CHUNK_SIZE"]):
            file.write(chunk)


def _ensure_file_with_md5(ftp_host, remote_dir, filename, expected_md5, dst_path):
    if os.path.exists(dst_path):
        if _md5sum(dst_path) == expected_md5:
            return dst_path, False
    download_file(ftp_host, remote_dir, filename, dst_path)
    got = _md5sum(dst_path)
    if got != expected_md5:
        raise RuntimeError(f"MD5 mismatch for {filename}: expected {expected_md5}, got {got}")
    return dst_path, True


def _ensure_gunzipped(gz_path, out_path):
    if os.path.exists(out_path):
        return out_path, False
    with gzip.open(gz_path, "rb") as gz, open(out_path, "wb") as out:
        shutil.copyfileobj(gz, out)
    return out_path, True


def _resolve_ncbi_release_and_dir(taxon, species, release):
    host = "ftp.ncbi.nlm.nih.gov"
    base = f"genomes/refseq/{taxon}/{species}/annotation_releases/"
    rel_dir = base + ("current/" if str(release) == "current" else f"{release}/")

    # Resolve "current" to a concrete release; also read README to get assembly/accession
    with FTP(host) as ftp:
        ftp.login()
        ftp.cwd(rel_dir)
        if str(release) == "current":
            # Be deterministic
            listing = sorted(ftp.nlst())
            if not listing:
                raise RuntimeError("Empty 'current' directory at NCBI.")
            release = listing[0]
            rel_dir = base + f"{release}/"
            ftp.cwd(release)
        # find README
        readmes = sorted([n for n in ftp.nlst() if n.startswith("README_")])
        if not readmes:
            raise RuntimeError(f"No README_ found in {rel_dir}")
        readme = readmes[0]

    # download README temporarily to parse assembly + accession
    tmp = os.path.join("/tmp", f"README_{species}_{release}.txt")
    download_file(host, rel_dir, readme, tmp)
    assembly_name, accession = None, None
    with open(tmp) as fh:
        for line in fh:
            if line.startswith("ASSEMBLY NAME:"):
                assembly_name = line.strip().split("\t")[1]
            if line.startswith("ASSEMBLY ACCESSION:"):
                accession = line.strip().split("\t")[1]
                break
    os.remove(tmp)
    if not assembly_name or not accession:
        raise RuntimeError("Failed to parse assembly/accession from README.")
    nested = f"{rel_dir}{accession}_{assembly_name}/"
    with FTP(host) as ftp:
        ftp.login()
        try:
            ftp.cwd(nested)
            final_dir = nested
        except error_perm:
            final_dir = rel_dir
    return host, str(release), assembly_name, accession, final_dir


def _prepare_ncbi_cached_assets(cache_root, taxon, species, release):
    """
    Returns cached, MD5-verified local paths for .gtf and .fna (decompressed),
    plus metadata: release, assembly, accession.
    """
    host, release, assembly, accession, final_dir = _resolve_ncbi_release_and_dir(taxon, species, release)

    cache_dir = os.path.join(cache_root, "ncbi", taxon, species, str(release), f"{accession}_{assembly}")
    raw = os.path.join(cache_dir, "raw")
    dec = os.path.join(cache_dir, "decompressed")
    Path(raw).mkdir(parents=True, exist_ok=True)
    Path(dec).mkdir(parents=True, exist_ok=True)

    # md5 manifests (compressed + optional uncompressed)
    md5_local = os.path.join(raw, "md5checksums.txt")
    download_file(host, final_dir, "md5checksums.txt", md5_local)
    md5map = _parse_md5checksums(md5_local)
    unc_local = os.path.join(raw, "uncompressed_checksums.txt")
    try:
        download_file(host, final_dir, "uncompressed_checksums.txt", unc_local)
    except Exception:
        # Not all NCBI directories publish this file; proceed without it.
        pass
    unc_map = _parse_uncompressed_checksums(unc_local)
    # Filenames we care about (resolve MD5 by basename to handle nested manifest paths)
    gtf_gz = f"{accession}_{assembly}_genomic.gtf.gz"
    fna_gz = f"{accession}_{assembly}_genomic.fna.gz"
    report = f"{accession}_{assembly}_assembly_report.txt"

    try:
        exp_gtf_md5 = _get_md5_for_filename(md5map, gtf_gz)
        exp_fna_md5 = _get_md5_for_filename(md5map, fna_gz)
        exp_rep_md5 = _get_md5_for_filename(md5map, report)
    except KeyError as e:
        raise RuntimeError(f"Required file missing in md5checksums.txt: {e}") from e

    # Ensure raw files present & verified (store in our cache /raw regardless of NCBI nesting)
    gtf_gz_path, _ = _ensure_file_with_md5(host, final_dir, gtf_gz, exp_gtf_md5, os.path.join(raw, gtf_gz))
    fna_gz_path, _ = _ensure_file_with_md5(host, final_dir, fna_gz, exp_fna_md5, os.path.join(raw, fna_gz))
    _, _ = _ensure_file_with_md5(host, final_dir, report, exp_rep_md5, os.path.join(raw, report))

    gtf_path, _ = _ensure_gunzipped(gtf_gz_path, os.path.join(dec, f"{accession}_{assembly}_genomic.gtf"))
    fna_path, _ = _ensure_gunzipped(fna_gz_path, os.path.join(dec, f"{accession}_{assembly}_genomic.fna"))

    # Optional: verify uncompressed files using uncompressed_checksums.txt (if available)
    try:
        if unc_map:
            gtf_base = os.path.basename(gtf_path)
            fna_base = os.path.basename(fna_path)
            if gtf_base in unc_map and _md5sum(gtf_path) != unc_map[gtf_base]:
                raise RuntimeError(f"Uncompressed MD5 mismatch for {gtf_base}")
            if fna_base in unc_map and _md5sum(fna_path) != unc_map[fna_base]:
                raise RuntimeError(f"Uncompressed MD5 mismatch for {fna_base}")
    except Exception:
        # Treat as non-fatal; you can log if stricter behavior is desired.
        pass

    return {
        "annotation_file": gtf_path,
        "sequence_file": fna_path,
        "annotation_release": release,
        "genome_assembly": assembly,
        "accession": accession,
        "cache_dir": cache_dir,
    }


# ----------------- Ensembl helpers -----------------


def _ftp_try_get(ftp_host, remote_dir, filename, local_path):
    """Try to retrieve a file. Return True if downloaded, False if not found."""
    try:
        download_file(ftp_host, remote_dir, filename, local_path)
        return True
    except Exception:
        try:
            # If cwd fails inside _ftp_get, this also catches; nothing to clean.
            if os.path.exists(local_path) and os.path.getsize(local_path) == 0:
                os.remove(local_path)
        except Exception:
            pass
        return False


def _ensembl_release_dirs(release):
    """
    Return tuple (gtf_dir, fasta_dir, resolved_release_is_current_flag).
    Uses 'current_gtf' and 'current_fasta' when release == 'current',
    otherwise 'pub/release-<rel>/(gtf|fasta)/...'
    """
    if str(release) == "current":
        return ("pub/current_gtf", "pub/current_fasta", True)
    else:
        return (f"pub/release-{release}/gtf", f"pub/release-{release}/fasta", False)


def _ensembl_pick_files(ftp_host, gtf_dir, fasta_dir):
    """
    Given fully-qualified remote directories for GTF and DNA FASTA
    (e.g., 'pub/current_gtf/homo_sapiens' and 'pub/current_fasta/homo_sapiens/dna'),
    choose one .gtf.gz and one .fa.gz. Prefer primary_assembly for FASTA; fallback to toplevel.
    Returns (gtf_filename, fasta_filename, assembly_name).
    """
    with FTP(ftp_host) as ftp:
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
        ftp.cwd(fasta_dir)
        fa_listing = sorted(ftp.nlst())

        fasta_gz = None
        preferred_orders = [
            ".dna_sm.primary_assembly.fa.gz",
            ".dna.primary_assembly.fa.gz",
            ".dna_sm.toplevel.fa.gz",
            ".dna.toplevel.fa.gz",
        ]
        for suffix in preferred_orders:
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


def _read_single_line_md5(md5_file_path):
    """
    Read a file that typically contains '<md5>  <filename>' or just '<md5>'.
    Return the hex digest if found; else raise.
    """
    with open(md5_file_path) as f:
        line = f.readline().strip()
        if not line:
            raise RuntimeError("Empty md5 sidecar file")
        # handle formats: 'abcd123  filename' or just 'abcd123'
        token = line.split()[0]
        if len(token) < 16:  # sanity
            raise RuntimeError(f"Malformed md5 content: {line}")
        return token


def _prepare_ensembl_cached_assets(cache_root, species, release):
    """
    MD5-aware cache for Ensembl GTF/FASTA.
    - Resolves 'current' vs numeric release to the right directories.
    - Selects one .gtf.gz and one DNA FASTA (prefers dna_sm.primary_assembly, then primary_assembly, then toplevel).
    - Attempts to fetch .md5 sidecar for each for MD5 verification.
      If .md5 is not available, downloads without MD5 verification (Ensembl sometimes only provides CHECKSUMS in cksum format).
    - Gunzips once into 'decompressed' and returns local paths and metadata.
    """
    host = "ftp.ensembl.org"

    gtf_root, fasta_root, is_current = _ensembl_release_dirs(release)
    # species should be like 'homo_sapiens'
    gtf_dir = f"{gtf_root}/{species}"
    fasta_dir = f"{fasta_root}/{species}/dna"

    # Pick filenames and assembly
    gtf_gz, fasta_gz, assembly = _ensembl_pick_files(host, gtf_dir, fasta_dir)

    # Build cache directories
    # Use 'current' literally if current; else use the numeric/label release
    rel_label = "current" if is_current else str(release)
    cache_dir = os.path.join(cache_root, "ensembl", species, rel_label, assembly)
    raw = os.path.join(cache_dir, "raw")
    dec = os.path.join(cache_dir, "decompressed")
    Path(raw).mkdir(parents=True, exist_ok=True)
    Path(dec).mkdir(parents=True, exist_ok=True)

    # ---------- GTF ----------
    gtf_gz_local = os.path.join(raw, gtf_gz)
    # md5 sidecar attempt
    gtf_md5_local = gtf_gz_local + ".md5"
    gtf_md5_expected = None
    if _ftp_try_get(host, gtf_dir, gtf_gz + ".md5", gtf_md5_local):
        try:
            gtf_md5_expected = _read_single_line_md5(gtf_md5_local)
        except Exception:
            gtf_md5_expected = None

    # Ensure/verify download
    if gtf_md5_expected:
        _ensure_file_with_md5(host, gtf_dir, gtf_gz, gtf_md5_expected, gtf_gz_local)
    else:
        # No md5 available → just download if missing
        if not os.path.exists(gtf_gz_local):
            download_file(host, gtf_dir, gtf_gz, gtf_gz_local)

    # Gunzip
    gtf_plain = os.path.join(dec, os.path.splitext(os.path.splitext(gtf_gz)[0])[0] + ".gtf")
    _ensure_gunzipped(gtf_gz_local, gtf_plain)

    # ---------- FASTA ----------
    fasta_gz_local = os.path.join(raw, fasta_gz)
    fasta_md5_local = fasta_gz_local + ".md5"
    fasta_md5_expected = None
    if _ftp_try_get(host, fasta_dir, fasta_gz + ".md5", fasta_md5_local):
        try:
            fasta_md5_expected = _read_single_line_md5(fasta_md5_local)
        except Exception:
            fasta_md5_expected = None

    if fasta_md5_expected:
        _ensure_file_with_md5(host, fasta_dir, fasta_gz, fasta_md5_expected, fasta_gz_local)
    else:
        if not os.path.exists(fasta_gz_local):
            download_file(host, fasta_dir, fasta_gz, fasta_gz_local)

    # Gunzip
    fasta_plain = os.path.join(dec, os.path.splitext(os.path.splitext(fasta_gz)[0])[0] + ".fa")
    _ensure_gunzipped(fasta_gz_local, fasta_plain)

    return {
        "annotation_file": gtf_plain,
        "sequence_file": fasta_plain,
        "annotation_release": rel_label,
        "genome_assembly": assembly,
        "accession": None,  # Ensembl doesn't use GCF/GCA accessions in filenames
        "cache_dir": cache_dir,
    }
