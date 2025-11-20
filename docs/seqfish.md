---
title: SeqFISH
layout: default
nav_order: 3
parent: Pipelines
---

# SeqFISH

The SeqFISH pipeline page is designed for sequential FISH probe design workflows using three main parameter tabs — **Target Probe Parameters**, **Readout Probe Parameters**, and **Primer Parameters** — plus an optional **Developer Settings** section. Users can either generate required FASTA files directly from NCBI/Ensembl or upload their own, then submit the job to the backend.

## How it works

1. **Select inputs**
   - **Targets**: Provide a `.txt` file with one gene per line, or type a comma-separated gene list directly in the UI. If you type them, the backend will create a temporary file for you.
   - **FASTA groups** (four required):
     - Target probe database
     - Reference database for target probes
     - Reference database for readout probes
     - Reference database for primers  
       Each group allows either **Generate FASTA+** (from NCBI/Ensembl) or **Choose File** (upload). Multiple files/outputs are stored as newline-separated paths.

2. **Adjust parameters** for the selected tab:
   - **Target Probe Parameters**: probe length min/max, isoform consensus, GC content (min/opt/max), secondary structure thresholds (Tm, ΔG), homopolymer limits, UTR weights, set size min/opt, distance between probes, number of sets.
   - **Readout Probe Parameters**: reference FASTA, base probabilities, probe length, GC bounds, G-homopolymer limits, barcode rounds, pseudocolors, channel IDs.
   - **Primer Parameters**: reference FASTA, reverse primer sequence, primer length, base probabilities, GC bounds, GC clamp limits, homopolymer limits, self-complement limits, Tm min/max, and secondary structure thresholds.

3. **Developer Settings** (optional)  
   Shows advanced tabs relevant to the current section:
   - In **Target Probe**: specificity and cross-hybridization filters, BLASTN parameters, melting temperature settings.
   - In **Readout**: advanced readout configuration.
   - In **Primer**: advanced primer BLASTN and Tm options.

4. **Generate or Upload FASTA Files**
   - **Generate (FASTA+)**: Calls `/api/genomic/cascaded/{ncbi|ensembl}` to build the FASTA file, then stores the returned path.
   - **Upload**: Sends the file to `/api/upload` and stores the returned path.
   - The app concatenates multiple uploaded or generated files using newline separators.
   - Submission is only enabled once all four FASTA groups contain at least one valid file path.
   - A **caching mechanism** ensures identical FASTA files are reused across runs to improve efficiency.
   - **Unused or stale files** in the cache are automatically cleaned up by a scheduled cron job to conserve storage.

5. **Submit the job**
   - The app creates a `runid` using `createRunId()` and packages the form data, replacing any file fields with the newline-joined paths.
   - Sends `{ formdata, runid }` to the backend via `POST /api/seqfish`.

## Backend processing (`POST /api/seqfish`)

1. Parses `formdata` and `runid`. If the gene list is provided as text, writes a temp `.txt` file and updates the form data.
2. Updates the run record in the database with status `started`, timestamp, pipeline type, and output path.
3. Writes the form data to a YAML config file in the run’s workspace directory.
4. Executes the SeqFISH probe designer CLI tool with the generated config.
5. On completion:
   - Removes temporary input files.
   - Updates the run status to `completed` or `error`.
   - Returns stdout, stderr, and the return code to the frontend.

## Important notes

- All four FASTA groups must be provided before submission.
- Generated and uploaded files can be mixed in the same group; they are joined and later split again on the backend.
- A caching mechanism avoids regenerating identical FASTA files, while unused files are automatically removed via cron job cleanup.
- All API requests use `withCredentials: true`, so backend CORS must allow the frontend origin and credentials.
- Developer Settings are context-sensitive and change with the main tab to keep the UI focused.
- Once submitted, runs appear in the **Runs** list and can be inspected in detail.
