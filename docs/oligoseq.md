---
title: OligoSeq
layout: default
nav_order: 4
parent: Pipelines
---

# OligoSeq

The OligoSeq pipeline is designed for sequencing-based probe design workflows.  
It supports two main FASTA groups, a comprehensive set of probe property parameters, and an optional **Developer Settings** section. Users can either generate FASTA files directly from NCBI/Ensembl or upload their own, then submit the job to the backend.

## How it works

1. **Select inputs**
   - **Targets**: Provide a `.txt` file with one gene per line, or type a comma-separated gene list directly in the UI. If you type them, the backend will create a temporary file for you.
   - **FASTA groups** (two required):
     - Target probe database
     - Reference database for target probes  
       Each group allows either **Generate FASTA+** (from NCBI/Ensembl) or **Choose File** (upload). Multiple files/outputs are stored as newline-separated paths.

2. **Adjust parameters** for OligoSeq:
   - **Basic settings**: number of jobs, output directory, write intermediate steps, top N sets to keep.
   - **Target Probe Parameters**: probe length min/max, region split size, targeted exons, isoform consensus, GC content (min/opt/max), melting temperature bounds (min/opt/max), secondary structure limits, homopolymer run limits (A/T/C/G), self-complementarity, hybridization thresholds, set size min/opt, distance between probes, number of sets, and weights for GC and Tm.
   - **Melting Temperature Parameters**: thermodynamic tables (NN/TMM/IMM/ΔS), strand concentrations, salt correction type, ion concentrations, dNTP levels, and chemical correction parameters for DMSO/formamide.

3. **Developer Settings** (optional)  
   Provides advanced configuration:
   - Alignment methods (BLASTN/Bowtie) for specificity and cross-hybridization checks.
   - Search and hit parameters (percent identity, strand, word size, coverage, max hits, etc.).
   - Graph search constraints (max graph size, attempts) and heuristic toggles.

4. **Generate or Upload FASTA Files**
   - **Generate (FASTA+)**: Calls `/api/genomic/cascaded/{ncbi|ensembl}` to build the FASTA file, then stores the returned path.
   - **Upload**: Sends the file to `/api/upload` and stores the returned path.
   - The app concatenates multiple uploaded or generated files using newline separators.
   - Submission is only enabled once both FASTA groups contain at least one valid file path.
   - A **caching mechanism** ensures identical FASTA files are reused across runs to improve efficiency.
   - **Unused or stale files** in the cache are automatically cleaned up by a scheduled cron job to conserve storage.

5. **Submit the job**
   - The app creates a `runid` using `createRunId()` and packages the form data, replacing any file fields with the newline-joined paths.
   - Sends `{ formdata, runid }` to the backend via `POST /api/oligoseq`.

## Backend processing (`POST /api/oligoseq`)

1. Parses `formdata` and `runid`. If the gene list is provided as text, writes a temp `.txt` file and updates the form data.
2. Updates the run record in the database with status `started`, timestamp, pipeline type, and output path.
3. Writes the form data to a YAML config file in the run’s workspace directory (`config_oligoseq.yaml`).
4. Executes the OligoSeq probe designer CLI tool with the generated config:
   ```bash
   oligo_seq_probe_designer -c config_oligoseq.yaml
   ```
