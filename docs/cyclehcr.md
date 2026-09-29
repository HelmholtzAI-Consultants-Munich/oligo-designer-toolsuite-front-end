---
title: Cycle HCR
layout: default
nav_order: 7
parent: Pipelines
---

# Cycle HCR

CycleHCR (cyclic Hybridization Chain Reaction) is a multiplexed imaging method that combines DNA barcoding with split-initiator HCR amplification. It detects many RNA targets in the same sample over several imaging cycles.

Stable primary probes bind to the target RNA in pairs and stay bound during all imaging cycles. Each primary probe contains a gene-specific target-binding sequence, a linker and a readout barcode. In each cycle, short readout probes bind to the barcodes of the primary probes. Each readout probe carries one half of an HCR initiator, so when the left and right readout probes bind at the same target site, they start HCR amplification with fluorescent hairpins. After imaging, the readout probes and hairpins are stripped away and the next cycle starts. The pipeline also designs the DNA template probes, which add PCR primer binding sites to the primary probes and are ordered as a pooled oligo library.

## Pipeline Description

The pipeline has six major steps:

- Target probe design,

- Readout probe assignment,

- Hybridization probe assembly,

- Primer handling,

- DNA template assembly, and

- Output generation.

In the first step, the left and right target-binding sequences are designed for each gene from the target genome you provide. The two halves are placed next to each other on the transcript and filtered by sequence properties and by binding specificity against the reference genome.

In the second step, a codebook assigns a barcode pattern to each gene. Rows are genes and columns are readout bits; a `1` means the gene carries the matching left and right readout barcode pair. You can load the codebook from a file or let the pipeline generate it. The readout probe table, which lists the readout probe sequences per channel, must always be loaded from a file (see [Codebooks and Probe Tables](pipelines.md#codebooks-and-probe-tables)).

In the third step, each target-binding sequence is combined with the linker and its assigned readout barcode to build the left and right primary probes.

In the fourth step, the forward and reverse primer sequences are loaded and validated. By default, the forward primer is the T7 promoter sequence.

In the fifth step, the DNA template probes are built from the primers, the target-binding sequences, the linker and the readout barcodes. These templates are the synthesis-ready sequences for the primary probe library.

In the last step, the designed probes, the codebook, the readout assignments and related probe information are written to files that you can inspect and use to order the probes.

All default parameters can be found in the [`cycle_hcr_probe_designer.yaml`](https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/blob/main/data/configs/cycle_hcr_probe_designer.yaml) config file provided along the repository.
