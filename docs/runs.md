---
title: Runs Management
layout: default
nav_order: 5
---

# Runs Management

The **Runs** section allows you to view and manage all your pipeline executions.  
You can access your runs in two main ways:

1. **By Run ID**  
   - Enter a specific `RunID` into the input field.  
   - Click **Go to Run** to view detailed information about that specific run.  
   - This is useful if you already know the exact ID of the run you want to inspect.

2. **By Session or Account**  
   - When you run a pipeline without being logged in, the system associates it with your **browser session**.  
   - If you later **register or log in**, all session-based runs will be automatically **transferred to your account**.  
   - Once runs are linked to your account, you can always access them in the **Runs** page without needing the Run ID.

---

## Runs Page

The runs overview displays:

- **Pipeline Name** – Which pipeline was executed (e.g., MERFISH, SeqFISH, OligoSeq, etc.).
- **Status** – Current state of the run:
  - `started` – The run is in progress.
  - `completed` – The run finished successfully.
  - `failed` – An error occurred during execution.
  - `unknown` – Status could not be determined.
- **Started** – The timestamp of when the run began.
- **Actions** – Options to **delete** a run.

---

## Run Detail Page

Clicking a run opens the **Run Detail** view, where you can:

- See **log files** in real-time while the pipeline is running.
- View and **download output files** in multiple formats.
- Inspect structured outputs (e.g., YAML) with specialized visualizations.
- Filter and download subsets of results (e.g., by gene or oligoset for oligo-based pipelines).
- Download:
  - CSV files for specific oligosets, entire genes, or all genes.
  - Excel files with each gene in a separate sheet.
- Delete the run if it’s no longer needed.

---

## Downloading Results

From the Run Detail page, you can download files in different ways:

- **Direct File Download** – Click the download button next to any output or log file.
- **CSV Downloads** – Extract results for a specific gene, oligoset, or all data at once.
- **Excel Download** – Organize each gene into its own worksheet.

---

## Session-Based Management Benefits

The session-to-account linking means:

- You can start a run before creating an account.
- You won’t lose your progress or results.
- When you later sign up or log in, your existing runs appear in your account automatically.
- You always have a central history of all runs—whether started anonymously or logged in.

---
