/**
 * THIS PAGE IS NOT IN USE ANYMORE SINCE GENOMIC IS INTEGRATED
 * INTO ALL THE PIPELINES
 *
 */
import React, { useState } from "react";
import Navbar from "../modules/nav";
import axios from "axios";
import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";
import form_Data_Custom from "../forms/genomic_custom_form";
import { OverlayTrigger, Popover } from "react-bootstrap";
import { InfoCircle } from "react-bootstrap-icons";
import { createRunId } from "../modules/helpers";
import {
    vertebrate_mammalianEntries,
    fungiEntries,
    archaeaEntries,
    invertebrateEntries,
    plastidEntries,
    plasmidEntries,
    plantEntries,
    protozoaEntries,
    mitochondrionEntries,
    unknownEntries,
    vertebrate_otherEntries,
} from "../forms/refseqSpecies";
import { ensemblSpecies } from "../forms/ensemblSpecies";

const Genomic: React.FC = () => {
    const [fileReady, setFileReady] = useState(false);

    const [selectedSource, setSelectedSource] = useState("ncbi"); // State to hold selected source
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    const [files, setFiles] = useState({
        file_sequence: null,
        file_annotation: null,
    });
    const areAllFilesUploaded = () => {
        return files.file_sequence !== null && files.file_annotation !== null;
    };
    const handleDownload = async () => {
        try {
            const response = await axios.post(
                "http://localhost:5000/api/genomic/ncbi",
                FormData,
                {
                    responseType: "blob", // Important: Treat response as a file
                }
            );

            // Create a download link for the file
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "genomic_output.fasta"); // Adjust filename as needed
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Download failed", error);
            alert("Error downloading the file.");
        }
    };
    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value } = e.target;
        const keys = name.split(".");

        const updateFormData = (prev: any) => {
            if (keys.length === 2) {
                const [parent, child] = keys;
                return {
                    ...prev,
                    [parent]: {
                        ...(prev[parent] || {}),
                        [child]: {
                            ...(prev[parent]?.[child] || {}),
                            value,
                        },
                    },
                };
            } else {
                return {
                    ...prev,
                    [name]: {
                        ...(prev[name] || {}),
                        value,
                    },
                };
            }
        };

        if (selectedSource === "ncbi") {
            setFormDataNcbi((prev) => updateFormData(prev));
        } else if (selectedSource === "ensembl") {
            setFormDataEns((prev) => updateFormData(prev));
        } else if (selectedSource === "custom") {
            setFormDataCustom((prev) => updateFormData(prev));
        }
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let finalFormData;

        try {
            setLoading(true); // Start loading animation

            // Determine which formData to send
            if (selectedSource === "ncbi") {
                finalFormData = formDataNcbi;
            } else if (selectedSource === "ensembl") {
                finalFormData = formDataEns;
            } else if (selectedSource === "custom") {
                if (!areAllFilesUploaded()) {
                    alert(
                        "Please upload all required files before submitting."
                    );
                    setLoading(false); // Stop loading if validation fails
                    return;
                }

                const uploadedPaths = await uploadFiles();
                for (const key in uploadedPaths) {
                    // @ts-ignore
                    if (finalFormData[key]) {
                        // Preserve the existing comment and update the value with the uploaded path
                        // @ts-ignore

                        finalFormData[key] = {
                            value: uploadedPaths[key], // Update the value with the uploaded path
                            // @ts-ignore
                            comment: finalFormData[key].comment, // Preserve the existing comment
                        };
                    } else {
                        // If the key doesn't exist in formData, create a new entry with an empty comment
                        // @ts-ignore
                        finalFormData[key] = {
                            value: uploadedPaths[key],
                            comment: "",
                        };
                    }
                }
            }

            console.log(finalFormData);
            const runid = await createRunId();

            // Send the request
            const response = await axios.post(
                "http://localhost:5000/api/genomic/" + selectedSource,
                { formdata: finalFormData, runid: runid },
                {
                    withCredentials: true,
                    headers: { "Content-Type": "application/json" },
                }
            );

            alert("Form submitted successfully!");

            // Extract file URL from response and set download URL
            if (response.data?.fileUrl) {
                setDownloadUrl(response.data.fileUrl);
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("Error submitting form. Please try again.");
        } finally {
            setLoading(false); // Stop loading
        }
    };
    const [formDataNcbi, setFormDataNcbi] = useState(form_Data_Ncbi);
    const [formDataEns, setFormDataEns] = useState(form_Data_Ens);
    const [formDataCustom, setFormDataCustom] = useState(form_Data_Custom);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: selectedFiles } = e.target;

        if (!selectedFiles) return;

        // @ts-ignore
        setFiles((prevFiles) => {
            // Check if the input field should support multiple files
            if (
                name === "files_fasta_target_probe_database" ||
                name === "files_fasta_reference_database_target_probe"
            ) {
                // @ts-ignore
                return {};
            } else {
                // For single-file inputs, replace the existing file
                return {
                    ...prevFiles,
                    [name]: selectedFiles[0],
                };
            }
        });
    };
    const uploadFiles = async () => {
        const filePaths: { [key: string]: string } = {};
        console.log(files, "from the event");
        for (const key in files) {
            console.log(key);
            // @ts-ignore
            if (files[key]) {
                const formData = new FormData();
                // @ts-ignore
                if (Array.isArray(files[key])) {
                    console.log(`Processing multiple files for key: ${key}`);
                    const paths = []; // Temporary array to collect file paths
                    // @ts-ignore
                    for (const file of files[key]) {
                        // Use for...of to iterate over the array
                        console.log(file);
                        const formData = new FormData();
                        formData.append("file", file);
                        // Perform upload logic here
                        try {
                            const response = await axios.post(
                                "http://localhost:5000/api/upload",
                                formData,
                                {
                                    withCredentials: true,
                                    headers: {
                                        "Content-Type": "multipart/form-data",
                                    },
                                }
                            );
                            paths.push(response.data.filePath); // Append the returned file path
                        } catch (error) {
                            console.error(`Error uploading ${key}:`, error);
                        }
                    }
                    filePaths[key] = paths.join("\n");
                } else {
                    // @ts-ignore
                    formData.append("file", files[key]);
                    // @ts-ignore
                    try {
                        const response = await axios.post(
                            "http://localhost:5000/api/upload",
                            formData,
                            {
                                withCredentials: true,
                                headers: {
                                    "Content-Type": "multipart/form-data",
                                },
                            }
                        );
                        filePaths[key] = response.data.filePath;
                        // Save the returned file path
                    } catch (error) {
                        console.error(`Error uploading ${key}:`, error);
                    }
                }
            }
        }
        return filePaths;
    };
    const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedSource(e.target.value);
    };

    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    return (
        <div>
            <Navbar />
            <div className="container py-5">
                <h2 className="text-center mb-5"> Genomic Region Generator </h2>

                <div className="row justify-content-center">
                    <div className="col-md-8">
                        <div className="card shadow-lg border-0 rounded-lg">
                            <div className="card-header text-center">
                                <h4>Select Data Source</h4>
                            </div>
                            <div className="card-body p-4">
                                {/* Source Selection */}
                                <div
                                    className="btn-group w-100 mb-4"
                                    role="group"
                                >
                                    <input
                                        type="radio"
                                        className="btn-check"
                                        id="ncbi"
                                        name="source"
                                        value="ncbi"
                                        checked={selectedSource === "ncbi"}
                                        onChange={handleSourceChange}
                                    />
                                    <label
                                        className={`btn btn-outline-primary ${selectedSource === "ncbi" ? "active" : ""}`}
                                        htmlFor="ncbi"
                                    >
                                        🗄️ NCBI
                                    </label>

                                    <input
                                        type="radio"
                                        className="btn-check"
                                        id="ensembl"
                                        name="source"
                                        value="ensembl"
                                        checked={selectedSource === "ensembl"}
                                        onChange={handleSourceChange}
                                    />
                                    <label
                                        className={`btn btn-outline-success ${selectedSource === "ensembl" ? "active" : ""}`}
                                        htmlFor="ensembl"
                                    >
                                        🗄️ Ensembl
                                    </label>

                                    <input
                                        type="radio"
                                        className="btn-check"
                                        id="custom"
                                        name="source"
                                        value="custom"
                                        checked={selectedSource === "custom"}
                                        onChange={handleSourceChange}
                                    />
                                    <label
                                        className={`btn btn-outline-warning ${selectedSource === "custom" ? "active" : ""}`}
                                        htmlFor="custom"
                                    >
                                        📂 Custom
                                    </label>
                                </div>

                                {/* Dynamic Content */}
                                <div className="mt-4">
                                    {selectedSource === "ncbi" && (
                                        <div className="card shadow-sm mb-4 border-primary">
                                            <div className="card-header ">
                                                <h5>NCBI Configuration</h5>
                                            </div>
                                            <div className="card-body">
                                                <form onSubmit={handleSubmit}>
                                                    <label
                                                        htmlFor="taxon"
                                                        className="form-label"
                                                    >
                                                        Taxon
                                                    </label>

                                                    <div className="d-flex align-items-center">
                                                        <select
                                                            className="form-select"
                                                            id="source_params.taxon"
                                                            name="source_params.taxon"
                                                            value={
                                                                formDataNcbi
                                                                    .source_params
                                                                    .taxon.value
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                        >
                                                            <option value="vertebrate_mammalian">
                                                                Vertebrate
                                                                Mammalian
                                                            </option>
                                                            <option value="archaea">
                                                                Archaea
                                                            </option>
                                                            <option value="bacteria">
                                                                Bacteria
                                                            </option>
                                                            <option value="fungi">
                                                                Fungi
                                                            </option>
                                                            <option value="invertebrate">
                                                                Invertebrate
                                                            </option>
                                                            <option value="metagenomes">
                                                                Metagenomes
                                                            </option>
                                                            <option value="mitochondrion">
                                                                Mitochondrion
                                                            </option>
                                                            <option value="plant">
                                                                Plant
                                                            </option>
                                                            <option value="plasmid">
                                                                Plasmid
                                                            </option>
                                                            <option value="plastid">
                                                                Plastid
                                                            </option>
                                                            <option value="protozoa">
                                                                Protozoa
                                                            </option>
                                                            <option value="unknown">
                                                                Unknown
                                                            </option>

                                                            <option value="vertebrate_other">
                                                                Vertebrate Other
                                                            </option>
                                                            <option value="viral">
                                                                Viral
                                                            </option>
                                                        </select>
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataNcbi
                                                                                .source_params
                                                                                .taxon
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>
                                                    <label
                                                        htmlFor="species"
                                                        className="form-label pt-2"
                                                    >
                                                        Species
                                                    </label>

                                                    <div className="d-flex align-items-center">
                                                        {formDataNcbi
                                                            .source_params.taxon
                                                            .value ===
                                                        "vertebrate_mammalian" ? (
                                                            <>
                                                                <select
                                                                    name="source_params.species"
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {/* Fill with mammalian species */}
                                                                    {vertebrate_mammalianEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                                <OverlayTrigger
                                                                    trigger="hover"
                                                                    placement="top"
                                                                    overlay={
                                                                        <Popover id="dir_output">
                                                                            <Popover.Body>
                                                                                {
                                                                                    formDataNcbi
                                                                                        .source_params
                                                                                        .taxon
                                                                                        .comment
                                                                                }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }
                                                                >
                                                                    <InfoCircle
                                                                        style={{
                                                                            fontSize:
                                                                                "1.2rem",
                                                                            cursor: "pointer",
                                                                            color: "#0d6efd",
                                                                            marginLeft:
                                                                                "10px",
                                                                        }}
                                                                    />
                                                                </OverlayTrigger>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "archaea" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {archaeaEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "bacteria" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {/* Fill with invertebrate species */}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "fungi" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {fungiEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "invertebrate" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {invertebrateEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "mitochondrion" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {mitochondrionEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "plant" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {plantEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "plasmid" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    {plasmidEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "plastid" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {plastidEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "protozoa" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {protozoaEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "unknown" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {unknownEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "vertebrate_other" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    name="source_params.species"
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {vertebrate_otherEntries.map(
                                                                        (
                                                                            entry
                                                                        ) => (
                                                                            <option
                                                                                key={
                                                                                    entry
                                                                                }
                                                                                value={
                                                                                    entry
                                                                                }
                                                                            >
                                                                                {
                                                                                    entry
                                                                                }
                                                                            </option>
                                                                        )
                                                                    )}
                                                                </select>
                                                            </>
                                                        ) : formDataNcbi
                                                              .source_params
                                                              .taxon.value ===
                                                          "viral" ? (
                                                            <>
                                                                <select
                                                                    className="form-control"
                                                                    id="source_params.species"
                                                                    name="source_params.species"
                                                                    value={
                                                                        formDataNcbi
                                                                            .source_params
                                                                            .species
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                >
                                                                    <option value="">
                                                                        Select a
                                                                        species
                                                                    </option>
                                                                    {/* Fill with protist species */}
                                                                </select>
                                                            </>
                                                        ) : null}
                                                    </div>

                                                    <label
                                                        htmlFor="annotation_release pt-2"
                                                        className="form-label"
                                                    >
                                                        Annotation Release
                                                    </label>
                                                    <div className="d-flex  align-items-center">
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            id="source_params.annotation_release"
                                                            name="source_params.annotation_release"
                                                            value={
                                                                formDataNcbi
                                                                    .source_params
                                                                    .annotation_release
                                                                    .value
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                        />
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataNcbi
                                                                                .source_params
                                                                                .annotation_release
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>

                                                    <h5 className="pt-2">
                                                        Genomic Regions
                                                    </h5>

                                                    <div className="d-flex flex-wrap gap-3">
                                                        {[
                                                            "gene",
                                                            "intergenic",
                                                            "exon",
                                                            "utr",
                                                            "cds",
                                                            "intron",
                                                            "exon_exon_junction",
                                                        ].map((region) => (
                                                            <div
                                                                key={region}
                                                                className="d-flex align-items-center"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input me-2"
                                                                    id={region}
                                                                    name={
                                                                        region
                                                                    }
                                                                    checked={
                                                                        formDataNcbi
                                                                            .genomic_regions[
                                                                            region as keyof typeof formDataNcbi.genomic_regions
                                                                        ]
                                                                            ?.value ===
                                                                        "true"
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setFormDataNcbi(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                genomic_regions:
                                                                                    {
                                                                                        ...prev.genomic_regions,
                                                                                        [region]:
                                                                                            {
                                                                                                ...prev
                                                                                                    .genomic_regions[
                                                                                                    region as keyof typeof prev.genomic_regions
                                                                                                ],
                                                                                                value: e
                                                                                                    .target
                                                                                                    .checked
                                                                                                    ? "true"
                                                                                                    : "false",
                                                                                            },
                                                                                    },
                                                                            })
                                                                        )
                                                                    }
                                                                />
                                                                <label
                                                                    htmlFor={
                                                                        region
                                                                    }
                                                                    className="form-check-label me-2 mb-0"
                                                                >
                                                                    {region
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase() +
                                                                        region
                                                                            .slice(
                                                                                1
                                                                            )
                                                                            .replace(
                                                                                /_/g,
                                                                                "-"
                                                                            )}
                                                                </label>
                                                                <OverlayTrigger
                                                                    trigger="hover"
                                                                    placement="top"
                                                                    overlay={
                                                                        <Popover
                                                                            id={`popover-${region}`}
                                                                        >
                                                                            <Popover.Body>
                                                                                {
                                                                                    formDataNcbi
                                                                                        .genomic_regions[
                                                                                        region as keyof typeof formDataNcbi.genomic_regions
                                                                                    ]
                                                                                        .comment
                                                                                }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }
                                                                >
                                                                    <InfoCircle
                                                                        style={{
                                                                            fontSize:
                                                                                "1.2rem",
                                                                            cursor: "pointer",
                                                                            color: "#0d6efd",
                                                                        }}
                                                                    />
                                                                </OverlayTrigger>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {formDataNcbi
                                                        .genomic_regions
                                                        .exon_exon_junction
                                                        .value === "true" && (
                                                        <div>
                                                            <label
                                                                htmlFor="exon_exon_junction_block_size"
                                                                className="form-label"
                                                            >
                                                                Exon-Exon-Junction
                                                                Block Size
                                                            </label>
                                                            <div className="d-flex align-items-center">
                                                                <input
                                                                    type="number"
                                                                    className="form-control"
                                                                    id="exon_exon_junction_block_size"
                                                                    name="exon_exon_junction_block_size"
                                                                    value={
                                                                        formDataNcbi
                                                                            .exon_exon_junction_block_size
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                    placeholder="50"
                                                                />
                                                                <OverlayTrigger
                                                                    trigger="hover"
                                                                    placement="top"
                                                                    overlay={
                                                                        <Popover id="dir_output">
                                                                            <Popover.Body>
                                                                                {
                                                                                    formDataNcbi
                                                                                        .exon_exon_junction_block_size
                                                                                        .comment
                                                                                }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }
                                                                >
                                                                    <InfoCircle
                                                                        style={{
                                                                            fontSize:
                                                                                "1.2rem",
                                                                            cursor: "pointer",
                                                                            color: "#0d6efd",
                                                                            marginLeft:
                                                                                "10px",
                                                                        }}
                                                                    />
                                                                </OverlayTrigger>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="d-flex flex-column align-items-center mt-4">
                                                        {/* Submit Button */}
                                                        <button
                                                            onClick={
                                                                handleSubmit
                                                            }
                                                            className="btn btn-primary btn-lg"
                                                            disabled={loading}
                                                        >
                                                            {loading ? (
                                                                <>
                                                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                                                    Processing...
                                                                </>
                                                            ) : (
                                                                "Submit"
                                                            )}
                                                        </button>

                                                        {/* Loading Animation */}
                                                        {loading && (
                                                            <div className="d-flex flex-column align-items-center mt-3">
                                                                <div
                                                                    className="spinner-border text-primary"
                                                                    style={{
                                                                        width: "3rem",
                                                                        height: "3rem",
                                                                    }}
                                                                ></div>
                                                                <p className="mt-2 text-muted">
                                                                    Processing
                                                                    file, please
                                                                    wait...
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Download Button - Appears only when the file is ready */}
                                                        {fileReady && (
                                                            <button
                                                                onClick={
                                                                    handleDownload
                                                                }
                                                                className="btn btn-primary btn-lg mt-4"
                                                            >
                                                                <i className="bi bi-download me-2"></i>{" "}
                                                                Download File
                                                            </button>
                                                        )}
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    {selectedSource === "ensembl" && (
                                        <div className="card shadow-sm mb-4 border-success">
                                            <div className="card-header">
                                                <h5>
                                                    🔬 Ensembl Configuration
                                                </h5>
                                            </div>
                                            <div className="card-body">
                                                <label
                                                    htmlFor="species"
                                                    className="form-label"
                                                >
                                                    Species
                                                </label>
                                                <form onSubmit={handleSubmit}>
                                                    <div className="d-flex align-items-center">
                                                        <select
                                                            className="form-control"
                                                            id="source_params.species"
                                                            name="source_params.species"
                                                            value={
                                                                formDataEns
                                                                    .source_params
                                                                    .species
                                                                    .value
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                        >
                                                            {ensemblSpecies.map(
                                                                (entry) => (
                                                                    <option
                                                                        key={
                                                                            entry
                                                                        }
                                                                        value={
                                                                            entry
                                                                        }
                                                                    >
                                                                        {entry}
                                                                    </option>
                                                                )
                                                            )}
                                                        </select>
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataEns
                                                                                .source_params
                                                                                .species
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>
                                                    <label
                                                        htmlFor="annotation_release"
                                                        className="form-label pt-2"
                                                    >
                                                        Annotation Release
                                                    </label>
                                                    <div className="d-flex align-items-center">
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            id="source_params.annotation_release"
                                                            name="source_params.annotation_release"
                                                            value={
                                                                formDataEns
                                                                    .source_params
                                                                    .annotation_release
                                                                    .value
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            placeholder="current"
                                                        />
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataEns
                                                                                .source_params
                                                                                .annotation_release
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>

                                                    <h5 className="pt-2">
                                                        Genomic Regions
                                                    </h5>

                                                    <div className="d-flex flex-wrap gap-3">
                                                        {[
                                                            "gene",
                                                            "intergenic",
                                                            "exon",
                                                            "utr",
                                                            "cds",
                                                            "intron",
                                                            "exon_exon_junction",
                                                        ].map((region) => (
                                                            <div
                                                                key={region}
                                                                className="d-flex align-items-center"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input me-2"
                                                                    id={region}
                                                                    name={
                                                                        region
                                                                    }
                                                                    checked={
                                                                        formDataEns
                                                                            .genomic_regions[
                                                                            region as keyof typeof formDataEns.genomic_regions
                                                                        ]
                                                                            ?.value ===
                                                                        "true"
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setFormDataEns(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                genomic_regions:
                                                                                    {
                                                                                        ...prev.genomic_regions,
                                                                                        [region]:
                                                                                            {
                                                                                                ...prev
                                                                                                    .genomic_regions[
                                                                                                    region as keyof typeof prev.genomic_regions
                                                                                                ],
                                                                                                value: e
                                                                                                    .target
                                                                                                    .checked
                                                                                                    ? "true"
                                                                                                    : "false",
                                                                                            },
                                                                                    },
                                                                            })
                                                                        )
                                                                    }
                                                                />
                                                                <label
                                                                    htmlFor={
                                                                        region
                                                                    }
                                                                    className="form-check-label me-2 mb-0"
                                                                >
                                                                    {region
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase() +
                                                                        region
                                                                            .slice(
                                                                                1
                                                                            )
                                                                            .replace(
                                                                                /_/g,
                                                                                "-"
                                                                            )}
                                                                </label>
                                                                <OverlayTrigger
                                                                    trigger="hover"
                                                                    placement="top"
                                                                    overlay={
                                                                        <Popover
                                                                            id={`popover-${region}`}
                                                                        >
                                                                            <Popover.Body>
                                                                                {
                                                                                    formDataEns
                                                                                        .genomic_regions[
                                                                                        region as keyof typeof formDataEns.genomic_regions
                                                                                    ]
                                                                                        .comment
                                                                                }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }
                                                                >
                                                                    <InfoCircle
                                                                        style={{
                                                                            fontSize:
                                                                                "1.2rem",
                                                                            cursor: "pointer",
                                                                            color: "#0d6efd",
                                                                        }}
                                                                    />
                                                                </OverlayTrigger>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {formDataEns.genomic_regions
                                                        .exon_exon_junction
                                                        .value === "true" && (
                                                        <>
                                                            <label
                                                                htmlFor="exon_exon_junction_block_size"
                                                                className="form-label"
                                                            >
                                                                Exon-Exon-Junction
                                                                Block Size
                                                            </label>
                                                            <div className="d-flex align-items-center">
                                                                <input
                                                                    type="number"
                                                                    className="form-control"
                                                                    id="exon_exon_junction_block_size"
                                                                    name="exon_exon_junction_block_size"
                                                                    value={
                                                                        formDataEns
                                                                            .exon_exon_junction_block_size
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                    placeholder="50"
                                                                />
                                                                <OverlayTrigger
                                                                    trigger="hover"
                                                                    placement="top"
                                                                    overlay={
                                                                        <Popover id="dir_output">
                                                                            <Popover.Body>
                                                                                {
                                                                                    formDataEns
                                                                                        .exon_exon_junction_block_size
                                                                                        .comment
                                                                                }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }
                                                                >
                                                                    <InfoCircle
                                                                        style={{
                                                                            fontSize:
                                                                                "1.2rem",
                                                                            cursor: "pointer",
                                                                            color: "#0d6efd",
                                                                            marginLeft:
                                                                                "10px",
                                                                        }}
                                                                    />
                                                                </OverlayTrigger>
                                                            </div>
                                                        </>
                                                    )}
                                                    <div className="d-flex flex-column align-items-center mt-4">
                                                        {/* Submit Button */}
                                                        <button
                                                            onClick={
                                                                handleSubmit
                                                            }
                                                            className="btn btn-success btn-lg"
                                                            disabled={loading}
                                                        >
                                                            {loading ? (
                                                                <>
                                                                    <span className="spinner-border spinner-border-sm me-2"></span>
                                                                    Processing...
                                                                </>
                                                            ) : (
                                                                "Submit"
                                                            )}
                                                        </button>

                                                        {/* Loading Animation */}
                                                        {loading && (
                                                            <div className="d-flex flex-column align-items-center mt-3">
                                                                <div
                                                                    className="spinner-border text-primary"
                                                                    style={{
                                                                        width: "3rem",
                                                                        height: "3rem",
                                                                    }}
                                                                ></div>
                                                                <p className="mt-2 text-muted">
                                                                    Processing
                                                                    file, please
                                                                    wait...
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Download Button - Appears only when the file is ready */}
                                                        {fileReady && (
                                                            <button
                                                                onClick={
                                                                    handleDownload
                                                                }
                                                                className="btn btn-primary btn-lg mt-4"
                                                            >
                                                                <i className="bi bi-download me-2"></i>{" "}
                                                                Download File
                                                            </button>
                                                        )}
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    {selectedSource === "custom" && (
                                        <div className="card shadow-sm  border-warning">
                                            <div className="card-header ">
                                                <h5>📂 Custom Data Upload</h5>
                                            </div>
                                            <label
                                                htmlFor="file_sequence"
                                                className="ps-3 pt-1"
                                            >
                                                Upload Sequence File
                                            </label>
                                            <div className="card-body">
                                                <form onSubmit={handleSubmit}>
                                                    <div className="d-flex align-items-center">
                                                        <input
                                                            type="file"
                                                            className="form-control"
                                                            id="source_params.file_sequence"
                                                            name="source_params.file_sequence"
                                                            onChange={
                                                                handleFileChange
                                                            }
                                                        />
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataCustom
                                                                                .source_params
                                                                                .file_sequence
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>
                                                    <label
                                                        htmlFor="file_annotation"
                                                        className="form-label"
                                                    >
                                                        Upload Annotation File
                                                    </label>
                                                    <div className="d-flex align-items-center">
                                                        <input
                                                            type="file"
                                                            className="form-control"
                                                            name="source_params.file_annotation"
                                                            id="source_params.file_annotation"
                                                            onChange={
                                                                handleFileChange
                                                            }
                                                        />
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataCustom
                                                                                .source_params
                                                                                .file_annotation
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>
                                                    <label
                                                        htmlFor="species"
                                                        className="form-label"
                                                    >
                                                        Species
                                                    </label>

                                                    <div className="d-flex align-items-center">
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            name="source_params.species"
                                                            id="source_params.species"
                                                            value={
                                                                formDataCustom
                                                                    .source_params
                                                                    .species
                                                                    .value
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            placeholder=""
                                                        />
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataCustom
                                                                                .source_params
                                                                                .species
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>
                                                    <label
                                                        htmlFor="annotation_release"
                                                        className="form-label"
                                                    >
                                                        Annotation Release
                                                    </label>
                                                    <div className="d-flex align-items-center">
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            id="source_params.annotation_release"
                                                            name="source_params.annotation_release"
                                                            value={
                                                                formDataCustom
                                                                    .source_params
                                                                    .annotation_release
                                                                    .value
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            placeholder=""
                                                        />
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataCustom
                                                                                .source_params
                                                                                .annotation_release
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>
                                                    <label
                                                        htmlFor="genome_assembly"
                                                        className="form-label"
                                                    >
                                                        {" "}
                                                        Genome Assembly{" "}
                                                    </label>
                                                    <div className="d-flex align-items-center">
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            id="source_params.genome_assembly"
                                                            name="source_params.genome_assembly"
                                                            value={
                                                                formDataCustom
                                                                    .source_params
                                                                    .genome_assembly
                                                                    .value
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            placeholder=""
                                                        />
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataCustom
                                                                                .source_params
                                                                                .genome_assembly
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>
                                                    <label
                                                        htmlFor="files_source"
                                                        className="form-label"
                                                    >
                                                        Files Source
                                                    </label>
                                                    <div className="d-flex align-items-center">
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            id="source_params.files_source"
                                                            name="source_params.files_source"
                                                            value={
                                                                formDataCustom
                                                                    .source_params
                                                                    .files_source
                                                                    .value
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            placeholder=""
                                                        />
                                                        <OverlayTrigger
                                                            trigger="hover"
                                                            placement="top"
                                                            overlay={
                                                                <Popover id="dir_output">
                                                                    <Popover.Body>
                                                                        {
                                                                            formDataCustom
                                                                                .source_params
                                                                                .files_source
                                                                                .comment
                                                                        }
                                                                    </Popover.Body>
                                                                </Popover>
                                                            }
                                                        >
                                                            <InfoCircle
                                                                style={{
                                                                    fontSize:
                                                                        "1.2rem",
                                                                    cursor: "pointer",
                                                                    color: "#0d6efd",
                                                                    marginLeft:
                                                                        "10px",
                                                                }}
                                                            />
                                                        </OverlayTrigger>
                                                    </div>

                                                    <div className="d-flex flex-wrap gap-3">
                                                        {[
                                                            "gene",
                                                            "intergenic",
                                                            "exon",
                                                            "utr",
                                                            "cds",
                                                            "intron",
                                                            "exon_exon_junction",
                                                        ].map((region) => (
                                                            <div
                                                                key={region}
                                                                className="d-flex align-items-center"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input me-2"
                                                                    id={region}
                                                                    name={
                                                                        region
                                                                    }
                                                                    checked={
                                                                        formDataCustom
                                                                            .genomic_regions[
                                                                            region as keyof typeof formDataCustom.genomic_regions
                                                                        ]
                                                                            ?.value ===
                                                                        "true"
                                                                    }
                                                                    onChange={(
                                                                        e
                                                                    ) =>
                                                                        setFormDataCustom(
                                                                            (
                                                                                prev
                                                                            ) => ({
                                                                                ...prev,
                                                                                genomic_regions:
                                                                                    {
                                                                                        ...prev.genomic_regions,
                                                                                        [region]:
                                                                                            {
                                                                                                ...prev
                                                                                                    .genomic_regions[
                                                                                                    region as keyof typeof prev.genomic_regions
                                                                                                ],
                                                                                                value: e
                                                                                                    .target
                                                                                                    .checked
                                                                                                    ? "true"
                                                                                                    : "false",
                                                                                            },
                                                                                    },
                                                                            })
                                                                        )
                                                                    }
                                                                />
                                                                <label
                                                                    htmlFor={
                                                                        region
                                                                    }
                                                                    className="form-check-label me-2 mb-0"
                                                                >
                                                                    {region
                                                                        .charAt(
                                                                            0
                                                                        )
                                                                        .toUpperCase() +
                                                                        region
                                                                            .slice(
                                                                                1
                                                                            )
                                                                            .replace(
                                                                                /_/g,
                                                                                "-"
                                                                            )}
                                                                </label>
                                                                <OverlayTrigger
                                                                    trigger="hover"
                                                                    placement="top"
                                                                    overlay={
                                                                        <Popover
                                                                            id={`popover-${region}`}
                                                                        >
                                                                            <Popover.Body>
                                                                                {
                                                                                    formDataCustom
                                                                                        .genomic_regions[
                                                                                        region as keyof typeof formDataCustom.genomic_regions
                                                                                    ]
                                                                                        .comment
                                                                                }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }
                                                                >
                                                                    <InfoCircle
                                                                        style={{
                                                                            fontSize:
                                                                                "1.2rem",
                                                                            cursor: "pointer",
                                                                            color: "#0d6efd",
                                                                        }}
                                                                    />
                                                                </OverlayTrigger>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {formDataCustom
                                                        .genomic_regions
                                                        .exon_exon_junction
                                                        .value === "true" && (
                                                        <>
                                                            <label
                                                                htmlFor="exon_exon_junction_block_size"
                                                                className="form-label"
                                                            >
                                                                Exon-Exon-Junction
                                                                Block Size
                                                            </label>
                                                            <div className="d-flex align-items-center">
                                                                <input
                                                                    type="number"
                                                                    className="form-control"
                                                                    id="exon_exon_junction_block_size"
                                                                    name="exon_exon_junction_block_size"
                                                                    value={
                                                                        formDataCustom
                                                                            .exon_exon_junction_block_size
                                                                            .value
                                                                    }
                                                                    onChange={
                                                                        handleChange
                                                                    }
                                                                    placeholder="50"
                                                                />
                                                                <OverlayTrigger
                                                                    trigger="hover"
                                                                    placement="top"
                                                                    overlay={
                                                                        <Popover
                                                                            id={`popover-blocksize`}
                                                                        >
                                                                            <Popover.Body>
                                                                                {
                                                                                    formDataCustom
                                                                                        .exon_exon_junction_block_size
                                                                                        .comment
                                                                                }
                                                                            </Popover.Body>
                                                                        </Popover>
                                                                    }
                                                                >
                                                                    <InfoCircle
                                                                        style={{
                                                                            fontSize:
                                                                                "1.2rem",
                                                                            cursor: "pointer",
                                                                            color: "#0d6efd",
                                                                            marginLeft:
                                                                                "10px",
                                                                        }}
                                                                    />
                                                                </OverlayTrigger>
                                                            </div>
                                                        </>
                                                    )}
                                                    <div className="container my-4">
                                                        <form
                                                            onSubmit={
                                                                handleSubmit
                                                            }
                                                            id="scrinshotForm"
                                                        >
                                                            {/* File upload inputs */}
                                                            {/* ... */}
                                                            {!areAllFilesUploaded() && (
                                                                <div className="alert alert-warning mt-3">
                                                                    Please
                                                                    upload all
                                                                    required
                                                                    files before
                                                                    submitting.
                                                                </div>
                                                            )}
                                                            <div className="d-flex justify-content-center mt-3">
                                                                <button
                                                                    type="submit"
                                                                    className="btn btn-warning"
                                                                    disabled={
                                                                        isSubmitting ||
                                                                        !areAllFilesUploaded()
                                                                    }
                                                                >
                                                                    {isSubmitting
                                                                        ? "Running..."
                                                                        : "Submit"}
                                                                </button>
                                                            </div>
                                                        </form>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Genomic;
