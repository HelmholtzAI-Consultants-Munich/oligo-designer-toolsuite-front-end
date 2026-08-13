import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import type { RJSFFormData } from "../components/componentTypes";
import scrinshotImage from "../images/rna_1_pink_purple.png";
import merfishImage from "../images/rna_2_cyan_yellow.png";
import seqfishImage from "../images/rna_3_orange_blue.png";
import oligoseqImage from "../images/rna_4_blue_orange.png";

import merfishSchemaRaw from "@schemas/merfish.schema.json";
import scrinshotSchemaRaw from "@schemas/scrinshot.schema.json";
import oligoseqSchemaRaw from "@schemas/oligoseq.schema.json";
import seqfishSchemaRaw from "@schemas/seqfish.schema.json";
import {
    merfishUiSchema,
    scrinshotUiSchema,
    seqfishUiSchema,
    uiSchemaFromJsonSchema,
} from "./uiSchemas";

interface BasePipeline {
    schema: RJSFSchema;
    displayName: string;
    uiSchema: UiSchema;
    description: string;
    img: string;
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

export type Pipeline =
    | ScrinshotPipeline
    | OligoseqPipeline
    | MerfishPipeline
    | SeqfishPipeline;

export type PipelineConfig = {
    [K in Pipeline["name"]]: Pipeline;
};

export const PIPELINE_CONFIG: PipelineConfig = {
    scrinshot: {
        name: "scrinshot",
        schema: scrinshotSchemaRaw as RJSFSchema,
        uiSchema: scrinshotUiSchema,
        displayName: "Scrinshot",
        description:
            "Spatial gene expression analysis using scrinshot technology.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/scrinshot_probe_designer.html",
        img: scrinshotImage,
        disabled: true,
        link: "/pipelines/scrinshot",
    },
    merfish: {
        name: "merfish",
        schema: merfishSchemaRaw as RJSFSchema,
        uiSchema: merfishUiSchema,
        displayName: "Merfish",
        description:
            "Highly multiplexed imaging for spatially resolved transcriptomics.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/merfish_probe_designer.html",
        img: merfishImage,
        disabled: true,
        link: "/pipelines/merfish",
    },
    seqfish: {
        name: "seqfish",
        schema: seqfishSchemaRaw as RJSFSchema,
        uiSchema: seqfishUiSchema,
        displayName: "SeqFish+",
        description:
            "Sequential imaging for probing complex spatial transcriptomes.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/seqfishplus_probe_designer.html",
        img: seqfishImage,
        disabled: true,
        link: "/pipelines/seqfish",
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
        img: oligoseqImage,
        disabled: false,
        link: "/pipelines/oligoseq",
        fileUploadFields: [
            [
                "target_probe",
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
