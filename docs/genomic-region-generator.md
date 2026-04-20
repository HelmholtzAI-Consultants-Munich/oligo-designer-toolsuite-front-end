---
title: Genomic Region Generator
layout: default
nav_order: 5
parent: Pipelines
---

# Genomic Region Generator

The Genomic Region Generator extracts specific genomic regions (genes, exons, introns, UTRs, etc.) from reference genomes sourced from NCBI or Ensembl.  
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

## Use cases

1. **Probe design pipelines**: Generate target and reference databases for ISH probe design
2. **Custom sequence extraction**: Extract specific genomic features for analysis
3. **Multi-species workflows**: Process annotations from different organisms in parallel
4. **Version-controlled analyses**: Use specific annotation releases for reproducible research
