import type { FastaForm, FileState, FormData, Status } from "./types";
import { copyToClipboard, createRunId } from "../modules/helpers";
import { extractSubmissionError } from "./errorHandler";
import axios from "axios";

export const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    setFormData: React.Dispatch<React.SetStateAction<FormData>>
) => {
    const { id, value } = e.target;
    const keys = id.split(".");

    if (keys.length === 2) {
        const [parent, child] = keys;
        setFormData((prev: any) => ({
            ...prev,
            [parent]: {
                ...(prev as any)[parent],
                [child]: {
                    ...(prev as any)[parent]?.[child],
                    value,
                },
            },
        }));
    } else {
        setFormData((prev: any) => ({
            ...prev,
            [id]: {
                ...(prev as any)[id],
                value,
            },
        }));
    }
};



export const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFiles: React.Dispatch<React.SetStateAction<FileState>>
) => {
    const { name, files: selectedFiles } = e.target;
    if (!selectedFiles) return;

    setFiles((prevFiles) => ({
        ...prevFiles,

        [name]:
            Array.from(selectedFiles), // Multiple files (always an array)
    }));
};

export const allFilesUploaded = (
    files: any,
    required_files: string[]
) => {
    let uploaded = true;
    for (const file of required_files) {
        if (files[file].length == 0) { uploaded = false; }
    }
    return (uploaded);
};


export const uploadFiles = async (files: any, formData: any) => {
    const filePaths: { [key: string]: string } = {};
    for (const key in files) {
        // @ts-ignore
        if (files[key]) {
            const formDataU = new FormData();
            // @ts-ignore
            if (Array.isArray(files[key])) {
                const paths = [];
                // @ts-ignore
                for (const file of files[key]) {
                    const formDataU = new FormData();
                    formDataU.append("file", file);
                    try {
                        const response = await axios.post(
                            "http://localhost:9999/api/upload",
                            formDataU,
                            {
                                headers: {
                                    "Content-Type": "multipart/form-data",
                                },
                            }
                        );
                        paths.push(response.data.filePath);
                    } catch (error) {
                        console.error(`Error uploading ${key}:`, error);
                    }
                }
                filePaths[key] = paths.join("\n");
            } else {
                if (formData.file_regions.value.length === 0) {
                    // @ts-ignore
                    formDataU.append("file", files[key]);
                    try {
                        const response = await axios.post(
                            "http://localhost:9999/api/upload",
                            formDataU,
                            {
                                headers: {
                                    "Content-Type": "multipart/form-data",
                                },
                            }
                        );
                        filePaths[key] = response.data.filePath;
                    } catch (error) {
                        console.error(`Error uploading ${key}:`, error);
                    }
                }
            }
        }
    }
    return filePaths;
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
                    `http://localhost:9999/api/genomic/cascaded/${endpoint}`,
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

async function processFastaGroup({
    forms,
    uploadedPaths,
    key,
    formData,
    setModal,
    setRunStatus,
}: {
    forms: FastaForm[];
    uploadedPaths: Record<string, string>;
    key: string;
    formData: any;
    setModal: any;
    setRunStatus: any;
}) {
    let generated = "";
    if (forms && forms.length > 0) {
        generated = await handleSubmitGenomicAll(forms);
        if (generated === "error") {
            setModal({
                show: true,
                title: "Pipeline Failed",
                body: "An error occurred while submitting FASTA data.",
            });
            setRunStatus("idle");
            return null;
        }
    }
    const uploaded = uploadedPaths[key] ?? "";
    const merged = [generated, uploaded].filter(Boolean).join("\n");

    if (merged) {
        formData[key]["value"] = merged;
    }

    return merged;
}

export const getRequiredFiles = (pipeline: string) => {
    if (pipeline === "scrinshot" || pipeline === "oligoseq") {
        return ([
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
        ])
    }
    else {
        return ([
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
            "files_fasta_reference_database_readout_probe",
            "files_fasta_reference_database_primer",
        ])
    }
    ;
}

export const handleSubmit = async (
    runStatus: Status,
    setRunStatus: React.Dispatch<React.SetStateAction<typeof runStatus>>,
    setRunId: React.Dispatch<React.SetStateAction<string | null>>,

    setModal: React.Dispatch<
        React.SetStateAction<{
            show: boolean;
            title: string;
            body: string;
        }>
    >,
    files: FileState,
    formData: any,
    setIdCopySuccess: React.Dispatch<React.SetStateAction<boolean>>,
    pipeline: string
) => {
    if (runStatus !== "idle") return;
    setRunStatus("submitting");
    setRunId(null);
    const uploadedPaths = await uploadFiles(files, formData);

    if (
        !allFilesUploaded(
            files,
            getRequiredFiles(pipeline)
        )
    ) {
        setModal({
            show: true,
            title: "Pipeline Failed",
            body: `Please upload all required files before submitting.`,
        });
        setRunStatus("idle");
        return;
    }

    const newId = await createRunId();
    if (!newId) {
        setModal({
            show: true,
            title: "Pipeline Failed",
            body: `The pipeline has failed to create a new run.`,
        });
        setRunStatus("idle");
        return;
    }

    setRunId(newId);
    setIdCopySuccess(await copyToClipboard(newId));

    try {
        setRunStatus("running");

        const response = await axios.post(
            `http://localhost:9999/api/${pipeline}`,
            { formdata: formData, runid: newId },
            {
                withCredentials: true,
                headers: { "Content-Type": "application/json" },
            }
        );

        setModal({
            show: true,
            title: "Pipeline Finished",
            body: `The pipeline has successfully finished processing. Your run ID is: ${newId}`,
        });
    } catch (error) {
        const errorMessage = extractSubmissionError(error);
        setModal({
            show: true,
            title: "Pipeline Failed",
            body: errorMessage + (newId ? ` Your run ID is: ${newId}.` : ""),
        });
    } finally {
        setRunStatus("idle");
    }
};
