---
title: HCR
layout: default
nav_order: 6
parent: Pipelines
---

# HCR

HCR (Hybridization Chain Reaction) is an RNA-FISH method that amplifies the fluorescent signal at each RNA target without enzymes. It detects RNA in fixed cells, tissues, embryos and whole-mount samples.

HCR uses pairs of split-initiator probes. The left and right probe of a pair bind next to each other on the transcript, with a small gap between them. Each probe contains a target-binding sequence, a short linker and one half of an HCR initiator. Only when both probes bind do the two halves form a full initiator, which opens two fluorescent DNA hairpins (H1 and H2) that grow into a fluorescent polymer at the target. A single probe that binds off-target cannot start amplification on its own, which keeps background signal low. Each gene is assigned to one amplifier (e.g. B1, B2, B3), so each gene is detected in one fluorescence channel.

## Pipeline Description

The pipeline has four major steps:

- Target probe design,

- Initiator assignment,

- Hybridization probe assembly, and

- Output generation.

In the first step, the left and right target-binding sequences are designed for each gene from the target genome you provide. Candidate probes are filtered by sequence properties, such as GC content, melting temperature, homopolymeric runs and secondary structure, and by binding specificity against the reference genome. The remaining probes are selected into probe sets for each gene. The melting temperature is calculated separately for the left and right halves.

In the second step, a codebook assigns each gene to one HCR amplifier. The codebook is one-hot: each row is a gene, each column is an amplifier bit, and each gene has exactly one active bit. The initiator table links each bit to the left and right half-initiator sequences of its amplifier. Both tables are checked against each other and against the target genes, so missing targets or initiator sequences are caught before the probes are assembled. The current ODT version cannot generate the codebook or the initiator table yet, so choose **Load** for both and upload your files (see [Codebooks and Probe Tables](pipelines.md#codebooks-and-probe-tables)).

In the third step, each target-binding sequence is combined with the linker and the half-initiator of its assigned amplifier. This builds the final left and right HCR probe for each target site.

In the last step, the final probe sequences, their properties, the codebook and the initiator table are written to files that you can inspect and use to order the probes.

All default parameters can be found in the [`hcr_probe_designer.yaml`](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/blob/main/data/configs/hcr_probe_designer.yaml) config file provided along the repository.
