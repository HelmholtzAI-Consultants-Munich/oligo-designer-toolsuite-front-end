import hashlib, gzip, shutil, os
from pathlib import Path
from ftplib import FTP, error_perm

def _md5sum(path, chunk=1024*1024):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for blk in iter(lambda: f.read(chunk), b""):
            h.update(blk)
    return h.hexdigest()

def _parse_md5checksums(md5_text_path):
    # Lines like: "<md5>  ./GCF_..._genomic.gtf.gz"
    m = {}
    with open(md5_text_path, "r") as f:
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

def _ftp_get(ftp_host, remote_dir, filename, local_path):
    Path(local_path).parent.mkdir(parents=True, exist_ok=True)
    with FTP(ftp_host) as ftp, open(local_path, "wb") as out:
        ftp.login()
        ftp.cwd(remote_dir)
        ftp.retrbinary(f"RETR {filename}", out.write)

def _ensure_file_with_md5(ftp_host, remote_dir, filename, expected_md5, dst_path):
    if os.path.exists(dst_path):
        if _md5sum(dst_path) == expected_md5:
            return dst_path, False
    _ftp_get(ftp_host, remote_dir, filename, dst_path)
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
            ftp.cwd(rel_dir)
        # find README
        readmes = sorted([n for n in ftp.nlst() if n.startswith("README_")])
        if not readmes:
            raise RuntimeError(f"No README_ found in {rel_dir}")
        readme = readmes[0]

    # download README temporarily to parse assembly + accession
    tmp = os.path.join("/tmp", f"README_{species}_{release}.txt")
    _ftp_get(host, rel_dir, readme, tmp)
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
    _ftp_get(host, final_dir, "md5checksums.txt", md5_local)
    md5map = _parse_md5checksums(md5_local)

    unc_local = os.path.join(raw, "uncompressed_checksums.txt")
    try:
        _ftp_get(host, final_dir, "uncompressed_checksums.txt", unc_local)
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
    _, _          = _ensure_file_with_md5(host, final_dir, report,  exp_rep_md5, os.path.join(raw, report))

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