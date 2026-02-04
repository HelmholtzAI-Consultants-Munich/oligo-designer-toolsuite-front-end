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

- **SCRINSHOT** — _src/pages/scrinshot.tsx_  
  Designs padlock probes with gene-specific 5' and 3' arms that circularize upon hybridization to detect and quantify RNA transcripts at single-cell resolution. These probes enable highly multiplexed and spatially resolved gene expression analysis in tissue samples.

- **MERFISH** — _src/pages/merfish.tsx_  
  Designs encoding probes with unique barcodes that enable simultaneous imaging and identification of hundreds of different transcripts within a single sample. This highly multiplexed approach provides detailed, spatially resolved gene expression information at the single-cell level.

- **SeqFISH+** — _src/pages/seqfish.tsx_  
  Designs probes for sequential fluorescence in situ hybridization, enabling multiple rounds of hybridization and imaging to visualize and quantify hundreds of RNA targets in a single sample. This technique preserves spatial context while providing high-throughput and single-cell resolution.

- **Oligo-Seq** — _src/pages/oligoseq.tsx_  
  Designs oligo hybridization probes optimized for probe-based targeted sequencing to measure RNA expression. These probes are specifically tailored for next-generation sequencing detection methods.

- **Genomic Region Generator** — _src/modules/FastaGenerateForm.tsx_  
  Extracts specific genomic regions (intergenic, gene, CDS, exon, intron, 3' UTR, 5' UTR, exon-exon junctions) from FASTA and GTF files, which can be automatically retrieved from NCBI or Ensembl or provided as custom files. The extracted regions are stored in a compressed memory-efficient format that eliminates duplicated sequences from common exons of different gene isoforms while preserving isoform information.

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
