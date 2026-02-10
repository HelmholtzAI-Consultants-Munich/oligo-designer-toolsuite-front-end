import type { FastaForm, FileState, RJSFFormData, Status } from "./types";
import { copyToClipboard, createRunId } from "../modules/helpers";
import { extractSubmissionError } from "./errorHandler";
import axios from "axios";
import { BACKEND_URL } from "../config";

export const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFiles: React.Dispatch<React.SetStateAction<FileState>>
) => {
    const { name, files: selectedFiles } = e.target;
    if (!selectedFiles) return;

    setFiles((prevFiles) => ({
        ...prevFiles,

        [name]: Array.from(selectedFiles), // Multiple files (always an array)
    }));
};

export const allFilesUploaded = (
    files: FileState,
    required_files: string[]
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
    for (const key in files) {
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
                }
            }
        }
    }
};

export const handleSubmitGenomicAll = async (
    forms: FastaForm[], // Accept forms as argument
    e?: React.FormEvent
): Promise<string> => {
    e?.preventDefault();
    try {
        let results = "";
        for (let i = 0; i < forms.length; ++i) {
            const form = forms[i];
            let payload;
            let endpoint;
            if (form.selectedSource === "ncbi") {
                payload = form.formDataNcbi;
                endpoint = "custom ";
            } else if (form.selectedSource === "ensembl") {
                payload = form.formDataEns;
                endpoint = "custom";
            } else {
                continue; // skip unknown
            }
            try {
                const response = await axios.post(
                    BACKEND_URL + `/api/genomic/cascaded/${endpoint}`,
                    payload,
                    {
                        withCredentials: true,
                        headers: { "Content-Type": "application/json" },
                    }
                );
                if (results === "") {
                    results = response.data.output;
                } else {
                    results += "\n" + response.data.output;
                }
            } catch (error) {
                console.error("Error submitting genomic form:", error);
                return "error";
            }
        }
        return results;
    } catch (error) {
        console.error("Error in batch FASTA submission:", error);
        return "error";
    }
};

export const getRequiredFiles = (pipeline: string) => {
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
    formData: RJSFFormData,
    pipeline: string,
    setIdCopySuccess?: React.Dispatch<React.SetStateAction<boolean>>
) => {
    if (runStatus !== "idle") return;
    setRunStatus("submitting");
    setRunId(null);

    if (!allFilesUploaded(files, getRequiredFiles(pipeline))) {
        setModal({
            show: true,
            title: "Submission Failed",
            body: `Please upload all required files before submitting.`,
        });
        setRunStatus("idle");
        return;
    }
    await uploadFiles(files, formData);

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
