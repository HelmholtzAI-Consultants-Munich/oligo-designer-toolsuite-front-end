# Caching Fastas

## Overview

The caching system for the genomic region extraction pipeline prevents redundant computations and speeds up repeated or similar requests. It works by generating a unique cache key for each specific set of parameters and storing the resulting files under a deterministic directory name. This allows the pipeline to reuse previous outputs rather than recomputing them.

---

## What is Cached?

Each high-level request (e.g., to `/api/genomic/cascaded/ncbi` or `/ensembl`) is decomposed into individual region-specific forms (for example, one for `gene`, one for `exon`, etc.).

For each form:

- A unique cache key is generated from selected form fields
- Output files (such as `.fna`) are stored in a directory like:

  ```
  /cache/cached_genomic_<hash>/
  ```

- If the directory already exists and contains valid output, the pipeline step is skipped and the results are reused

---

## Two-Level Cache

The caching system employs a two-level cache strategy to optimize data retrieval and processing:

- **Level 1: Region FASTA Cache**

  This level caches the generated `.fna` files for each genomic region based on the unique form cache key. These files represent the extracted sequences for specific regions (e.g., genes, exons) as requested by the user. The directory layout follows:

  ```
  /cache/cached_genomic_<hash>/
  ├── annotation/
  │   ├── gene1.fna
  │   └── gene2.fna
  ```

- **Level 2: Raw Asset Cache from NCBI/Ensembl**

  This level caches the raw downloaded assets from NCBI or Ensembl, including compressed `.gtf.gz` and `.fna.gz` files along with their decompressed counterparts `.gtf` and `.fna`. These files are verified against provided MD5 checksums to ensure integrity. The directory layouts are as follows:

  - **NCBI Raw Cache:**

    ```
    /cache/ncbi_raw/
    ├── <taxon_id>/
    │   ├── annotation.gtf.gz
    │   ├── annotation.gtf
    │   ├── genome.fna.gz
    │   └── genome.fna
    ```

  - **Ensembl Raw Cache:**

    ```
    /cache/ensembl_raw/
    ├── <species_name>/
    │   ├── annotation.gtf.gz
    │   ├── annotation.gtf
    │   ├── genome.fna.gz
    │   └── genome.fna
    ```

When a Level 1 cache miss occurs (i.e., the region-specific `.fna` files are not found), the system checks Level 2 cache for the raw assets. If Level 2 cache is also missing or invalid, the raw data is downloaded and cached at Level 2. Subsequently, the pipeline runs in `custom` mode using these raw assets to generate the Level 1 cached files.

---

## Cache Key Construction

The cache key is a SHA256 hash generated from a subset of the form data:

```json
{
  "source": "NCBI",
  "source_params": {
    "taxon": "9606",
    "species": "Homo_sapiens",
    "annotation_release": "110"
  },
  "genomic_regions": {
    "gene": "true",
    "exon": "false"
  }
}
```

Only these fields are considered. Any change to them will produce a new cache key and therefore a new cached directory.

---

## Caching Workflow

1. A user submits a request to the API endpoint.
2. The server generates per‑region forms where only one genomic region is set to `true`.
3. For each form:
   - A cache key is computed
   - The server checks for cached output under `/cache/cached_genomic_<key>/annotation/*.fna`
4. If a cached directory exists:
   - The contents are reused
   - The directory’s access time is updated
5. If no cache is found:
   - A YAML configuration is created
   - The genomic region generator runs
   - Output is stored in the designated cache directory
   - The temporary YAML file is deleted after use

---

## Cache Directory Layout

```
cache/
├── cached_genomic_<hash>/
│   ├── annotation/
│   │   ├── gene1.fna
│   │   └── gene2.fna
│   └── config_genomic_<hash>.yaml  (deleted after execution)
```

---

## Cache Cleanup

To prevent excessive disk usage, cached directories are periodically purged.

### Cleanup Logic

A scheduled job executes a cleanup script that removes cache directories under the following conditions:

- The directory has not been accessed within the last 30 days
- The directory name is not on the exclusion list

### Exclusion Example

```python
EXCLUDE_DIRS = [
    "cached_genomic_special_human",
    "cached_genomic_mouse_reference"
]
```

These directories are preserved regardless of access time.

---

## Cron Job Configuration

To automate cleanup, a cron job is scheduled as follows:

```bash
0 3 1 * * /path/to/venv/bin/python /path/to/cleanup_cache_dirs.py >> /var/log/cache_cleanup.log 2>&1
```

This runs the cleanup script at 03:00 on the first day of every month.

---
