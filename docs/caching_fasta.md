
# Genomic Region Caching — `caching_fasta.md`

## Overview

To improve efficiency and reduce redundant computation, the genomic region extraction pipeline implements a caching mechanism. This system ensures:

- Faster response time for repeated or similar requests
- Reduced computational load on the server
- Reuse of previously processed genomic annotations

---

## What is Cached?

Each genomic region request is decomposed into individual region-specific forms (e.g., one for `gene`, one for `exon`, etc.).

For each form:
- A unique cache key is generated using a hash of relevant form fields
- Output files (such as `.fna`) are stored in a dedicated directory:
  ```
  /path/to/cache/cached_genomic_<hash>/
  ```
- If the directory already exists and contains valid output, the pipeline step is skipped and the results are reused

---

## Cache Key Construction

The cache key is a SHA256 hash generated from the following subset of the form data:

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
    "exon": "false",
    ...
  }
}
```

Only these fields are considered. Any changes to them will result in a new cache key and a new cached directory.

---

## Caching Workflow

1. The user submits a request to `/api/genomic/cascaded/ncbi` or `/ensembl`
2. The server generates per-region forms where only one genomic region is selected as `true`
3. For each form:
   - A cache key is computed
   - The server checks if cached output exists under `/cache/cached_genomic_<key>/annotation/*.fna`
4. If a cached directory exists:
   - The contents are reused
   - The directory's access time is updated
5. If no cache is found:
   - A YAML configuration is created
   - The genomic region generator is invoked
   - Output is stored in the designated cache directory
   - The temporary YAML file is deleted after use

---

## Cache Directory Layout

```
cache/
├── cached_genomic_d85ff123.../
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
