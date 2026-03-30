---
title: Genomic Region Generator
layout: default
nav_order: 5
parent: Pipelines
---

# Genomic Region Generator

The Genomic Region Generator pipeline extracts specific genomic regions (genes, exons, introns, UTRs, etc.) from reference genomes sourced from NCBI or Ensembl.  
It supports flexible region selection, automatic file retrieval, and efficient caching to accelerate subsequent runs with identical parameters.

## How it works

1. **Select data source**
   - Choose between **NCBI** or **Ensembl** as your genome annotation source.
   - Each source provides access to curated reference genomes and annotations for various species.

2. **Configure source parameters**
   - **For NCBI**:
     - **Taxon**: Select the taxonomic group (e.g., Vertebrate Mammalian, Archaea, Bacteria, Fungi, Invertebrate, Plant, etc.)
     - **Species**: Choose a specific species from the selected taxon
     - **Annotation Release**: Pick the desired annotation version
   - **For Ensembl**:
     - **Species**: Select from available Ensembl species
     - **Annotation Release**: Pick the desired release version

3. **Select genomic regions**  
   Choose one or more regions to extract:
   - **Gene**: Full gene sequences including all features
   - **Intergenic**: Sequences between genes
   - **Exon**: Coding and non-coding exonic sequences
   - **UTR**: Untranslated regions (5' and 3')
   - **CDS**: Coding sequences only
   - **Intron**: Intronic sequences
   - **Exon-Exon Junction**: Splice junction sequences
     - If selected, specify the **Block Size** (number of nucleotides to include from each flanking exon)

4. **Generate FASTA files**
   - When you click **Generate FASTA+**, the form data is sent to `/api/genomic/cascaded/custom`.
   - The backend processes your request using a two-level caching mechanism (see [Caching FASTA Files](caching_fasta.md) for details).
   - Multiple region selections are handled in a single request, with each region combination cached independently.
   - The system returns paths to generated FASTA files, which can be used directly in downstream pipelines (OligoSeq, MERFISH, seqFISH+, Scrinshot).

5. **Caching mechanism**
   - **First-level cache**: Checks if the exact region FASTA files have already been generated with the same parameters.
   - **Second-level cache**: Reuses downloaded and decompressed genome annotation (.gtf) and sequence (.fna) files from NCBI or Ensembl.
   - Cached files are stored in `backend/cache/` with unique identifiers based on form parameters.
   - For more details on caching strategy, cleanup, and configuration, see the [Caching FASTA Files](caching_fasta.md) page.

## Backend processing (`POST /api/genomic/cascaded/custom`)

1. **Parse and validate input**  
   Extracts form data including source, source parameters, genomic regions, and optional block size.

2. **Prepare workspace**  
   Creates a user or session-specific working directory for organizing outputs.

3. **Initialize run record**  
   Inserts a new document in MongoDB with status `started`, pipeline type `Genomic Region Generator`, and output path.

4. **Generate cache key**  
   Creates a unique hash based on source parameters and selected regions to identify cached results.

5. **First-level cache check**  
   Looks for pre-existing region FASTA files in `cache/cached_genomic_{hash}/annotation/`.  
   If found, returns cached file paths immediately.

6. **Second-level cache (if needed)**
   - **For NCBI**: Calls `_prepare_ncbi_cached_assets()` to fetch or reuse compressed genome files (.gtf.gz, .fna.gz), verify MD5 checksums, and decompress.
   - **For Ensembl**: Calls `_prepare_ensembl_cached_assets()` for similar processing with Ensembl FTP structure.
   - Stores decompressed files in `cache/ncbi/` or equivalent for reuse across runs.

7. **Build custom YAML config**  
   Creates a configuration file specifying:

   ```yaml
   dir_output: cache/cached_genomic_{hash}
   source: custom
   source_params:
     file_annotation: /path/to/cached.gtf
     file_sequence: /path/to/cached.fna
     files_source: NCBI|Ensembl
     species: <species_name>
     annotation_release: <release_number>
     genome_assembly: <assembly_name>
   genomic_regions:
     gene: true|false
     intergenic: true|false
     exon: true|false
     # ... other regions
   exon_exon_junction_block_size: 50
   ```

8. **Execute pipeline**  
   Runs the genomic region generator CLI tool in "custom" mode:

   ```bash
   genomic_region_generator -c config_genomic_{hash}.yaml
   ```

9. **Collect outputs**  
   Gathers all generated `.fna` files from the output annotation directory, excluding raw genome assemblies (files containing "GCF" or "GCA" in their names).

10. **Update status and return**  
    Updates the MongoDB run record to `completed` or `error`, removes temporary config files, and returns:
    ```json
    {
      "status": "success",
      "message": "Genomic processing completed successfully. X used from cache.",
      "output": ["/path/to/region1.fna", "/path/to/region2.fna"],
      "cached": ["cache_key1", "cache_key2"]
    }
    ```

## Frontend configuration

Genomic region jobs are configured through JSON Schema form definitions in `src/forms/genomic_custom_form.ts`, `src/forms/genomic_ncbi_form.ts`, and `src/forms/genomic_ens_form.ts` (maintained via the YAML-to-TypeScript automation described in [Automated Updates]({{ site.baseurl }}{% link automated-updates.md %})). The React app renders those schemas with **react-jsonschema-form**, so behavior such as dynamic fields and validation follows the generated schema rather than a dedicated FASTA form component.

## Use cases

1. **Probe design pipelines**: Generate target and reference databases for ISH probe design
2. **Custom sequence extraction**: Extract specific genomic features for analysis
3. **Multi-species workflows**: Process annotations from different organisms in parallel
4. **Version-controlled analyses**: Use specific annotation releases for reproducible research
