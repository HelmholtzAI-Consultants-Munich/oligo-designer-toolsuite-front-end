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

To prevent excessive disk usage, cached files and directories that the cache no longer
references are purged periodically.

### Cleanup Logic

A cache key expires once it has not been used for `REDIS_FILE_EXPIRATION_TIME` (30 days by
default): reading a cached entry renews its expiration, see `FileCacheProxy.get_serialized`,
so files that are still in use never expire. Redis expires keys passively, which means the
key disappears while the file or directory it pointed to stays on disk. The
`backend.worker.tasks.cleanup_cache_dirs` task reconciles the two:

1. The cache root is read from the config (`RELATIVE_CACHE_PATH`, `backend/cache` by default).
2. `backend.cache.get_cached_file_paths` collects the still referenced paths from Redis. File
   cache keys carry the `REDIS_FILE_CACHE_KEY_PREFIX` prefix, which makes them enumerable with
   a `SCAN` and distinguishes them from other keys in the same Redis instance.
3. The cache root is walked and everything that is neither referenced nor part of a referenced
   directory gets deleted, i.e. everything that has not been used for 30 days. Directories
   are descended into rather than removed as a whole and are only removed once nothing is
   left in them.

Since files are written before their cache key is stored, entries modified within the last
`CACHE_ORPHAN_GRACE_HOURS` (24 by default) are kept, so that a download or a generator run in
progress does not get deleted.

There is no exclusion list: an entry survives as long as it is referenced in Redis.

---

## Schedule

Celery beat dispatches the task every day at midnight, see `backend/beat/celery.py`:

```python
sender.add_periodic_task(
    MIDNIGHT_CRON,
    signature(Tasks.CLEANUP_CACHE_DIRS),
    name="cleanup-cache-dirs-task",
)
```

The task itself runs on the worker, which is the service that mounts the cache volume. It can
also be triggered manually:

```bash
docker compose exec odt-worker celery -A backend.worker call backend.worker.tasks.cleanup_cache_dirs
```

---
