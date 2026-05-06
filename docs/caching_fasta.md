---
title: Caching FASTA Files
layout: default
nav_order: 6
parent: Development
---

# Caching Fastas

## Overview

The caching system for the genomic region generation prevents redundant computations and speeds up repeated or similar requests. It works by generating a unique cache key for each specific set of parameters and storing the output path in a Redis cache using [`dogpile.cache`](https://dogpilecache.sqlalchemy.org/en/latest/index.html). This allows the pipeline to reuse previous outputs rather than recomputing them.
The cache also handles locking to enable parallel execution of the genomic region generation task without accidentally downloading or computing the same files concurrently.

<!-- TODO: adjust this to new API once that is merged -->

The genomic region generator gets executed when the `genomic_region_generation_forms` key in a pipeline's `formdata` payload contains the appropriate configuration.

---

## What is Cached?

Each high-level request is uncomposed into individual region-specific forms (for example, one for `gene`, one for `exon`, etc.).

For each form:

- A unique cache key is generated from selected form fields
- If our cache contains the key and the associated path points to an existing directory, the region generation step is skipped and the results are reused.
- Otherwise, generation runs, its output files (such as `.fna`) are stored in a directory like below and the output path is added to the cache:

  ```
  cache/generated/cached_genomic_<hash>/
  ```

---

## Two-Level Cache

The caching system employs a two-level cache strategy to optimize both performance and resource usage, with explicit workflows and directory layouts for each level:

- **Level 1: Region FASTA Cache**

  Level 1 is the cache for generated FASTA (`.fna`) files for each specific genomic region, such as a gene, exon, or other user-requested interval. Each Level 1 cache entry is keyed by a unique hash derived from a subset of the form fields (see below), which encode the selected data source, taxon/species, annotation release, and the precise set of genomic regions. Since these FASTA files are generated for a specific region selection, they are typically small and tied directly to the user's query. The cache key is deterministic and ensures that only exact matches for the same region and parameters are reused.

  Example directory layout:

  ```
  cache/generated/
  ├── cached_genomic_<hash>/
  |   └── annotation/
  │       ├── gene1.fna
  │       └── gene2.fna
  ```

- **Level 2: Raw Asset Cache from NCBI/Ensembl**

  Level 2 is the heavy, persistent cache for raw data assets downloaded from NCBI or Ensembl. These assets are typically large—ranging from hundreds of megabytes to several gigabytes—and comprise the official compressed files (`.fna.gz`, `.gtf.gz`) as distributed by the source. The cache stores both the original compressed files and their uncompressed forms. This avoids repeated uncompression overhead for downstream processing.
  <!-- TODO:
  genomic region generator can read gzip annotation (.gtf) files, but not sequence (.fa)... maybe change so we can avoid storing uncompressed files?-->

  All Level 2 downloads are **verified for integrity**: NCBI and Ensembl files are checked against the `md5checksums.txt` and `CHECKSUMS` provided in the FTP directory respectively. Only files passing verification are used or cached.

  The cache directory is partitioned by source but otherwise flat. Example layouts:
  - **NCBI Cache Example:**

    ```
    cache/ncbi/
    ├── annotation.gtf.gz
    ├── annotation.gtf
    ├── genome.fna.gz
    └── genome.fna
    ```

  - **Ensembl Cache Example:**

    ```
    cache/ensembl/
    ├── annotation.gtf.gz
    ├── annotation.gtf
    ├── genome.fna.gz
    └── genome.fna
    ```

  This structure ensures that both the original and ready-to-use files are always available for fast access and reuse.

**Workflow Summary:**

1. **Level 1 cache lookup:** Return the region-specific `.fna` files for the current query if present, otherwise proceed to Level 2.
2. **Level 2 cache lookup:** Check whether required assets are present in Level 2 cache. If present, skip the following step.
3. **Level 2 resource download:** Download the required assets from FTP and cache both compressed and uncompressed copies for future use.
4. **Level 2 processing:** Verify checksums (using NCBI `md5checksums.txt` or Ensembl `CHECKSUMS` files) and return file paths.
5. **Level 1 region generation:** Build a temporary `custom` YAML config pointing to the uncompressed `.gtf` and `.fna` files in the Level 2 cache, and run the genomic region generator using these assets to generate the Level 1 cache outputs.
6. **Reuse until expiry:** Once Level 2 assets are cached and verified, they are reused for all future queries requiring the same species/taxon and annotation release, avoiding repeated downloads and uncompression.

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

<!-- NOTE: why just those regions? what about all other genomic_regions? -->

---

## Caching Workflow

1. A user submits a request to the API endpoint.
2. The server generates per‑region forms where only one genomic region is set to `true`.
3. For each form:
   - A cache key is computed
   - The server checks for cached output under `/cache/generated/cached_genomic_<key>/annotation/*.fna`
4. If a cached directory exists:
   - The contents are reused
5. If no cache is found:
   - A YAML configuration is created
   - The genomic region generator runs
   - Output is stored in the designated cache directory
   - The temporary YAML file is deleted after use

---

## Cache Directory Layout

```
cache/generated/
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
