---
title: SeqFISH
layout: default
nav_order: 3
parent: Pipelines
---

# SeqFISH

The SeqFISH pipeline page supports the design of target probes, readout probes, and primers for sequential FISH experiments.  
It requires multiple FASTA inputs, each of which can be generated from NCBI/Ensembl or uploaded manually.  
The interface is organized into three parameter tabs plus optional developer settings.

---

## Workflow

1. **Provide target genes**  
   - Enter a comma-separated list directly in the input field, or upload a `.txt` file with one gene per line.  
   - If typed, the backend writes a temporary `.txt` file before starting the run.

2. **Prepare FASTA sources** (required groups)  
   - **Target Probe Database**  
   - **Reference Database for Target Probes**  
   - **Reference Database for Readout Probes**  
   - **Reference Database for Primers**  
   Each group supports:
     - **Generate FASTA+** — triggers a genomic retrieval request (NCBI or Ensembl) and stores the returned file path.  
     - **Choose File** — upload one or more files.  
   Multiple files/outputs are stored as a newline-separated list of paths.

3. **Configure parameters**
   - **Target Probe Parameters**: length min/max, isoform consensus, GC content (min/opt/max), secondary structure thresholds (Tm, ΔG), homopolymer limits, GC/UTR weights, set size min/opt, distance between probes, number of sets.
   - **Readout Probe Parameters**: reference FASTA, base probabilities, probe length, GC bounds, G homopolymer limits, barcode rounds, pseudocolors, channel IDs.
   - **Primer Parameters**: reference FASTA, reverse primer sequence, primer length, base probabilities, GC bounds, GC clamp limits, homopolymer limits, self-complement limits, Tm min/max, secondary structure thresholds.
   - **Developer Settings**:  
     - BLASTN specificity and cross-hybridization parameters for target, readout, and primers.  
     - Tm calculation settings (nearest neighbor, ionic/chemical corrections).  
     - Heuristic search settings (max graph size, number of attempts).

4. **Submit**  
   - Generates a `runid` with `createRunId()`.  
   - Injects all generated/uploaded FASTA paths (newline-joined) into the payload.  
   - Sends `{ formdata, runid }` via `POST /api/seqfish` to the backend.

---

## Backend processing (`POST /api/seqfish`)

1. **Setup**
   - Resolve user/session directory and config file path.
   - Parse `formdata` and validate `runid` against the database.

2. **Pre-process inputs**
   - If gene list is text, write a temp `.txt` file and update `file_regions`.
   - Create timestamped output directory and mark run as `started` in MongoDB.

3. **Build YAML config**
   - Includes all target, readout, and primer parameters.
   - Lists all FASTA paths from uploads or generated files.
   - Encodes developer BLASTN and Tm parameters.
   - Saves config to the user/session directory.

4. **Run pipeline**
   - Executes: `seqfish_probe_designer -c <config.yaml>`.
   - On success, marks run as `completed`; on error, marks as `error`.

5. **Cleanup**
   - Removes temporary files created during preprocessing.
   - Updates run record with final status and output path.

---

## Key points

- Four FASTA groups are required before submission.
- Generated and uploaded files can be mixed in the same group.
- All API calls use `withCredentials: true`; backend CORS must allow credentials.
- Developer Settings give fine-grained control over BLASTN filters and thermodynamic calculations.
- After submission, runs appear in the **Runs** list with links to detail views.
