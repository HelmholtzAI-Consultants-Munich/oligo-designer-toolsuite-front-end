import type { RJSFFormData } from "../components/componentTypes";
import cycleHcrImage from "../images/rna_5_purple_gold.webp";
import hcrImage from "../images/rna_6_green_blue.webp";
import scrinshotImage from "../images/rna_1_pink_purple.webp";
import merfishImage from "../images/rna_2_cyan_yellow.webp";
import seqfishImage from "../images/rna_3_orange_blue.webp";
import oligoseqImage from "../images/rna_4_blue_orange.webp";

interface BasePipeline {
    displayName: string;
    description: string;
    detailedLink: string;
    link: string;
    img: string;
    fileUploadFields?: (keyof RJSFFormData)[][];
    disabled: boolean;
    fileDownloads?: {
        excelFile: string;
        probes: string;
        probesOrder: string;
        probesTable: string;
    };
}

type ScrinshotPipeline = BasePipeline & {
    name: "scrinshot";
};

type OligoseqPipeline = BasePipeline & {
    name: "oligoseq";
};

type SeqfishPipeline = BasePipeline & {
    name: "seqfish";
};

type MerfishPipeline = BasePipeline & {
    name: "merfish";
};

type HcrPipeline = BasePipeline & {
    name: "hcr";
};

type CycleHcrPipeline = BasePipeline & {
    name: "cyclehcr";
};

export type Pipeline =
    | ScrinshotPipeline
    | OligoseqPipeline
    | MerfishPipeline
    | SeqfishPipeline
    | HcrPipeline
    | CycleHcrPipeline;

export type PipelineConfig = {
    [K in Pipeline["name"]]: Pipeline;
};

export const PIPELINE_CONFIG: PipelineConfig = {
    scrinshot: {
        name: "scrinshot",
        displayName: "SCRINSHOT",
        img: scrinshotImage,
        description:
            "Spatial gene expression analysis using SCRINSHOT technology.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/scrinshot_probe_designer.html",
        disabled: false,
        link: "/pipelines/scrinshot",
        fileDownloads: {
            excelFile: "padlock_probes.xlsx",
            probes: "padlock_probes.yml",
            probesTable: "padlock_probes.tsv",
            probesOrder: "padlock_probes_order.yml",
        },
    },
    merfish: {
        name: "merfish",
        displayName: "MERFISH",
        img: merfishImage,
        description:
            "Highly multiplexed imaging for spatially resolved transcriptomics.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/merfish_probe_designer.html",
        disabled: false,
        link: "/pipelines/merfish",
        fileDownloads: {
            excelFile: "merfish_probes.xlsx",
            probes: "merfish_probes.yml",
            probesTable: "merfish_probes.tsv",
            probesOrder: "merfish_probes_order.yml",
        },
        fileUploadFields: [
            ["readout_probes", "codebook", "file"],
            ["readout_probes", "readout_probe_table", "file"],
        ],
    },
    seqfish: {
        name: "seqfish",
        displayName: "seqFISH+",
        img: seqfishImage,
        description:
            "Sequential imaging for probing complex spatial transcriptomes.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/seqfishplus_probe_designer.html",
        disabled: false,
        link: "/pipelines/seqfish",
        fileDownloads: {
            excelFile: "seqfish_plus_probes.xlsx",
            probes: "seqfish_plus_probes.yml",
            probesTable: "seqfish_plus_probes.tsv",
            probesOrder: "seqfish_plus_probes_order.yml",
        },
        fileUploadFields: [
            ["readout_probes", "codebook", "file"],
            ["readout_probes", "readout_probe_table", "file"],
        ],
    },
    hcr: {
        name: "hcr",
        displayName: "HCR",
        img: hcrImage,
        description:
            "Hybridization chain reaction probes for signal-amplified imaging.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/hcr_probe_designer.html",
        disabled: false,
        link: "/pipelines/hcr",
        fileDownloads: {
            excelFile: "hcr_probes.xlsx",
            probes: "hcr_probes.yml",
            probesTable: "hcr_probes.tsv",
            probesOrder: "hcr_probes_order.yml",
        },
        fileUploadFields: [
            ["initiator_probes", "codebook", "file"],
            ["initiator_probes", "initiator_table", "file"],
        ],
    },
    cyclehcr: {
        name: "cyclehcr",
        displayName: "Cycle HCR",
        img: cycleHcrImage,
        description:
            "Multiplexed hybridization chain reaction across sequential imaging cycles.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/cycle_hcr_probe_designer.html",
        disabled: false,
        link: "/pipelines/cyclehcr",
        fileDownloads: {
            excelFile: "cyclehcr_probes.xlsx",
            probes: "cyclehcr_probes.yml",
            probesTable: "cyclehcr_probes.tsv",
            probesOrder: "cyclehcr_probes_order.yml",
        },
        fileUploadFields: [
            ["readout_probes", "codebook", "file"],
            ["readout_probes", "readout_probe_table", "file"],
        ],
    },
    oligoseq: {
        name: "oligoseq",
        displayName: "OligoSeq",
        img: oligoseqImage,
        description:
            "High-throughput sequencing tailored for spatial transcriptomics.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/oligoseq_probe_designer.html",
        disabled: false,
        link: "/pipelines/oligoseq",
        fileUploadFields: [
            [
                "target_probes",
                "specificity_filters",
                "variant_filter",
                "files_vcf_reference_database",
            ],
        ],
        fileDownloads: {
            excelFile: "oligo_seq_probes.xlsx",
            probes: "oligo_seq_probes.yml",
            probesTable: "oligo_seq_probes.tsv",
            probesOrder: "oligo_seq_probes_order.yml",
        },
    },
};
