---
title: Scrinshot
layout: default
nav_order: 2
parent: Pipelines
---

# Scrinshot

The Scrinshot pipeline page is designed for padlock probe design and has two main parameter tabs: **Target Probe Parameters** and **Detection Oligo Parameters**.  
Two FASTA groups are required — **Target Probe Database** and **Reference Database for Target Probes** — which can be generated from NCBI/Ensembl or uploaded manually.  
Once all inputs are ready, a **Run ID** is created and the configuration is sent to the backend.

---

## Workflow

1. **Provide target genes**  
   - Enter a comma-separated list directly in the text field, or upload a `.txt` file with one gene per line.  
   - If you type the genes, the backend will create a temporary `.txt` file before processing.

2. **Prepare FASTA sources** (two required groups)  
   - **Target Probe Database**  
   - **Reference Database for Target Probes**  
   Each group supports:  
     - **Generate FASTA+** — submits the configured NCBI/Ensembl form and stores the returned file path.  
     - **Choose File** — upload one or more files.  
   Multiple files/outputs are stored as a newline-separated list of paths.

3. **Set parameters**  
   - **Target Probe Parameters**: probe length (min/max), isoform consensus, GC content (min/opt/max), melting temperature (min/opt/max), homopolymer limits (A/T/C/G), padlock arm melting temperature and length limits, ligation region size, oligo set selection weights, minimum/optimal set size, distance between probes, maximum number of sets.  
   - **Detection Oligo Parameters**: minimum thymines, detection oligo length (min/max), U-distance, target Tm.

4. **Developer Settings** (optional)  
   Context-sensitive advanced parameters for:  
   - Specificity filters (BLASTN)  
   - Cross-hybridization filters (BLASTN)  
   - Oligo set selection parameters  
   - Melting temperature parameters

5. **Submit**  
   - The frontend calls `createRunId()` to get a unique `runid`.  
   - All generated or uploaded FASTA paths are merged into newline-joined strings and injected into the corresponding form fields.  
   - The final payload `{ formdata, runid }` is sent via `POST /api/scrinshot` to the backend.

---

## Backend processing (`POST /api/scrinshot`)

1. **Prepare inputs**  
   - If a gene list is provided as text, save it as a temporary `.txt` file and update the `file_regions` field.  
   - Create a timestamped output directory and mark the run as `started` in the database.

2. **Write YAML configuration**  
   - Core fields:
     - `n_jobs`, `dir_output`, `write_intermediate_steps`, `top_n_sets`
     - Input files: `file_regions`, `files_fasta_target_probe_database`, `files_fasta_reference_database_target_probe`
     - Target probe constraints: length, isoform consensus, GC content, Tm, homopolymer limits
     - Padlock arm constraints: Tm difference max, length min, Tm min/max
     - BLASTN specificity and cross-hyb settings
     - Set selection weights, set size, distance between probes, number of sets
     - Detection oligo: min thymines, length min/max, U-distance, optimal Tm
     - Tm calculation parameters (NN/TMM/IMM/ΔS tables, ion/salt concentrations, chemical corrections)

3. **Run pipeline**  
   - Execute: `scrinshot_probe_designer -c <config.yaml>`  
   - If `returncode == 0`, mark as `completed`; otherwise `error`.

4. **Cleanup**  
   - Delete the temporary gene list and all uploaded/generated FASTA files.  
   - Update the run record in the database with the final status and output.

---

## Key points

- Both FASTA groups are mandatory before submission is enabled.  
- You can mix generated and uploaded files for the same group; the backend splits them back on newline.  
- All API calls use `withCredentials: true` — make sure backend CORS allows the frontend origin and credentials.  
- After submission, the run appears in the **Runs** list and can be inspected in the run detail view.
