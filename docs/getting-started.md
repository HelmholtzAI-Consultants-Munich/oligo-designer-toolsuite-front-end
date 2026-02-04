---
title: Getting Started
layout: default
nav_order: 2
---

# Getting Started

Welcome to **Oligo Designer Toolsuite Cloud**! This guide will help you get started using the web application to run advanced oligo design pipelines.

---

## Accessing the Application

The Oligo Designer Toolsuite Cloud web application is accessible through your web browser. Contact your administrator or check your organization's documentation for the specific URL where the application is hosted.

Once you access the application, you can start using it immediately—no account is required for basic usage. However, creating an account allows you to:

- Access your pipeline runs from any device
- Keep a permanent history of all your experiments
- Automatically transfer runs from anonymous sessions to your account

See [Authentication]({{ site.baseurl }}{% link auth.md %}) for more details on creating an account and managing your sessions.

---

## Your First Pipeline Run

The application provides several specialized probe design pipelines:

- **MERFISH Probe Designer** — Designs encoding probes for highly multiplexed spatial transcriptomics
- **SeqFISH+ Probe Designer** — Designs probes for sequential fluorescence in situ hybridization
- **Scrinshot Probe Designer** — Designs padlock probes for single-cell RNA detection
- **Oligo-Seq Probe Designer** — Designs oligo hybridization probes for targeted sequencing
- **Genomic Region Generator** — Extracts specific genomic regions from FASTA and GTF files

### Basic Workflow

1. **Navigate to a Pipeline** — Select the pipeline you want to use from the navigation menu
2. **Configure Parameters** — Fill in the required form fields with your experimental parameters
3. **Submit** — Click the submit button to start the pipeline execution
4. **Track Progress** — Monitor your run's status and view results when complete

Each pipeline has its own detailed documentation with specific configuration options and requirements. See the [Pipelines]({{ site.baseurl }}{% link pipelines.md %}) section for an overview, or navigate to individual pipeline guides for detailed instructions.

---

## Managing Your Runs

All your pipeline executions are tracked in the **Runs** section. You can:

- View all runs associated with your session or account
- Access detailed information about each run, including logs and output files
- Download results and generated files
- Track run status (started, running, completed, error, etc.)

See [Runs Management]({{ site.baseurl }}{% link runs.md %}) for complete details on viewing and managing your pipeline executions.

---

## Supported Platforms

The web application works with modern web browsers on:

- **Linux** (amd64 and arm64)
- **macOS** (amd64 and arm64)
- **Windows** (via web browser)

No local installation is required—everything runs through your web browser.

---

## Citation

If you use this platform for your research, please cite the main [Oligo Designer Toolsuite](https://doi.org/10.5281/zenodo.7823048).

---

## Getting Help

- **Pipeline Documentation** — See the [Pipelines]({{ site.baseurl }}{% link pipelines.md %}) section for detailed guides on each pipeline
- **User Guides** — Check the sidebar for guides on authentication, run management, and more
- **Support** — For issues or questions, please see our [GitHub issues page](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end/issues)

---

> **Tip:** Use the sidebar to navigate between different sections of the documentation. Start with the pipeline-specific guides to learn about configuring each type of experiment.
