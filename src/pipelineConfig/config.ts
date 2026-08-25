import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import type { RJSFFormData } from "../components/componentTypes";

import merfishSchemaRaw from "@schemas/merfish.schema.json";
import scrinshotSchemaRaw from "@schemas/scrinshot.schema.json";
import oligoseqSchemaRaw from "@schemas/oligoseq.schema.json";
import seqfishSchemaRaw from "@schemas/seqfish.schema.json";
import hcrSchemaRaw from "@schemas/hcr.schema.json";
import cyclehcrSchemaRaw from "@schemas/cyclehcr.schema.json";
import { uiSchemaFromJsonSchema } from "./uiSchemas";

interface BasePipeline {
    schema: RJSFSchema;
    displayName: string;
    uiSchema: UiSchema;
    description: string;
    detailedLink: string;
    link: string;
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
        schema: scrinshotSchemaRaw as RJSFSchema,
        uiSchema: uiSchemaFromJsonSchema(scrinshotSchemaRaw as RJSFSchema),
        displayName: "Scrinshot",
        description:
            "Spatial gene expression analysis using scrinshot technology.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/scrinshot_probe_designer.html",
        disabled: false,
        link: "/pipelines/scrinshot",
    },
    merfish: {
        name: "merfish",
        schema: merfishSchemaRaw as RJSFSchema,
        uiSchema: uiSchemaFromJsonSchema(merfishSchemaRaw as RJSFSchema),
        displayName: "Merfish",
        description:
            "Highly multiplexed imaging for spatially resolved transcriptomics.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/merfish_probe_designer.html",
        disabled: false,
        link: "/pipelines/merfish",
        fileUploadFields: [
            ["readout_probes", "codebook", "file"],
            ["readout_probes", "readout_probe_table", "file"],
        ],
    },
    seqfish: {
        name: "seqfish",
        schema: seqfishSchemaRaw as RJSFSchema,
        uiSchema: uiSchemaFromJsonSchema(seqfishSchemaRaw as RJSFSchema),
        displayName: "SeqFish+",
        description:
            "Sequential imaging for probing complex spatial transcriptomes.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/seqfishplus_probe_designer.html",
        disabled: false,
        link: "/pipelines/seqfish",
        fileUploadFields: [
            ["readout_probes", "codebook", "file"],
            ["readout_probes", "readout_probe_table", "file"],
        ],
    },
    hcr: {
        name: "hcr",
        schema: hcrSchemaRaw as RJSFSchema,
        uiSchema: uiSchemaFromJsonSchema(hcrSchemaRaw as RJSFSchema),
        displayName: "HCR",
        description:
            "Hybridization chain reaction probes for signal-amplified imaging.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/hcr_probe_designer.html",
        disabled: false,
        link: "/pipelines/hcr",
        fileUploadFields: [
            ["initiator_probes", "codebook", "file"],
            ["initiator_probes", "initiator_table", "file"],
        ],
    },
    cyclehcr: {
        name: "cyclehcr",
        schema: cyclehcrSchemaRaw as RJSFSchema,
        uiSchema: uiSchemaFromJsonSchema(cyclehcrSchemaRaw as RJSFSchema),
        displayName: "Cycle HCR",
        description:
            "Multiplexed hybridization chain reaction across sequential imaging cycles.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/cycle_hcr_probe_designer.html",
        disabled: false,
        link: "/pipelines/cyclehcr",
        fileUploadFields: [
            ["readout_probes", "codebook", "file"],
            ["readout_probes", "readout_probe_table", "file"],
        ],
    },
    oligoseq: {
        name: "oligoseq",
        schema: oligoseqSchemaRaw as RJSFSchema,
        uiSchema: uiSchemaFromJsonSchema(oligoseqSchemaRaw as RJSFSchema),
        displayName: "OligoSeq",
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
