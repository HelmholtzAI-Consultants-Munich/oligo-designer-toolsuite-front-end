---
title: Automated Updates
layout: default
nav_order: 8
parent: Development
---

# Automated Updates with GitHub Actions

The Oligo Designer Toolsuite uses GitHub Actions to automatically update critical data sources and configuration files. This ensures that the application always has access to the latest species lists, genome annotations, and form configurations without manual intervention.

## Overview

One automated workflow runs monthly to keep form configuration data current:

1. **YAML to JS Conversion** - Updates form configurations from the main repository

The workflow is scheduled to run on the 1st of every month at 2 AM UTC and can also be triggered manually.

> **Note:** Large species and annotation list modules (`refseqSpecies.ts`, `ensemblSpecies.ts`, `ncbiAnnotationReleases.ts`) are not part of the current application source tree. Any historical `update_genomic.yml` automation that generated them is not wired into this repository snapshot.

## YAML to JS Conversion

**Workflow:** `.github/workflows/update_yaml.yml`

This workflow fetches the latest form configurations from the main oligo-designer-toolsuite repository and converts them from YAML to JavaScript/TypeScript format for use in the web application.

### What it updates:

Converts the following YAML configuration files to TypeScript:

1. **OligoSeq Form** (`oligoseq_probe_designer.yaml` → `oligoseq_form.ts`)
2. **Scrinshot Form** (`scrinshot_probe_designer.yaml` → `scrinshot_form.ts`)
3. **MERFISH Form** (`merfish_probe_designer.yaml` → `merfish_form.ts`)
4. **SeqFISH+ Form** (`seqfish_plus_probe_designer.yaml` → `seqfish_form.ts`)
5. **Genomic Custom Form** (`genomic_region_generator_custom.yaml` → `genomic_custom_form.ts`)
6. **Genomic NCBI Form** (`genomic_region_generator_ncbi.yaml` → `genomic_ncbi_form.ts`)
7. **Genomic Ensembl Form** (`genomic_region_generator_ensemble.yaml` → `genomic_ens_form.ts`)

### Technical Details:

- **Schedule:** `0 2 1 * *` (2 AM on the 1st of every month)
- **Dependencies:** `pyyaml`, `ruamel.yaml`, `requests`
- **Python Version:** 3.9
- **Source:** Fetches from `https://raw.githubusercontent.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/refs/heads/main/data/configs/`

### Conversion Process:

The YAML to JS conversion process:

1. **Fetches YAML** from GitHub raw URLs
2. **Cleans content** by removing section headers and comments
3. **Preserves inline comments** for form field descriptions
4. **Normalizes keys** by removing hyphens and converting to camelCase
5. **Escapes strings** for JavaScript compatibility
6. **Handles special cases** like empty FASTA file fields
7. **Generates TypeScript exports** with proper formatting

## Manual Triggering

The workflow can be triggered manually through the GitHub Actions interface:

1. Go to the **Actions** tab in the repository
2. Select the workflow you want to run
3. Click **Run workflow**
4. Choose the branch and click **Run workflow**

## Monitoring and Troubleshooting

### Success Indicators:

- The workflow completes without errors
- Generated TypeScript files are committed and pushed
- Commit messages include "Updated YAML to JS conversion" (or similar)

### Common Issues:

1. **Network timeouts** - The workflows may fail if external APIs are slow
2. **Missing dependencies** - Ensure all required Python packages are listed in the workflow
3. **Permission issues** - Verify GitHub Actions has write access to the repository

### Logs:

Check the workflow logs in the GitHub Actions interface for detailed execution information and any error messages.

## Benefits

This automated update provides several key benefits:

- **Always Current Data** - Users have access to the latest species and configuration options
- **Reduced Maintenance** - No manual intervention required to keep data current
- **Consistency** - Updates happen on a predictable schedule
- **Reliability** - Automated processes reduce human error
- **Transparency** - All updates are logged and visible in the git history

## Configuration Files Generated

The automated updates generate the following TypeScript files in `src/forms/`:

- `oligoseq_form.ts` - OligoSeq probe designer form configuration
- `scrinshot_form.ts` - Scrinshot probe designer form configuration
- `merfish_form.ts` - MERFISH probe designer form configuration
- `seqfish_form.ts` - SeqFISH+ probe designer form configuration
- `genomic_custom_form.ts` - Genomic region generator (custom) form configuration
- `genomic_ncbi_form.ts` - Genomic region generator (NCBI) form configuration
- `genomic_ens_form.ts` - Genomic region generator (Ensembl) form configuration

These files are automatically imported and used by the React components to provide up-to-date form options.
