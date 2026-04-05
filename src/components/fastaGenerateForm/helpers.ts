import { BACKEND_URL } from "../../config";
import { copyToClipboard, createRunId } from "../../modules/helpers";
import { extractSubmissionError } from "../errorHandler";
import type { RJSFFormData, Status } from "../types";
import { type FastaForm, type FastaFormState, type FileState } from "./types";
import axios from "axios";

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

const stripComments = (fastaForm: FastaForm) => {
    for (let property of Object.keys(fastaForm) as unknown as keyof FastaForm) {
        if (typeof fastaForm[property] === "object") {
            if (Object.keys(fastaForm[property]).includes("value")) {
                fastaForm[property] = fastaForm[property]["value"];
            } else {
                fastaForm[property] = stripComments(fastaForm[property]);
            }
        }
    }
    return fastaForm;
};

export const handleSubmitGenomicAll = async (
    fastaForms: FastaFormState,
    formData: RJSFFormData // Accept forms as argument
) => {
    for (const key of Object.keys(fastaForms) as (keyof FileState)[]) {
        if (fastaForms[key]) {
            for (const form of fastaForms[key]) {
                let payload = stripComments(form);
                if (form.selectedSource === "ncbi") {
                    payload = payload.formDataNcbi;
                    payload["source"] = "NCBI";
                } else if (form.selectedSource === "ensembl") {
                    payload = payload.formDataEns;
                    payload["source"] = "Ensembl";
                } else {
                    continue; // skip unknown
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

export function validateInput(
    pipeline: string,
    files: FileState,
    fastaForms: FastaFormState
): [boolean, string] {
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
            return [
                false,
                "You should either provide a file or use the genomic region generator!",
            ];
        }
    }
    return [true, ""];
}

export const handleSubmit = async (
    runStatus: Status,
    setRunStatus: React.Dispatch<React.SetStateAction<Status>>,
    setRunId: React.Dispatch<React.SetStateAction<string | null>>,

    setModal: React.Dispatch<
        React.SetStateAction<{
            show: boolean;
            title: string;
            body: string;
        }>
    >,
    files: FileState,
    fastaForms: FastaFormState,
    formData: RJSFFormData,
    pipeline: string,
    setIdCopySuccess?: React.Dispatch<React.SetStateAction<boolean>>
) => {
    if (runStatus !== "idle") return;
    setRunStatus("submitting");
    setRunId(null);

    const [isInputValid, error] = validateInput(pipeline, files, fastaForms);

    if (!isInputValid) {
        setModal({
            show: true,
            title: "Submission Failed",
            body: error,
        });
        setRunStatus("idle");
        return;
    }

    try {
        await uploadFiles(files, formData);
        await handleSubmitGenomicAll(fastaForms, formData);
    } catch (error) {
        setModal({
            show: true,
            title: "Submission Failed",
            body: `${error}`,
        });
        setRunStatus("idle");
        return;
    }

    const newId = await createRunId();
    if (!newId) {
        setModal({
            show: true,
            title: "Pipeline Failed",
            body: `Our servers have failed to create a new run.`,
        });
        setRunStatus("idle");
        return;
    }

    setRunId(newId);
    const copySuccess = await copyToClipboard(newId);
    setIdCopySuccess?.(copySuccess);

    try {
        setRunStatus("running");

        await axios.post(
            BACKEND_URL + `/api/${pipeline}`,
            { formdata: formData, runid: newId },
            {
                withCredentials: true,
                headers: { "Content-Type": "application/json" },
            }
        );

        setModal({
            show: true,
            title: "Pipeline Enqueued",
            body: `The pipeline run was successfully added to the queue. Your run ID is: ${newId}`,
        });
    } catch (error) {
        const errorMessage = extractSubmissionError(error);
        setModal({
            show: true,
            title: "Pipeline Failed",
            body: errorMessage + (newId ? ` Your run ID is: ${newId}.` : ""),
        });
    } finally {
        // remove uploaded filepaths added in uploadFiles
        for (const key in files) {
            formData[key] = [];
        }
        setRunStatus("idle");
    }
};
