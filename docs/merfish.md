---
title: MERFISH
layout: default
nav_order: 1
parent: Pipelines
---

# MERFISH

MERFISH (Multiplexed Error-Robust Fluorescence In Situ Hybridization) probes are short DNA oligonucleotides designed to label specific RNA molecules in cells. They incorporate unique “barcodes” that enable simultaneous imaging and identification of hundreds of different transcripts, all within a single sample. This highly multiplexed approach provides detailed, spatially resolved gene expression information at the single-cell level.

A MERFISH encoding probe is a fluorescent probe that contains a 30-nt targeting sequence which directs their binding to the specific RNA, two 20-nt barcode sequences, which are read out by fluorescent secondary readout probes, single A-nucleotide spacers between readout and gene-specific regions, and two 20-nt PCR primer binding sites. The specific readout sequences contained by an encoding probe are determined by the binary barcode assigned to that RNA.

![MERFISH Probe Structure](assets/images/pipeline_merfish_probes.webp)

## Pipeline Description

The pipeline has four major steps:

- Probe generation (dark blue),

- Probe filtering by sequence property and binding specificity (light blue),

- Probe set selection for each gene (green), and

- Final probe sequence generation (yellow).

![MERFISH Pipeline Structure](assets/images/pipeline_merfish2.webp)

For the probe generation step, the user has to provide a FASTA file with genomic sequences which is used as reference for the generation of probe sequences. The probe sequences are generated using the OligoSequenceGenerator. Therefore, the user has to define the probe length (can be given as a range), and optionally provide a list of gene identifiers (matching the gene identifiers of the annotation file) for which probes should be generated. If no gene list is given, probes are generated for all genes in the reference. The probe sequences are generated in a sliding window fashion from the DNA sequence of the non-coding strand, assuming that the sequence of the coding strand represents the target sequence of the probe. The generated probes are stored in a FASTA file, where the header of each sequence stores the information about its reference region and genomic coordinates. In a next step, this FASTA file is used to create an OligoDatabase, which contains all possible probes for a given set of genes. When the probe sequences are loaded into the database, all probes of one gene having the exact same sequence are merged into one entry, saving the transcript, exon and genomic coordinate information of the respective probes.

In the second step, the number of probes per gene is reduced by applying different sequence property (PropertyFilter) and binding specificity filters (SpecificityFilter). For the MERFISH protocol, the following filters are applied: removal of sequences that contain unidentified nucleotides (HardMaskedSequenceFilter), that contain low-complexity region like repeat regions (SoftMaskedSequenceFilter), that have a GC content (GCContentFilter) or melting temperature (MeltingTemperatureNNFilter) outside a user-specified range, that contain homopolymeric runs of any nucleotide longer than a user-specified threshold (HomopolymericRunsFilter), that contain secondary structures like hairpins below a user-defined free energy threshold (SecondaryStructureFilter). After removing probes with undesired sequence properties from the database, the probe database is checked for probes that potentially cross-hybridize, i.e. probes from different genes that have the exact same or similar sequence. Those probes are removed from the database to ensure uniqueness of probes for each gene. Cross-hybridizing probes are identified with the CrossHybridizationFilter that uses a BlastN alignment search to identify similar sequences and removes those hits with the RemoveByBiggerRegionPolicy that sequentially removes the probes from the genes that have the bigger probe sets. Next, the probes are checked for off-target binding with any other region of a provided background reference. Off-target regions are sequences of the background reference (e.g. transcriptome or genome) which match the probe region with a certain degree of homology but are not located within the gene region of the probe. Those off-target regions are identified with the BlastNFilter that removes probes where a BlastN alignment search found off-target sequence matches with a certain coverage and similarity, for which the user has to define thresholds.

In the third step of the pipeline, the best sets of non-overlapping probes are identified for each gene. The OligosetGeneratorIndependentSet class is used to generate ranked, non-overlapping probe sets where each probe and probe set is scored according to a protocol dependent scoring function, i.e. by the distance to the optimal GC content and melting temperature, weighted by the number of targeted transcripts of the probes in the set. Following this step all genes with insufficient number of probes (user-defined) are removed from the database and stored in a separate file for user-inspection.

In the last step of the pipeline, the ready-to-order probe sequences containing all additional required sequences are designed for the best non-overlapping sets of each gene. For the MERFISH protocol two readout sequences are added to the probe, creating the encoding probes. A pool of readout probe sequences is created from random sequences with user-defined per base probability that have a GC content (GCContentFilter) within a user-specified range and no homopolymeric runs of three or more G nucleotides (HomopolymericRunsFilter). Additionally, the readout probes are checked for off-target binding (BlastNFilter) against the transcriptome and cross-hybridization (CrossHybridizationFilter) against other readout probe sequences where hits are removed with the RemoveByDegreePolicy that iteratively removes readout probes with the highest number of hits against other readout probes. The readout probes are assigned to the probes according to a protocol-specific encoding scheme described in Wang et al. [3]. In addition, one forward and one reverse primer is provided. The reverse primer is the 20nt T7 promoter sequence (TAATACGACTCACTATAGGG) and the forward primer is created from a random sequence with user-defined per base probability that fulfills the following criteria: GC content (GCContentFilter) and melting temperature (MeltingTemperatureNNFilter) within a user-specified range, CG clamp at 3’ terminal end of the sequence (GCClampFilter), no homopolymeric runs of any nucleotide longer than a user-specified threshold (HomopolymericRunsFilter), no secondary structures below a user-defined free energy threshold (SecondaryStructureFilter). Furthermore, the forward primer sequence is checked for off-target binding (BlastNFilter) against the transcriptome, the encoding probes and T7 primer.

All default parameters can be found in the [`merfish_probe_designer.yaml`](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/blob/main/data/configs/merfish_probe_designer.yaml) config file provided along the repository.
