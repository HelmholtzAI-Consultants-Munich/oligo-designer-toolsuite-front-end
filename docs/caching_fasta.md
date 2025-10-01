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

The caching system employs a two-level cache strategy to optimize both performance and resource usage, with explicit workflows and directory layouts for each level:

- **Level 1: Region FASTA Cache**

  Level 1 is the cache for generated FASTA (`.fna`) files for each specific genomic region, such as a gene, exon, or other user-requested interval. Each Level 1 cache entry is keyed by a unique hash derived from a subset of the form fields (see below), which encode the selected data source, taxon/species, annotation release, and the precise set of genomic regions. A **Level 1 cache hit** occurs if the directory `/cache/cached_genomic_<hash>/annotation/` contains all the expected `.fna` files for the requested regions, based on the exact combination of parameters. A **miss** occurs if any required file is missing or the directory does not exist for the cache key. Since these FASTA files are generated for a specific region selection, they are typically small and tied directly to the user's query. The cache key is deterministic and ensures that only exact matches for the same region and parameters are reused.

  Example directory layout:

  ```
  /cache/cached_genomic_<hash>/
  ├── annotation/
  │   ├── gene1.fna
  │   └── gene2.fna
  ```

- **Level 2: Raw Asset Cache from NCBI/Ensembl**

  Level 2 is the heavy, persistent cache for raw data assets downloaded from NCBI or Ensembl. These assets are typically large—ranging from hundreds of megabytes to several gigabytes—and comprise the official compressed files (`.fna.gz`, `.gtf.gz`) as distributed by the source. The cache stores both the original compressed files in a `raw/` subdirectory and their decompressed forms in a `decompressed/` subdirectory. This avoids repeated decompression (gunzip) overhead for downstream processing.

  All Level 2 downloads are **verified for integrity**: NCBI files are checked against the `md5checksums.txt` provided in the FTP directory, while Ensembl files are checked against their `.md5` sidecar files. Only files passing verification are used or cached.

  Both NCBI and Ensembl directory structures are deterministic, mirroring the official FTP layouts for ease of traceability and reproducibility. Example layouts:

  - **NCBI Cache Example:**

    ```
    /cache/ncbi_raw/
    └── <taxon_id>/
        ├── raw/
        │   ├── annotation.gtf.gz
        │   └── genome.fna.gz
        └── decompressed/
            ├── annotation.gtf
            └── genome.fna
    ```

  - **Ensembl Cache Example:**

    ```
    /cache/ensembl_raw/
    └── <species_name>/
        ├── raw/
        │   ├── annotation.gtf.gz
        │   └── genome.fna.gz
        └── decompressed/
            ├── annotation.gtf
            └── genome.fna
    ```

  This structure ensures that both the original and ready-to-use files are always available for fast access and reuse.

**Workflow Summary:**

1. **Level 1 cache miss:** If the region-specific `.fna` files for the current query are not found (cache miss), proceed to Level 2.
2. **Level 2 lookup:** Check if the required raw and decompressed files are present in the Level 2 cache (`raw/` and `decompressed/` for the appropriate NCBI or Ensembl subdirectory).
3. **If Level 2 present:** Build a temporary `custom` YAML config pointing to the decompressed `.gtf` and `.fna` files in the Level 2 cache, and run the region extraction pipeline using these assets to generate the Level 1 cache outputs.
4. **If Level 2 absent:** Download the required assets from FTP, verify checksums (using NCBI `md5checksums.txt` or Ensembl `.md5` files), decompress into the `decompressed/` folder, and cache both compressed and decompressed copies for future use. Then, proceed as in step 3.
5. **Reuse forever:** Once Level 2 assets are cached and verified, they are reused for all future queries requiring the same species/taxon and annotation release, avoiding repeated downloads and decompression.

**Explicit Directory Layouts:**

- NCBI:
  ```
  /cache/ncbi_raw/
  └── <taxon_id>/
      ├── raw/
      │   ├── annotation.gtf.gz
      │   └── genome.fna.gz
      └── decompressed/
          ├── annotation.gtf
          └── genome.fna
  ```
- Ensembl:
  ```
  /cache/ensembl_raw/
  └── <species_name>/
      ├── raw/
      │   ├── annotation.gtf.gz
      │   └── genome.fna.gz
      └── decompressed/
          ├── annotation.gtf
          └── genome.fna
  ```

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
