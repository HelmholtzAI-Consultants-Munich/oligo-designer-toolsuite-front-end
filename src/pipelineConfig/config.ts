import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import type { RJSFFormData } from "../components/componentTypes";

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
import { useMemo } from "react";

interface BasePipeline {
    schema: RJSFSchema;
    displayName: string;
    uiSchema: UiSchema;
    genomicInputFields?: (keyof RJSFFormData)[];
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
    },
    merfish: {
        name: "merfish",
        schema: merfishSchemaRaw as RJSFSchema,
        uiSchema: merfishUiSchema,
        displayName: "Merfish",
    },
    seqfish: {
        name: "seqfish",
        schema: seqfishSchemaRaw as RJSFSchema,
        uiSchema: seqfishUiSchema,
        displayName: "SeqFish+",
    },
    oligoseq: {
        name: "oligoseq",
        schema: oligoseqSchemaRaw as RJSFSchema,
        uiSchema: oligoseqUiSchema,
        displayName: "OligoSeq",
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
        if (pipelineName === "scrinshot" || pipelineName === "oligoseq") {
            return [
                "files_fasta_target_probe_database",
                "files_fasta_reference_database_target_probe",
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

const pipelineConfigModifiers: pipelineModifier[] = [
    addFastaFormSchema,
    addGenomicInputFields,
    addGenomicInputFieldToUi,
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
    ) as unknown as PipelineConfig;

// TODO: Probably there is a way to ensure all necessary properties are set here during the pipelineConfigModifiers
const PIPELINE_CONFIG_TEST = applyPipelineModifiers(PIPELINE_CONFIG_RAW);
export const PIPELINE_CONFIG = PIPELINE_CONFIG_TEST;
