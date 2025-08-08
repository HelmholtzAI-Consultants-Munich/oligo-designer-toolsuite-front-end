---
layout: page
title: Pipelines
permalink: /pipelines.html
---

## Overview

The app exposes dedicated pages under `/pipelines/*`:

- `/pipelines/merfish`
- `/pipelines/seqfish`
- `/pipelines/scrinshot`
- `/pipelines/genomic`

Each page offers:
- FASTA **generate or upload** options
- Parameter forms (e.g., species, annotation source **NCBI/Ensembl**, probe constraints)
- Optional **developer settings**
- Submit button to create a **Run**

### MERFISH

File: `src/pages/merfish.tsx`  
Highlights:
- Choose input source (**NCBI** or **Ensembl**) via form blocks
- Multiple FASTA groups (reference, readout, primer) can be configured
- Uses helper to obtain a **Run ID**

### Scrinshot

File: `src/pages/scrinshot.tsx`  
Highlights:
- Similar FASTA handling to MERFISH
- Uses `createRunId()` then posts configuration to backend

### Genomic / SeqFISH

Files: `src/pages/genomic.tsx`, `src/pages/seqfish.tsx`  
- Genomic: integrates **NCBI** and **Ensembl** forms
- SeqFISH: probe design for sequential FISH workflows