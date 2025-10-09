---
title: Pipelines
layout: default
nav_order: 3
has_children: true
---

# Pipelines Overview

This application provides several specialized probe design pipelines, each with its own configuration interface under `/pipelines/*`.  
All pipelines share a consistent workflow: **prepare inputs → configure parameters → submit job → track results**.

---

## Available Pipelines

- **MERFISH** — *src/pages/merfish.tsx*  
  Multiplexed Error-Robust Fluorescence In Situ Hybridization pipeline for designing target probes, readout probes, and primers.
  
- **Scrinshot** — *src/pages/scrinshot.tsx*  
  Spatial transcriptomics probe designer with configurable target, readout, and primer parameters.

- **SeqFISH** — *src/pages/seqfish.tsx*  
  Sequential FISH probe designer for multi-round hybridization experiments.

- **OligoSeq** — *src/pages/oligoseq.tsx*  
  Sequencing-based probe designer optimized for NGS detection.

- **Genomic Region Generator** — *src/modules/FastaGenerateForm.tsx*  
  Extracts specific genomic regions (genes, exons, introns, UTRs, etc.) from NCBI or Ensembl reference genomes for use in downstream pipelines.

---

## Common Features

Each pipeline page provides:

- **FASTA input**  
  - Generate directly from genomic databases (**NCBI** / **Ensembl**)  
  - Or upload existing FASTA files from your computer
- **Multiple data sources** per pipeline (e.g., target probes, reference databases, primers)
- **Advanced parameter controls** for probe length, GC content, melting temperature, secondary structure, homopolymers, and more
- **Developer settings** for fine-grained control over BLASTN/Bowtie parameters and thermodynamic calculations
- **Job submission**  
  - Generates a unique **Run ID** via the helper API  
  - Sends all inputs and settings to the backend for processing

---

## Submission Workflow

1. **Select and prepare inputs**  
   Choose between generating FASTA files from NCBI/Ensembl or uploading them manually.  
   Some pipelines require multiple FASTA groups (e.g., MERFISH and SeqFISH require target, reference, and readout probe databases).

2. **Configure parameters**  
   Adjust basic, advanced, and developer-level settings to fit your experimental requirements.

3. **Submit**  
   On submission, the system:
   - Creates a new Run ID
   - Bundles all configuration values and file paths
   - Sends them via a `POST /api/<pipeline>` request to the backend

4. **Track progress**  
   - Runs appear in the **Runs** page, linked by your session or account  
   - You can view logs in real time and download results from the **Run Detail** page

---
For detailed parameter explanations and backend processing steps, see the dedicated pages for:
- [MERFISH](merfish.md)
- [Scrinshot](scrinshot.md)
- [SeqFISH](seqfish.md)
- [OligoSeq](oligoseq.md)
- [Genomic Region Generator](genomic-region-generator.md)
