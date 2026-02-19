---
title: OligoSeq
layout: default
nav_order: 4
parent: Pipelines
---

# Oligo-Seq

An Oligo-Seq probe is an oligo hybridization probe, which is optimized for probe-based targeted sequencing to measure RNA expression.

## Pipeline Description

The pipeline has four major steps:

- Probe generation (dark blue)
- Probe filtering by sequence property and binding specificity (light blue)
- Probe set selection for each gene (green)
- Final probe sequence generation (yellow)

<div style="float: right; margin-left: 20px; margin-bottom: 20px; max-width: 300px;">
  <img src="assets/images/pipeline_oligoseq.webp" alt="Oligo-Seq Pipeline Structure" style="width: 100%; height: auto;">
</div>

For the probe generation step, the user has to provide a FASTA file with genomic sequences which is used as reference for the generation of probe sequences. The probe sequences are generated using the OligoSequenceGenerator. Therefore, the user has to define the probe length (can be given as a range), and optionally provide a list of gene identifiers (matching the gene identifiers of the annotation file) for which probes should be generated. If no gene list is given, probes are generated for all genes in the reference. The probe sequences are generated in a sliding window fashion from the DNA sequence of the non-coding strand, assuming that the sequence of the coding strand represents the target sequence of the probe. The generated probes are stored in a FASTA file, where the header of each sequence stores the information about its reference region and genomic coordinates. In a next step, this FASTA file is used to create an OligoDatabase, which contains all possible probes for a given set of genes. When the probe sequences are loaded into the database, all probes of one gene having the exact same sequence are merged into one entry, saving the transcript, exon and genomic coordinate information of the respective probes.

In the second step, the number of probes per gene is reduced by applying different sequence property (PropertyFilter) and binding specificity filters (SpecificityFilter). For the MERFISH protocol, the following filters are applied: removal of sequences that contain unidentified nucleotides (HardMaskedSequenceFilter), that contain low-complexity region like repeat regions (SoftMaskedSequenceFilter), that have a GC content (GCContentFilter) or melting temperature (MeltingTemperatureNNFilter) outside a user-specified range, that contain homopolymeric runs of any nucleotide longer than a user-specified threshold (HomopolymericRunsFilter), that contain secondary structures like hairpins below a user-defined free energy threshold (SecondaryStructureFilter). After removing probes with undesired sequence properties from the database, the probe database is checked for probes that potentially cross-hybridize, i.e. probes from different genes that have the exact same or similar sequence. Those probes are removed from the database to ensure uniqueness of probes for each gene. Cross-hybridizing probes are identified with the CrossHybridizationFilter that uses a BlastN alignment search to identify similar sequences and removes those hits with the RemoveByBiggerRegionPolicy that sequentially removes the probes from the genes that have the bigger probe sets. Next, the probes are checked for off-target binding with any other region of a provided background reference. Off-target regions are sequences of the background reference (e.g. transcriptome or genome) which match the probe region with a certain degree of homology but are not located within the gene region of the probe. Those off-target regions are identified with the BlastNFilter or BowtieFilter (users choice) and further refined using the HybridizationProbabilityFilter which calculates the probability of the probe hybridizing to the identified potential off-target sequences. Probes with a hybridization probability greater than the user-defined trheshold are removed from the database. Refining the alignment hits with the HybridizationProbabilityFilter helps to retain more probes in the database.

In the third step of the pipeline, the best sets of non-overlapping probes are identified for each gene. The OligosetGeneratorIndependentSet class is used to generate ranked, non-overlapping probe sets where each probe and probe set is scored according to a protocol dependent scoring function, i.e. by weighted GC content and melting temperature score, of the probes in the set. Following this step all genes with insufficient number of probes (user-defined) are removed from the database and stored in a separate file for user-inspection.

In the last step of the pipeline, the ready-to-order probe sequences are reported for the best non-overlapping sets of each gene.

All default parameters can be found in the [`oligo_seq_probe_designer.yaml`](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/blob/main/data/configs/oligo_seq_probe_designer.yaml) config file provided along the repository.

<div style="clear: both;"></div>
