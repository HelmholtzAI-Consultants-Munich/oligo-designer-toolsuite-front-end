import { FileState, formData } from "./types";
import axios from "axios";
export const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    setFormData: React.Dispatch<React.SetStateAction<formData>>
) => {
    const { name, value } = e.target;
    const keys = name.split(".");

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
            [name]: {
                ...(prev as any)[name],
                value,
            },
        }));
    }
};

export const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFiles: React.Dispatch<React.SetStateAction<FileState>>) => {
    const { name, files: selectedFiles } = e.target;
    if (!selectedFiles) return;

    setFiles((prevFiles) => ({
        ...prevFiles,
        [name]:
            name === "file_regions"
                ? selectedFiles[0] // Single file
                : Array.from(selectedFiles), // Multiple files (always an array)
    }));
};

export const allFilesUploaded = (files: any, formData: formData, fastaForms: any, fastaFormsReference: any, fastaFormsReadout: any, fastaFormsPrimer: any) => {
    return (
        (files.file_regions_file !== null ||
            formData.file_regions.value.length > 0) &&
        (files.files_fasta_target_probe_database.length > 0 ||
            fastaForms.length > 0) &&
        (files.files_fasta_reference_database_target_probe.length > 0 ||
            fastaFormsReference.length > 0) &&
        (files.files_fasta_reference_database_readout_probe.length > 0 ||
            fastaFormsReadout.length > 0) &&
        (files.files_fasta_reference_database_primer.length > 0 ||
            fastaFormsPrimer.length > 0)
    );
};

export const uploadFiles = async (files: any, formData: any) => {
    const filePaths: { [key: string]: string } = {};
    console.log(files, "from the event");
    for (const key in files) {
        // @ts-ignore
        if (files[key]) {
            const formDataU = new FormData();
            // @ts-ignore
            if (Array.isArray(files[key])) {
                let paths = [];
                // @ts-ignore
                for (const file of files[key]) {
                    const formDataU = new FormData();
                    formDataU.append("file", file);
                    try {
                        const response = await axios.post(
                            "http://localhost:5000/api/upload",
                            formDataU,
                            {
                                headers: { "Content-Type": "multipart/form-data" },
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
                            "http://localhost:5000/api/upload",
                            formDataU,
                            {
                                headers: { "Content-Type": "multipart/form-data" },
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

// Handle form submission
// export const handleSubmit = async (e: React.FormEvent) => {
//     if (e) e.preventDefault();
//     if (isSubmitting) return; // prevent double-clicks
//     setIsSubmitting(true);
//     setStatus("submitting");

//     // ---- FASTA target probe database ----
//     let generatedTargetPaths = "";
//     if (fastaForms.length > 0) {
//         generatedTargetPaths = await handleSubmitGenomicAll(
//             fastaForms,
//             setLoading
//         );
//     }
//     const uploadedPaths = await uploadFiles();

//     if (uploadedPaths["file_regions_file"]) {
//         formData["file_regions"]["value"] = uploadedPaths["file_regions_file"];
//     }
//     let uploadedTargetFastaPath = "";
//     if (uploadedPaths["files_fasta_target_probe_database"]) {
//         uploadedTargetFastaPath =
//             uploadedPaths["files_fasta_target_probe_database"];
//     }
//     const mergedTargetValue = [generatedTargetPaths, uploadedTargetFastaPath]
//         .filter((v) => v && v.length > 0)
//         .join("\n");
//     if (mergedTargetValue.length > 0) {
//         formData["files_fasta_target_probe_database"]["value"] =
//             mergedTargetValue;
//     }

//     // ---- FASTA reference probe database ----
//     let generatedReferencePaths = "";
//     if (fastaFormsReference.length > 0) {
//         generatedReferencePaths = await handleSubmitGenomicAll(
//             fastaFormsReference,
//             setLoading
//         );
//     }
//     let uploadedReferenceFastaPath = "";
//     if (uploadedPaths["files_fasta_reference_database_target_probe"]) {
//         uploadedReferenceFastaPath =
//             uploadedPaths["files_fasta_reference_database_target_probe"];
//     }
//     const mergedReferenceValue = [
//         generatedReferencePaths,
//         uploadedReferenceFastaPath,
//     ]
//         .filter((v) => v && v.length > 0)
//         .join("\n");
//     if (mergedReferenceValue.length > 0) {
//         formData["files_fasta_reference_database_target_probe"]["value"] =
//             mergedReferenceValue;
//     }

//     // ---- FASTA primer probe database ----
//     let generatedPrimerPaths = "";
//     if (fastaFormsPrimer && fastaFormsPrimer.length > 0) {
//         generatedPrimerPaths = await handleSubmitGenomicAll(
//             fastaFormsPrimer,
//             setLoading
//         );
//     }
//     let uploadedPrimerFastaPath = "";
//     if (uploadedPaths["files_fasta_reference_database_primer"]) {
//         uploadedPrimerFastaPath =
//             uploadedPaths["files_fasta_reference_database_primer"];
//     }
//     const mergedPrimerValue = [generatedPrimerPaths, uploadedPrimerFastaPath]
//         .filter((v) => v && v.length > 0)
//         .join("\n");
//     if (mergedPrimerValue.length > 0) {
//         formData["files_fasta_reference_database_primer"]["value"] =
//             mergedPrimerValue;
//     }

//     // ---- FASTA readout probe database ----
//     let generatedReadoutPaths = "";
//     if (fastaFormsReadout && fastaFormsReadout.length > 0) {
//         generatedReadoutPaths = await handleSubmitGenomicAll(
//             fastaFormsReadout,
//             setLoading
//         );
//     }
//     let uploadedReadoutFastaPath = "";
//     if (uploadedPaths["files_fasta_reference_database_readout_probe"]) {
//         uploadedReadoutFastaPath =
//             uploadedPaths["files_fasta_reference_database_readout_probe"];
//     }
//     const mergedReadoutValue = [generatedReadoutPaths, uploadedReadoutFastaPath]
//         .filter((v) => v && v.length > 0)
//         .join("\n");
//     if (mergedReadoutValue.length > 0) {
//         formData["files_fasta_reference_database_readout_probe"]["value"] =
//             mergedReadoutValue;
//     }

//     const runid = await createRunId();

//     // Then: handle scrinshot (upload other files and submit form)
//     if (!areAllFilesUploaded()) {
//         alert("Please upload all required files before submitting.");
//         setLoading(false);
//         return;
//     }

//     try {
//         const response = await axios.post(
//             "http://localhost:5000/api/merfish",
//             { formdata: formData, runid: runid },
//             {
//                 withCredentials: true,
//                 headers: { "Content-Type": "application/json" },
//             }
//         );
//         const result = response.data;
//         console.log(result, "this is the result");

//         setStatus("running");
//     } catch (error) {
//         console.error("Error submitting scrinshot form:", error);
//         alert("Error submitting scrinshot form. Please try again.");
//         setIsSubmitting(false);
//     } finally {
//         alert(`Pipeline is successfully finished`);
//         setLoading(false);
//         setIsSubmitting(false);
//     }
// };