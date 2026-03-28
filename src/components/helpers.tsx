import type { FastaForm, FileState, RJSFFormData } from "./types";
import { createRunId } from "../modules/helpers";
import { extractSubmissionError } from "./errorHandler";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { showToast } from "../modules/toastUtil";
import { Link } from "react-router";
import { ArrowRight } from "react-bootstrap-icons";

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

export const getRequiredFiles = (pipeline: string): (keyof FileState)[] => {
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
    files: FileState,
    formData: RJSFFormData,
    pipeline: string,
    updateRuns: () => void
) => {
    // TODO: reintroduce some loading state after submission
    if (!allFilesUploaded(files, getRequiredFiles(pipeline))) {
        showToast({
            title: "Submission Failed",
            content: "Please upload all required files before submitting.",
            type: "danger",
        });
        return;
    }
    await uploadFiles(files, formData);

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
                    <Link to={`/runs/${newId}`}>View the run here <ArrowRight /></Link>
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
                    <Link className="mt-2" to={`/runs/${newId}`}>View the run here <ArrowRight /></Link>
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
