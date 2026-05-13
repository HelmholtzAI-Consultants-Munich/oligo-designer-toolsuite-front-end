import { ArrowRight } from "react-bootstrap-icons";
import { BACKEND_URL } from "../../config";
import { createRunId } from "../../contexts/authHelpers";
import { showToast } from "../../utils/toastUtil";
import { extractSubmissionError } from "../errorHandler";
import type { RJSFFormData } from "../componentTypes";
import {
    type CommentEntry,
    type EnsFastaFormDataGeneric,
    type FastaForm,
    type FastaFormState,
    type FileState,
    type NcbiFastaFormDataGeneric,
    type NestedObject,
    type UploadFastaFormData,
} from "./types";
import axios from "axios";
import { Link } from "react-router";

export const replaceUnderscore = (s: string) => s.replaceAll("_", " ");

export const allFieldsFilled = (
    files: FileState,
    required_files: (keyof FileState)[]
) => {
    let uploaded = true;
    for (const file of required_files) {
        if (files[file].length == 0) {
            uploaded = false;
        }
    }
    return uploaded;
};

export const uploadFiles = async (files: FileState, formData: RJSFFormData) => {
    for (const key of Object.keys(files) as (keyof FileState)[]) {
        if (files[key]) {
            for (const file of files[key]) {
                const formDataU = new FormData();
                formDataU.append("file", file);
                try {
                    const response = await axios.post(
                        BACKEND_URL + "/api/upload",
                        formDataU,
                        {
                            headers: {
                                "Content-Type": "multipart/form-data",
                            },
                        }
                    );
                    // update formData to contain server-side file path
                    formData[key].push(response.data.filePath);
                } catch (error) {
                    console.error(`Error uploading ${key}:`, error);
                    throw new Error(
                        `Error uploading ${file.name} for field ${key}`
                    );
                }
            }
        }
    }
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

export const addComments = (
    fastaFormData: NestedObject,
    commentedFastaFormData: NestedObject
) => {
    const mergeComments = (data: unknown, template: unknown): unknown => {
        if (Array.isArray(data)) {
            return data.map((entry, idx) =>
                mergeComments(
                    entry,
                    Array.isArray(template) ? template[idx] : template
                )
            );
        }

        if (data && typeof data === "object") {
            const merged: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(
                data as Record<string, unknown>
            )) {
                merged[key] = mergeComments(
                    value,
                    (template as Record<string, unknown> | undefined)?.[key]
                );
            }
            return merged;
        }

        if (
            template &&
            typeof template === "object" &&
            "value" in template &&
            "comment" in template
        ) {
            return {
                value: data,
                comment: (template as CommentEntry).comment,
            };
        }

        return data;
    };

    return mergeComments(fastaFormData, commentedFastaFormData) as NestedObject;
};

const prepareForUpload = (fastaForm: FastaForm) => {
    let uploadReadyFastaForm;
    switch (fastaForm.selectedSource) {
        case "ncbi":
            uploadReadyFastaForm = removeComments(
                fastaForm.formDataNcbi as unknown as NestedObject
            ) as unknown as UploadFastaFormData<
                NcbiFastaFormDataGeneric<false>
            >;
            uploadReadyFastaForm.source = "NCBI";
            break;
        case "ensembl":
            uploadReadyFastaForm = removeComments(
                fastaForm.formDataEns as unknown as NestedObject
            ) as unknown as UploadFastaFormData<EnsFastaFormDataGeneric<false>>;
            uploadReadyFastaForm.source = "Ensembl";
            break;
        default:
            return null;
    }
    return uploadReadyFastaForm;
};

export const handleSubmitGenomicAll = async (
    fastaForms: FastaFormState,
    formData: RJSFFormData // Accept forms as argument
) => {
    for (const key of Object.keys(fastaForms) as (keyof FileState)[]) {
        if (fastaForms[key]) {
            for (const form of fastaForms[key]) {
                const payload = prepareForUpload(form);

                if (!payload) {
                    console.error(
                        "Error while processing Genomic Region Generator Form"
                    );
                    continue;
                }

                try {
                    const response = await axios.post(
                        BACKEND_URL + `/api/genomic/cascaded/custom`,
                        payload,
                        {
                            withCredentials: true,
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                    formData[key] = response.data.output;
                } catch (error) {
                    console.error("Error submitting genomic form:", error);
                    throw new Error(
                        `Error uploading Genomic Region Generator for field ${key}`
                    );
                }
            }
        }
    }
};

export const getRequiredFields = (
    pipeline: string
): (keyof FileState & keyof FastaFormState)[] => {
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

export const validateInput = (
    pipeline: string,
    files: FileState,
    fastaForms: FastaFormState
) => {
    for (const field of getRequiredFields(pipeline)) {
        if (files[field].length != 0 && fastaForms[field].length != 0) {
            return [
                false,
                "You should either provide a file or use the genomic region generator, not both",
            ];
        } else if (
            files[field].length === 0 &&
            fastaForms[field].length === 0
        ) {
            return false;
        }
    }
    return true;
};

export const unwrapQueuePosition = (queue_position: [number, number]) => {
    const [highPriorityAhead, defaultPriorityAhead] = queue_position;
    const runsAhead = highPriorityAhead + defaultPriorityAhead;
    return {
        runsAhead,
        highPriorityAhead,
        defaultPriorityAhead,
        ownPosition: runsAhead + 1,
    };
};

export const handleSubmit = async (
    files: FileState,
    fastaForms: FastaFormState,
    formData: RJSFFormData,
    pipeline: string,
    updateRuns: () => void
) => {
    const isInputValid = validateInput(pipeline, files, fastaForms);

    if (!isInputValid) {
        showToast({
            title: "Submission Failed",
            content: "Please upload all required files before submitting.",
            type: "danger",
        });
        return;
    }

    try {
        await uploadFiles(files, formData);
        await handleSubmitGenomicAll(fastaForms, formData);
    } catch {
        showToast({
            title: "Submitting Failed",
            content: "There was an error while processing your input",
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
        const response = await axios.post(
            BACKEND_URL + `/api/${pipeline}`,
            { formdata: formData, runid: newId },
            {
                withCredentials: true,
                headers: { "Content-Type": "application/json" },
            }
        );

        const { queue_position } = response.data;
        const { ownPosition } = unwrapQueuePosition(queue_position);

        showToast({
            title: "Pipeline Enqueued",
            content: (
                <>
                    <p>The pipeline run was successfully added to the queue.</p>
                    <p>Queue Position: {ownPosition}</p>
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
        // remove uploaded filepaths added in uploadFiles
        for (const key in files) {
            formData[key] = [];
        }
        updateRuns();
    }
};
