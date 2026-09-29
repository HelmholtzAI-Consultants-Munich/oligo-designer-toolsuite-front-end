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

- **SCRINSHOT** — _src/pages/Scrinshot.tsx_  
  Designs padlock probes with gene-specific 5' and 3' arms that circularize upon hybridization to detect and quantify RNA transcripts at single-cell resolution. These probes enable highly multiplexed and spatially resolved gene expression analysis in tissue samples.

- **MERFISH** — _src/pages/Merfish.tsx_  
  Designs encoding probes with unique barcodes that enable simultaneous imaging and identification of hundreds of different transcripts within a single sample. This highly multiplexed approach provides detailed, spatially resolved gene expression information at the single-cell level.

- **SeqFISH+** — _src/pages/SeqFish.tsx_  
  Designs probes for sequential fluorescence in situ hybridization, enabling multiple rounds of hybridization and imaging to visualize and quantify hundreds of RNA targets in a single sample. This technique preserves spatial context while providing high-throughput and single-cell resolution.

- **Oligo-Seq** — _src/pages/OligoSeq.tsx_  
  Designs oligo hybridization probes optimized for probe-based targeted sequencing to measure RNA expression. These probes are specifically tailored for next-generation sequencing detection methods.

- **HCR** — _src/pages/Hcr.tsx_  
  Designs pairs of split-initiator probes for hybridization chain reaction. A fluorescent signal is amplified only where both probes of a pair bind next to each other on the transcript.

- **Cycle HCR** — _src/pages/CycleHcr.tsx_  
  Designs primary probes with readout barcodes for cyclic hybridization chain reaction. Readout probes and HCR hairpins are exchanged over several imaging cycles to detect many RNA targets in one sample.

---

## Common Features

Each pipeline page provides:

- **FASTA input**
  - Generate directly from genomic databases (**NCBI** / **Ensembl**)
  - Or upload existing FASTA files from your computer
- **Required Parameters** — the target genes and the target and reference genomes, shown at the top of the first tab
- **Quick Settings** — the most important parameters of each tab, shown at the top of that tab
- **Tabs and sections** — one tab per probe type (e.g. target probes, readout probes, primers), with the remaining parameters grouped into sections for probe length, GC content, melting temperature, secondary structure, specificity filters, and more
- **Optional filters** — a checkbox turns a filter on and shows its parameters; some large parameter groups start collapsed to save space
- **Codebook and probe tables** — MERFISH, SeqFISH+, HCR and Cycle HCR let you load or generate these, see [Codebooks and Probe Tables](#codebooks-and-probe-tables)
- **Job submission**
  - Generates a unique **Run ID** via the helper API
  - Sends all inputs and settings to the backend for processing

---

## Codebooks and Probe Tables

MERFISH, SeqFISH+, HCR and Cycle HCR assign barcodes to genes with a codebook and attach readout or initiator sequences from a probe table. For each of these, a dropdown lets you choose the source:

- **Generate** — the pipeline creates the table from your parameters.
- **Load** — you upload your own file (CSV or TSV). The field's tooltip describes the required columns.

| Pipeline  | Codebook         | Probe table                           |
| --------- | ---------------- | ------------------------------------- |
| MERFISH   | Generate or Load | Readout probe table: Generate or Load |
| SeqFISH+  | Generate or Load | Readout probe table: Generate or Load |
| HCR       | Load             | Initiator table: Load                 |
| Cycle HCR | Generate or Load | Readout probe table: Load             |

HCR offers **Generate** in the form, but the current ODT version cannot generate these tables yet, so the run fails unless you choose **Load**.

> **Note:** Settings saved with **Export Settings** on the run detail page do not contain uploaded files. After you import them with **Import Settings**, upload the files again.

---

## FASTA File Input Requirements

All pipelines require FASTA files as input. When uploading custom FASTA files, they must adhere to the following structure:

### Header Format

Each sequence must have a header starting with the `>` character. The header should contain:

- **`region_id`**: A unique identifier for the genomic region (e.g., gene name or ID). This is **mandatory**.
- **`additional_information`**: Optional metadata fields such as transcript ID or exon number, separated by commas.
- **`coordinates`**: Genomic location in the format `chrom:start-end(strand)`, which is optional.

The header format uses double colons (`::`) as separators between the region ID, additional information, and coordinates.

### Sequence Content

The sequence follows the header in standard FASTA format (single-letter nucleotide codes: A, T, G, C, N).

### Examples

**With all optional fields:**

```
>ASR1::transcrip_id=XM456,exon_number=5::16:54552-54786(+)
AGTTGACAGACCCCAGATTAAAGTGTGTCGCGCAACAC
```

**With only the mandatory region_id:**

```
>ASR1
AGTTGACAGACCCCAGATTAAAGTGTGTCGCGCAACAC
```

**Note:** When using the Genomic Region Generator to create FASTA files from NCBI or Ensembl, the files are automatically formatted correctly. Only manually uploaded FASTA files need to follow this format.

---

## Submission Workflow

1. **Select and prepare inputs**  
   Choose between generating FASTA files from NCBI/Ensembl or uploading them manually.  
   Every pipeline needs two genomes in its **Required Parameters**: the **Target Genome** (`required_parameters.target_genome`), from which the probe sequences are generated, and the **Reference Genome** (`required_parameters.reference_genome`), which all specificity filters of the run check the probes against.

2. **Configure parameters**  
   Set the quick settings of each tab, then adjust the parameters in the tabs and sections to fit your experimental requirements.

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
- [HCR](hcr.md)
- [Cycle HCR](cyclehcr.md)
- [Genomic Region Generator](genomic-region-generator.md)
