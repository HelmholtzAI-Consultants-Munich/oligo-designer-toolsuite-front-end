import { ArrowRight } from "react-bootstrap-icons";
import { BACKEND_URL } from "../../config";
import { createRunId } from "../../contexts/authHelpers";
import { showToast } from "../../utils/toastUtil";
import { extractSubmissionError } from "../errorHandler";
import type { NestedObject, RJSFFormData } from "../componentTypes";
import { type FastaFormUncommented, type FastaFormUpload } from "./types";
import axios from "axios";
import { Link } from "react-router";
import {
    PIPELINE_CONFIG,
    type PipelineConfig,
} from "../../pipelineConfig/config";

export const replaceUnderscore = (s: string) => s.replaceAll("_", " ");

export const firstLetterUppercase = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1);

export const regionDisplayNames = {
    gene: "Gene",
    intergenic: "Intergenic",
    exon: "Exon",
    utr: "UTR",
    cds: "CDS",
    intron: "Intron",
    exon_exon_junction: "Exon-exon-junction",
};

const findReference = (
    ref: string,
    baseSchema: NestedObject
): Record<string, unknown> | null => {
    if (!ref.startsWith("#/")) return null;

    const path = ref.split("/").slice(-1);
    for (const part of path) {
        if (part in baseSchema) {
            baseSchema = baseSchema[part] as NestedObject;
        } else {
            return null;
        }
    }
    return baseSchema as Record<string, unknown>;
};

export const getKeyObjectFromSchema = (
    fastaFormSchema: NestedObject,
    baseSchema: NestedObject,
    extractKey: string,
    overwriteObject: boolean = false
) => {
    const references = new Set<string>();

    const extractValue = (value: unknown): unknown => {
        if (Array.isArray(value)) {
            return value.map((entry) => extractValue(entry));
        }

        if (value && typeof value === "object") {
            let record = value as Record<string, unknown>;

            if ("$ref" in record) {
                if (references.has(record.$ref as string)) {
                    return null;
                }
                references.add(record.$ref as string);
                const result = findReference(record.$ref as string, baseSchema);
                if (!result) {
                    return null;
                }
                record = result;
                references.delete(record.$ref as string);
            }
            if ("properties" in record) {
                record = record.properties as Record<string, unknown>;
            }

            if (extractKey in record) {
                if (overwriteObject) return record[extractKey];
                else return { [extractKey]: record[extractKey] };
            }

            const cleaned: Record<string, unknown> = {};
            for (const [key, nestedValue] of Object.entries(record)) {
                cleaned[key] = extractValue(nestedValue);
                if (
                    cleaned[key] === null ||
                    (typeof cleaned[key] === "object" &&
                        "type" in cleaned[key] &&
                        cleaned[key].type === null)
                ) {
                    cleaned[key] = {};
                }
            }
            if (Object.keys(cleaned).length > 0) return cleaned;
        }
        return null;
    };

    return extractValue(fastaFormSchema) as NestedObject;
};

const prepareForUpload = (fastaForm: FastaFormUncommented) => {
    let uploadReadyFastaForm: FastaFormUpload;
    switch (fastaForm.selectedSource) {
        case "ncbi":
            uploadReadyFastaForm = fastaForm.formDataNcbi;
            uploadReadyFastaForm.source = "NCBI";
            break;
        case "ensembl":
            uploadReadyFastaForm = fastaForm.formDataEns;
            uploadReadyFastaForm.source = "Ensembl";
            break;
        default:
            return null;
    }
    return uploadReadyFastaForm;
};

export const validateInput = (pipeline: string, formData: RJSFFormData) => {
    for (const field of PIPELINE_CONFIG[pipeline as keyof PipelineConfig]
        .genomicInputFields!) {
        const files = formData[field].files;
        const fastaForms = formData[field].fasta_form;
        if (files.length === 0 && fastaForms.length === 0) {
            return false;
        }
    }
    return true;
};

export const handleSubmit = async (
    formData: RJSFFormData,
    pipeline: string,
    updateRuns: () => void
) => {
    // copy to avoid modifying formData
    const uploadFormData = structuredClone(formData);
    const isInputValid = validateInput(pipeline, uploadFormData);

    if (!isInputValid) {
        showToast({
            title: "Submission Failed",
            content: "Please upload all required files before submitting.",
            type: "danger",
        });
        return;
    }

    const newId = await createRunId();
    if (!newId) {
        showToast({
            title: "Pipeline Failed",
            content: "Our servers have failed to create a new run.",
            type: "danger",
        });
        return;
    }

    try {
        let upload = {};
        for (const field of PIPELINE_CONFIG[pipeline as keyof PipelineConfig]
            .genomicInputFields!) {
            if (uploadFormData[field].fasta_form.length > 0) {
                uploadFormData[field].fasta_form = uploadFormData[
                    field
                ].fasta_form.map((fastaForm: FastaFormUncommented) =>
                    prepareForUpload(fastaForm)
                );
            } else if (formData[field].files.length > 0) {
                upload = {
                    ...upload,
                    ...formData[field].files.reduce(
                        (acc: Record<string, File>, cur: File) => ({
                            ...acc,
                            ...{ [cur.name]: cur },
                        }),
                        {}
                    ),
                };
                uploadFormData[field].files = formData[field].files.map(
                    (file: File) => file.name
                );
            }
        }

        upload = {
            ...upload,
            payload: JSON.stringify({
                formdata: uploadFormData,
                runid: newId,
            }),
        };

        await axios.post(BACKEND_URL + `/api/${pipeline}`, upload, {
            withCredentials: true,
            headers: { "Content-Type": "multipart/form-data" },
        });

        showToast({
            title: "Pipeline Enqueued",
            content: (
                <>
                    <p>The pipeline run was successfully added to the queue.</p>
                    <Link to={`/runs/${newId}`}>
                        View the run here <ArrowRight />
                    </Link>
                </>
            ),
            type: "success",
        });
    } catch (error) {
        const errorMessage = extractSubmissionError(error);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            showToast({
                title: "Pipeline Not Started",
                content: (
                    <>
                        <p>{errorMessage}</p>
                    </>
                ),
                type: "danger",
            });
        } else {
            showToast({
                title: "Pipeline Failed",
                content: (
                    <>
                        <p>{errorMessage}</p>
                        <Link className="mt-2" to={`/runs/${newId}`}>
                            View the run here <ArrowRight />
                        </Link>
                    </>
                ),
                type: "danger",
            });
        }
    } finally {
        updateRuns();
    }
};
