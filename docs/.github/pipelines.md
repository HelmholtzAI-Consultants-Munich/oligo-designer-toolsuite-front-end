---
title: Pipelines
layout: default
nav_order: 3
has_children: true
---
This app provides dedicated pages under `/pipelines/*`:

- **MERFISH** — `src/pages/merfish.tsx`
- **SeqFISH** — `src/pages/seqfish.tsx`
- **Scrinshot** — `src/pages/scrinshot.tsx`
- **Genomic** — `src/pages/genomic.tsx`

Each page has:
- FASTA **generate or upload**
- Source selector (**NCBI** / **Ensembl**)
- Advanced parameters
- Submit → creates a **Run ID**

### MERFISH
- Multiple FASTA groups (reference, readout, primer)
- Uses helper to create Run ID and post config

### Scrinshot
- Similar to MERFISH, with its own parameter set
