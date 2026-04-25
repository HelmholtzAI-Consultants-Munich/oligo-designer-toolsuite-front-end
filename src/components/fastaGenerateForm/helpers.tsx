import { ArrowRight } from "react-bootstrap-icons";
import { BACKEND_URL } from "../../config";
import { createRunId } from "../../contexts/authHelpers";
import { showToast } from "../../utils/toastUtil";
import { extractSubmissionError } from "../errorHandler";
import type { RJSFFormData } from "../componentTypes";
import {
    type FastaFormUncommented,
    type FastaFormUpload,
    type NestedObject,
} from "./types";
import axios from "axios";
import { Link } from "react-router";

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

export const createDefaultFromSchema = (
    fastaFormSchema: NestedObject,
    baseSchema: NestedObject
) => {
    const references = new Set<string>();

    const stripComments = (value: unknown, key?: string): unknown => {
        if (Array.isArray(value)) {
            return value.map((entry) => stripComments(entry));
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

            if ("default" in record) {
                return record.default;
            }

            const cleaned: Record<string, unknown> = {};
            for (const [key, nestedValue] of Object.entries(record)) {
                cleaned[key] = stripComments(nestedValue, key);
                if (
                    cleaned[key] === null ||
                    (typeof cleaned[key] === "object" &&
                        "type" in cleaned[key] &&
                        cleaned[key].type === null)
                ) {
                    delete cleaned[key];
                }
            }
            if (Object.keys(cleaned).length > 0) return cleaned;
        }
        return null;
    };

    return stripComments(fastaFormSchema) as NestedObject;
};

export const retrieveFlatSchema = (
    fastaFormSchema: NestedObject,
    baseSchema: NestedObject
) => {
    const references = new Set<string>();

    const stripComments = (value: unknown, key?: string): unknown => {
        if (Array.isArray(value)) {
            return value.map((entry) => stripComments(entry));
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

            const cleaned: Record<string, unknown> = {};
            for (const [key, nestedValue] of Object.entries(record)) {
                cleaned[key] = stripComments(nestedValue, key);
                if (
                    cleaned[key] === null ||
                    (typeof cleaned[key] === "object" &&
                        "type" in cleaned[key] &&
                        cleaned[key].type === null)
                ) {
                    delete cleaned[key];
                }
            }
            if (Object.keys(cleaned).length > 0) return cleaned;
        }
        if (key) {
            if (key === "description" || key === "default") return value;
        }
        return null;
    };

    return stripComments(fastaFormSchema) as NestedObject;
};

export const removeComments = (fastaFormData: NestedObject) => {
    const stripComments = (value: unknown): unknown => {
        if (Array.isArray(value)) {
            return value.map((entry) => stripComments(entry));
        }

        if (value && typeof value === "object") {
            const record = value as Record<string, unknown>;
            if ("value" in record) {
                return record.value;
            }

            const cleaned: Record<string, unknown> = {};
            for (const [key, nestedValue] of Object.entries(record)) {
                cleaned[key] = stripComments(nestedValue);
            }
            return cleaned;
        }

        return value;
    };

    return stripComments(fastaFormData) as NestedObject;
};

const prepareForUpload = (fastaForm: FastaFormUncommented) => {
    let uploadReadyFastaForm: FastaFormUpload;
    console.log(fastaForm.selectedSource);
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

export const getGenomicInputFields = (
    pipeline: string
): (keyof RJSFFormData)[] => {
    if (pipeline === "scrinshot" || pipeline === "oligoseq") {
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

export const validateInput = (pipeline: string, formData: RJSFFormData) => {
    console.log("validation", formData);
    for (const field of getGenomicInputFields(pipeline)) {
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
    console.log("submit", formData);
    // copy to not modify formData
    const uploadFormData = structuredClone(formData);
    console.log("stringify", uploadFormData);
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
        for (const field of getGenomicInputFields(pipeline)) {
            console.log(field);
            console.log(uploadFormData[field]);
            if (uploadFormData[field].fasta_form.length > 0) {
                uploadFormData[field].fasta_form = uploadFormData[
                    field
                ].fasta_form.map((fastaForm: FastaFormUncommented) =>
                    prepareForUpload(fastaForm)
                );
                console.log(uploadFormData[field]);
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
                console.log("upload innen", upload);
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

        console.log("upload", upload);

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
    } finally {
        updateRuns();
    }
};
