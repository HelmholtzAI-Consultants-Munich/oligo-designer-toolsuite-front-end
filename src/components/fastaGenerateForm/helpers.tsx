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

const removeComments = (fastaFormData: NestedObject) => {
    const uploadReadyFastaForm = {} as NestedObject;
    for (const property of Object.keys(fastaFormData)) {
        const key = property as keyof NestedObject;
        if (typeof fastaFormData[key] === "object") {
            if (Object.keys(fastaFormData[key]).includes("value")) {
                uploadReadyFastaForm[key] = (
                    fastaFormData[key] as unknown as CommentEntry
                )["value" as keyof CommentEntry];
            } else {
                uploadReadyFastaForm[key] = removeComments(fastaFormData[key]);
            }
        }
    }
    return uploadReadyFastaForm;
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
        await axios.post(
            BACKEND_URL + `/api/${pipeline}`,
            { formdata: formData, runid: newId },
            {
                withCredentials: true,
                headers: { "Content-Type": "application/json" },
            }
        );

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
        // remove uploaded filepaths added in uploadFiles
        for (const key in files) {
            formData[key] = [];
        }
        updateRuns();
    }
};
