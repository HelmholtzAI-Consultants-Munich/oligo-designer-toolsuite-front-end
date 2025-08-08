---
title: OligoSeq
layout: default
nav_order: 4
parent: Pipelines
---

# OligoSeq

The OligoSeq pipeline designs target probes for sequencing-based detection.  
It supports generating or uploading FASTA sequences for both the **Target Probe Database** and **Reference Database for Target Probes**, and provides extensive probe property and developer settings.

---

## Workflow

1. **Provide target genes**  
   - Enter as a comma-separated list or upload a `.txt` file (one gene per line).  
   - If typed, the backend generates a temporary `.txt` file and updates the `file_regions` field.

2. **Prepare FASTA sources** (two required groups)  
   - **Target Probe Database**  
   - **Reference Database for Target Probes**  
   For each group:
     - **Generate FASTA+** — queries NCBI/Ensembl and stores generated file paths.  
     - **Choose File** — upload one or more `.fasta` or `.fa` files.  
   Multiple files are newline-joined before submission.

3. **Set parameters**  
   - **Basic settings**:  
     - Number of jobs, output directory, write intermediate steps, top N sets to keep.  
   - **Target probe properties**:  
     - Length min/max, region split size, targeted exons, isoform consensus.  
     - GC content (min/opt/max), melting temperature (min/opt/max), secondary structure limits (Tm, ΔG).  
     - Homopolymer run limits (A/T/C/G), self-complement max length, hybridization probability threshold.  
     - Weights for GC and Tm in selection, set size min/opt, distance between probes, number of sets.
   - **Developer parameters**:  
     - Alignment methods (BLASTN/Bowtie) for hybridization probability and cross-hybridization.  
     - Search and hit parameters for each method (percent identity, strand, word size, coverage, etc.).  
     - Graph search limits (max graph size, attempts) and heuristic toggles.  
   - **Melting temperature parameters**:  
     - Thermodynamic tables (NN/TMM/IMM/ΔS), strand concentrations, salt correction type, ion concentrations, dNTP levels.  
     - Chemical correction parameters for DMSO and formamide.

4. **Submit**  
   - Calls `createRunId()` to register a new run in MongoDB.  
   - Injects newline-joined FASTA file paths and parameter values into the form payload.  
   - Sends `{ formdata, runid }` via `POST /api/oligoseq` to the backend.

---

## Backend processing (`POST /api/oligoseq`)

1. **User/session context**  
   - Authenticated users store configs in `user_data/<user_id>`.  
   - Anonymous sessions store in `user_data/anon/<session_id>`.

2. **Input handling**  
   - Gene list text is converted into a `.txt` file if needed.  
   - Output directory is timestamped; MongoDB run record is updated to `started`.

3. **YAML config creation**  
   - Combines all form values into a structured dictionary, matching probe designer CLI requirements.  
   - Saves to `config_oligoseq.yaml` in the user/session directory.

4. **Pipeline execution**  
   - Runs:  
     ```bash
     oligo_seq_probe_designer -c config_oligoseq.yaml
     ```  
   - Marks status `completed` if `returncode == 0`, else `error`.

5. **Cleanup**  
   - Deletes temporary gene list file.  
   - Removes any uploaded/generated FASTA files for both database groups.  
   - Updates MongoDB run status with final result.

---

## Key points

- Both FASTA groups are required before submission is enabled.  
- Multiple files per group are supported and stored as newline-joined paths in the payload.  
- Extensive developer options make OligoSeq suitable for advanced experimental setups.  
- All API calls are credential-aware — ensure backend CORS is configured to allow credentials.  
- Once submitted, runs appear in the **Runs** list and can be inspected in detail.
