import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import type { RJSFFormData } from "../components/componentTypes";
import scrinshotImage from "../images/scrinshot.jpg";
import merfishImage from "../images/merfish.jpg";
import seqfishImage from "../images/seqfish.jpg";
import oligoseqImage from "../images/oligoseq.jpg";

import fastaFormSchema from "@schemas/fastaForm.schema.json";
import merfishSchemaRaw from "@schemas/merfish.schema.json";
import scrinshotSchemaRaw from "@schemas/scrinshot.schema.json";
import oligoseqSchemaRaw from "@schemas/oligoseq.schema.json";
import seqfishSchemaRaw from "@schemas/seqfish.schema.json";
import {
    merfishUiSchema,
    oligoseqUiSchema,
    scrinshotUiSchema,
    seqfishUiSchema,
} from "./uiSchemas";

interface BasePipeline {
    schema: RJSFSchema;
    displayName: string;
    uiSchema: UiSchema;
    description: string;
    img: string;
    detailedLink: string;
    link?: string;
    genomicInputFields?: (keyof RJSFFormData)[];
    disabled: boolean;
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

type pipelineModifier = (pipeline: Pipeline) => Pipeline;

export type PipelineConfig = {
    [K in Pipeline["name"]]: Pipeline;
};

const PIPELINE_CONFIG_RAW: PipelineConfig = {
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
    },
    oligoseq: {
        name: "oligoseq",
        schema: oligoseqSchemaRaw as RJSFSchema,
        uiSchema: oligoseqUiSchema,
        displayName: "OligoSeq",
        description:
            "High-throughput sequencing tailored for spatial transcriptomics.",
        detailedLink:
            "https://oligo-designer-toolsuite.readthedocs.io/en/latest/_pipelines/oligoseq_probe_designer.html",
        img: oligoseqImage,
        disabled: false,
    },
};

// RJSF can only work with local references (see https://rjsf-team.github.io/react-jsonschema-form/docs/json-schema/definitions)
// So to reuse the fastaForm schema without copy-pasting this function adds the relevant part to every pipeline schema.
const addFastaFormSchema = (pipeline: Pipeline) => {
    const fastaFormSchemaTyped = fastaFormSchema as RJSFSchema;
    pipeline.schema.definitions = fastaFormSchemaTyped.definitions;
    return pipeline;
};

const addGenomicInputFields = (pipeline: Pipeline) => {
    const getGenomicInputFields = (
        pipelineName: Pipeline["name"]
    ): (keyof RJSFFormData)[] => {
        if (pipelineName === "scrinshot") {
            return [
                "files_fasta_target_probe_database",
                "files_fasta_reference_database_target_probe",
            ];
        } else if (pipelineName === "oligoseq") {
            return [
                "files_fasta_target_probe_database",
                "files_fasta_reference_database_target_probe",
                "files_vcf_reference_database_target_probe",
            ];
        } else {
            return [
                "files_fasta_target_probe_database",
                "files_fasta_reference_database_target_probe",
                "files_fasta_reference_database_readout_probe",
                "files_fasta_reference_database_primer",
            ];
        }
    };
    pipeline.genomicInputFields = getGenomicInputFields(pipeline.name);
    return pipeline;
};

const addGenomicInputFieldToUi = (pipeline: Pipeline) => {
    const genomicInputFieldUi = pipeline.genomicInputFields!.reduce(
        (acc, genomicInputField) => ({
            ...acc,
            ...{ [genomicInputField]: { "ui:field": "fileSelection" } },
        }),
        {}
    );
    pipeline.uiSchema = { ...pipeline.uiSchema, ...genomicInputFieldUi };
    return pipeline;
};

const addLink = (pipeline: Pipeline): Pipeline => ({
    ...pipeline,
    link: `/pipelines/${pipeline.name}`,
});

const pipelineConfigModifiers: pipelineModifier[] = [
    addFastaFormSchema,
    addGenomicInputFields,
    addGenomicInputFieldToUi,
    addLink,
];

const applyPipelineModifiers = (
    pipelineConfig: PipelineConfig
): PipelineConfig =>
    Object.fromEntries(
        Object.entries(pipelineConfig).map(([pipelineName, pipeline]) => [
            pipelineName,
            pipelineConfigModifiers.reduce(
                (modifiedPipeline, pipelineModifier) =>
                    pipelineModifier(modifiedPipeline),
                pipeline
            ),
        ])
    ) as PipelineConfig;

// TODO: Probably there is a way to ensure all necessary properties are set here during the pipelineConfigModifiers
export const PIPELINE_CONFIG = applyPipelineModifiers(PIPELINE_CONFIG_RAW);
