    import React, { useState,useEffect} from 'react';
    import Navbar from "../modules/nav";
    import axios from "axios";
    import { OverlayTrigger, Popover} from 'react-bootstrap';
    import { InfoCircle } from "react-bootstrap-icons"; // Bootstrap icon
    import formDatas from "../forms/scrinshot_form";
    import form_Data_Ncbi from "../forms/genomic_ncbi_form";
    import form_Data_Ens from "../forms/genomic_ens_form";

    import form_Data_Custom from "../forms/genomic_custom_form";
    import {
        archaeaEntries,
        fungiEntries,
        invertebrateEntries,
        mitochondrionEntries, plantEntries, plasmidEntries, plastidEntries, protozoaEntries, unknownEntries,
        vertebrate_mammalianEntries, vertebrate_otherEntries
    } from "../forms/refseqSpecies";
    import {ensemblSpecies} from "../forms/ensemblSpecies";
    const Scrinshot: React.FC = () => {

        const [loading, setLoading] = useState(false);
        const [useSameReferenceForm, setUseSameReferenceForm] = useState(false);
        const [selectedSource, setSelectedSource] = useState("ncbi"); // State to hold selected source
        const [selectedSource2, setSelectedSource2] = useState("ncbi"); // State to hold selected source
        const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
        const [status, setStatus] = useState("idle");
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [formData, setFormData] = useState(formDatas);
        const [formDataNcbi, setFormDataNcbi] = useState(form_Data_Ncbi);
        const [formDataEns, setFormDataEns] = useState(form_Data_Ens);
        const [formDataCustom, setFormDataCustom] = useState(form_Data_Custom);
        const [formData2Ncbi, setFormData2Ncbi] = useState(form_Data_Ncbi);
        const [formData2Ens, setFormData2Ens] = useState(form_Data_Ens);
        const [formData2Custom, setFormData2Custom] = useState(form_Data_Custom);
        const [generateFastaFiles, setGenerateFastaFiles] = useState(false);
        const [generateFastaFiles2, setGenerateFastaFiles2] = useState(false);

        useEffect(() => {
            if (useSameReferenceForm) {
                setFormData2Ncbi(formDataNcbi);
                setFormData2Ens(formDataEns);
                setFormData2Custom(formDataCustom);
            }
        }, [formDataNcbi, formDataEns, formDataCustom, useSameReferenceForm]);
        interface FileState {
            file_regions: File | null;
            files_fasta_target_probe_database: File[]; // Always an array
            files_fasta_reference_database_target_probe: File[]; // Always an array
        }
        const [files, setFiles] = useState<FileState>({
            file_regions: null,
            files_fasta_target_probe_database: [], // Empty array
            files_fasta_reference_database_target_probe: [], // Empty array
        });
        const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
            setSelectedSource(e.target.value);
        };
        const handleSourceChange2 = (e: React.ChangeEvent<HTMLSelectElement>) => {
            setSelectedSource2(e.target.value);
        };
        const handleFileChangeGenomic = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, files: selectedFiles } = e.target;

            if (!selectedFiles) return;

            // @ts-ignore
            setFiles((prevFiles) => {
                // Check if the input field should support multiple files
                if (name === "files_fasta_target_probe_database" || name === "files_fasta_reference_database_target_probe") {
                    // @ts-ignore
                    return {
                    };
                } else {
                    // For single-file inputs, replace the existing file
                    return {
                        ...prevFiles,
                        [name]: selectedFiles[0],
                    };
                }
            });
        };
    
        const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, files: selectedFiles } = e.target;
            if (!selectedFiles) return;
    
            setFiles((prevFiles) => ({
                ...prevFiles,
                [name]: name === 'file_regions'
                    ? selectedFiles[0] // Single file
                    : Array.from(selectedFiles), // Multiple files (always an array)
            }));
        };
        const areAllFilesUploaded = () => {
            return (
                ( generateFastaFiles ||
                    (files.files_fasta_target_probe_database.length > 0 &&
                files.files_fasta_reference_database_target_probe.length > 0))
            );
        };
        const uploadFiles = async () => {
            const filePaths: { [key: string]: string } = {};
            console.log(files,'from the event');
            for (const key in files) {
                // @ts-ignore
                if (files[key]) {
                    const formDataU = new FormData();
                    // @ts-ignore
                    if (Array.isArray(files[key])) {
                        console.log(`Processing multiple files for key: ${key}`);
                        let paths = []; // Temporary array to collect file paths
                        // @ts-ignore
                        for (const file of files[key]) { // Use for...of to iterate over the array
                            console.log(file);
                            const formDataU = new FormData();
                            formDataU.append("file", file);
                            // Perform upload logic here
                            try {
                                const response = await axios.post(
                                    "http://localhost:5000/api/upload",
                                    formDataU,
                                    {
                                        headers: { "Content-Type": "multipart/form-data" },
                                    }
                                );
                                paths.push(response.data.filePath); // Append the returned file path
                            } catch (error) {
                                console.error(`Error uploading ${key}:`, error);
                            }
                        }
                        filePaths[key] = paths.join("\n");
                    } else {
    
                        if (formData.file_regions.value.length ===0) {
                            // @ts-ignore
                            formDataU.append("file", files[key]);
                            // @ts-ignore
                            try {
                                const response = await axios.post(
                                    "http://localhost:5000/api/upload",
                                    formDataU,
                                    {
                                        headers: { "Content-Type": "multipart/form-data" },
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
            }
            console.log(filePaths);
            return filePaths;
        };
    
    
        const toggleDeveloperSettings = () => {
            setShowDeveloperSettings(!showDeveloperSettings);
        };

        const [activeTab, setActiveTab] = useState("general");
        const [activetab2, setActivetab2] = useState("specfblastn");
        const renderTabContent = () => {
            switch (activeTab) {
                case "general":
                    return (
                        <div>
                            <div>
                                <h4>General Parameters</h4>
                                <div className="mb-3">
                                    <label
                                        htmlFor="n_jobs"
                                        className="form-label mb-2"
                                    >
                                        Number of Jobs:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="n_jobs"
                                            name="n_jobs"
                                            value={formData.n_jobs.value}
                                            onChange={handleChange}
                                            required
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="n_jobs">
                                                    <Popover.Body>
                                                        {formData.n_jobs.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
    
                            </div>

                            <div className="mb-3">
                                <label
                                    htmlFor="write_intermediate_steps"
                                    className="form-label mb-2"
                                >
                                    Write Intermediate Steps:
                                </label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-select"
                                        id="write_intermediate_steps"
                                        name="write_intermediate_steps"
                                        value={formData.write_intermediate_steps.value}
                                        onChange={handleChange}
                                    >
                                        <option value="true">True</option>
                                        <option value="false">False</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
    
                                            <Popover id="write_intermediate_steps">
                                                <Popover.Body>
                                                    {formData.write_intermediate_steps.comment}
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px"
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="top_n_sets" className="form-label">Maximum Number of Sets:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="top_n_sets" name="top_n_sets"
                                           value={formData.top_n_sets.value} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="top_n_sets">
                                                <Popover.Body>
                                                    {formData.top_n_sets.comment}
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px"
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
    
                            </div>
                        </div>
                    );
                case "probe_sequences":
                    return (
                        <div className="mb-4">
                            <h4>Target Probe Parameters</h4>
                            <div className="mb-3">
                                <label htmlFor="file_regions" className="form-label">
                                    Target File:
                                </label>
                                <div className="d-flex flex-column w-100">
                                    {/* Flex container for file input and custom button */}
                                    <div className="d-flex align-items-center w-100">
                                        {/* Hidden file input */}
                                        <input
                                            type="file"
                                            className="form-control visually-hidden"
                                            id="file_regions"
                                            name="file_regions"
                                            onChange={handleFileChange}
                                            disabled={formData.file_regions.value.length > 0}

                                        />
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="file_regions"
                                            name="file_regions"
                                            list="geneExamples"
                                            placeholder="Enter genes (comma-separated) or pick an example"
                                            onChange={handleChange}
                                            value={formData.file_regions.value}
                                        />

                                        <datalist id="geneExamples">
                                            <option value="AARS1" />
                                            <option value="ABCC1" />
                                            <option value="BCAR1,MIR4519,TNFRSF12A,RABEP2" />
                                        </datalist>

                                        {/* Custom file input button spanning full width */}
                                        <label
                                            htmlFor="file_regions"
                                            className="btn btn-outline-primary d-block me-2 w-100 "
                                            style={{cursor: 'pointer'}}
                                        >
                                            Choose File
                                        </label>

                                        {/* Info icon with popover */}
                                        <div className="d-flex align-items-center ms-2">
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="file_regions">
                                                        <Popover.Body>
                                                            {formData.file_regions.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle
                                                    style={{
                                                        fontSize: "1.2rem", // Adjust as needed
                                                        cursor: "pointer",
                                                        color: "#0d6efd",
                                                    }}
                                                />
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    {/* Display selected file name under the icon */}
                                    <div className="text-muted small mt-1">
                                        {files.file_regions
                                            ? `Selected: ${files.file_regions.name}`
                                            : "No file selected"}
                                    </div>
                                </div>


                                <div className="mb-3">
                                    <label htmlFor="files_fasta_target_probe_database" className="form-label">
                                        Fasta Probe Database:
                                    </label>
                                    <div className="d-flex align-items-center w-100">
                                        {/* Hidden file input */}
                                        <input
                                            type="file"
                                            className="form-control visually-hidden"
                                            id="files_fasta_target_probe_database"
                                            name="files_fasta_target_probe_database"
                                            onChange={handleFileChange}
                                            multiple
                                            disabled={generateFastaFiles}

                                        />
                                        <label
                                            htmlFor="files_fasta_target_probe_database"
                                            className="btn btn-outline-primary d-block me-2 w-100"
                                            style={{
                                                cursor: generateFastaFiles ? "not-allowed" : "pointer",
                                                opacity: generateFastaFiles ? 0.5 : 1,
                                                pointerEvents: generateFastaFiles ? "none" : "auto"
                                            }}
                                        >
                                            Choose File
                                        </label>

                                        {/* Info icon with popover */}
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="files_fasta_target_probe_database">
                                                    <Popover.Body>
                                                        {formData.files_fasta_target_probe_database.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>

                                    </div>
                                    <div className="text-muted small mt-1">
                                        {files.files_fasta_target_probe_database.length > 0
                                            ? `Selected: ${files.files_fasta_target_probe_database.map(f => f.name).join(', ')}`
                                            : "No files selected"}
                                    </div>

                                </div>
                                <div className="form-check form-switch mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="generateFastaToggle"
                                        checked={generateFastaFiles}
                                        onChange={(e) => setGenerateFastaFiles(e.target.checked)}
                                    />


                                    <label className="form-check-label" htmlFor="generateFastaToggle">
                                        Generate FASTA files
                                    </label>
                                </div>

                                {generateFastaFiles && (

                                    <>
                                        <div className="row mb-3">
                                            <div className="col-auto">
                                                <label htmlFor="source" className="form-label">Select Source</label>
                                                <select
                                                    className="form-select"
                                                    id="source"
                                                    name="source"
                                                    value={selectedSource}
                                                    onChange={handleSourceChange}
                                                >
                                                    <option value="ncbi"> NCBI</option>
                                                    <option value="ensembl"> Ensembl</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center">
                                            <div className="col-md-8">
                                                {/* Source Selection */}

                                                {/* Dynamic Content */}
                                                <div >
                                                    {selectedSource === "ncbi" && (
                                                        <div>
                                                            <form onSubmit={handleSubmit}>
                                                                <div className="row g-3">
                                                                    <div className="col">
                                                                        <label htmlFor="taxon" className="form-label">Taxon</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <select
                                                                                className="form-select"
                                                                                id="source_params.taxon"
                                                                                name="source_params.taxon"
                                                                                value={formDataNcbi.source_params.taxon.value}
                                                                                onChange={handleChangeGenomic}
                                                                            >
                                                                                <option value="vertebrate_mammalian">Vertebrate Mammalian</option>
                                                                                <option value="archaea">Archaea</option>
                                                                                <option value="bacteria">Bacteria</option>
                                                                                <option value="fungi">Fungi</option>
                                                                                <option value="invertebrate">Invertebrate</option>
                                                                                <option value="metagenomes">Metagenomes</option>
                                                                                <option value="mitochondrion">Mitochondrion</option>
                                                                                <option value="plant">Plant</option>
                                                                                <option value="plasmid">Plasmid</option>
                                                                                <option value="plastid">Plastid</option>
                                                                                <option value="protozoa">Protozoa</option>
                                                                                <option value="unknown">Unknown</option>
                                                                                <option value="vertebrate_other">Vertebrate Other</option>
                                                                                <option value="viral">Viral</option>
                                                                            </select>
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formDataNcbi.source_params.taxon.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    <div className="col-md-6">
                                                                        <label htmlFor="species" className="form-label">Species</label>
                                                                        <div className="d-flex align-items-center">
                                                                            {formDataNcbi.source_params.taxon.value === "vertebrate_mammalian" ? (
                                                                                <select
                                                                                    name="source_params.species"
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {vertebrate_mammalianEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "archaea" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {archaeaEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "bacteria" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "fungi" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {fungiEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "invertebrate" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {invertebrateEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "mitochondrion" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {mitochondrionEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "plant" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {plantEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "plasmid" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    {plasmidEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "plastid" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {plastidEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "protozoa" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {protozoaEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "unknown" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {unknownEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "vertebrate_other" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    name="source_params.species"
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {vertebrate_otherEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "viral" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                </select>
                                                                            ) : null}
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formDataNcbi.source_params.species.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    <div className="col-md-6">
                                                                        <label htmlFor="annotation_release" className="form-label">Annotation Release</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <input
                                                                                type="number"
                                                                                className="form-control"
                                                                                id="source_params.annotation_release"
                                                                                name="source_params.annotation_release"
                                                                                value={formDataNcbi.source_params.annotation_release.value}
                                                                                onChange={handleChangeGenomic}
                                                                            />
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formDataNcbi.source_params.annotation_release.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    {formDataNcbi.genomic_regions.exon_exon_junction.value === "true" && (
                                                                        <div className="col-md-6">
                                                                            <label htmlFor="exon_exon_junction_block_size" className="form-label">
                                                                                Exon-Exon-Junction Block Size
                                                                            </label>
                                                                            <div className="d-flex align-items-center">
                                                                                <input
                                                                                    type="number"
                                                                                    className="form-control"
                                                                                    id="exon_exon_junction_block_size"
                                                                                    name="exon_exon_junction_block_size"
                                                                                    value={formDataNcbi.exon_exon_junction_block_size.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                    placeholder="50"
                                                                                />
                                                                                <OverlayTrigger
                                                                                    trigger="hover"
                                                                                    placement="top"
                                                                                    overlay={
                                                                                        <Popover id="dir_output">
                                                                                            <Popover.Body>
                                                                                                {formDataNcbi.exon_exon_junction_block_size.comment}
                                                                                            </Popover.Body>
                                                                                        </Popover>
                                                                                    }
                                                                                >
                                                                                    <InfoCircle
                                                                                        style={{
                                                                                            fontSize: "1.2rem",
                                                                                            cursor: "pointer",
                                                                                            color: "#0d6efd",
                                                                                            marginLeft: "10px"
                                                                                        }}
                                                                                    />
                                                                                </OverlayTrigger>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <h5 className="pt-3">Genomic Regions</h5>
                                                                <div className="row g-3">
                                                                    {["gene", "intergenic", "exon", "utr", "cds", "intron", "exon_exon_junction"].map((region) => (
                                                                        <div key={region} className="col-md-4">
                                                                            <div className="d-flex align-items-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="form-check-input me-2"
                                                                                    id={region}
                                                                                    name={region}
                                                                                    checked={
                                                                                        formDataNcbi.genomic_regions[region as keyof typeof formDataNcbi.genomic_regions]?.value === "true"
                                                                                    }
                                                                                    onChange={(e) =>
                                                                                        setFormDataNcbi((prev) => ({
                                                                                            ...prev,
                                                                                            genomic_regions: {
                                                                                                ...prev.genomic_regions,
                                                                                                [region]: {
                                                                                                    ...prev.genomic_regions[region as keyof typeof prev.genomic_regions],
                                                                                                    value: e.target.checked ? "true" : "false",
                                                                                                },
                                                                                            },
                                                                                        }))
                                                                                    }
                                                                                />
                                                                                <label htmlFor={region} className="form-check-label me-2 mb-0">
                                                                                    {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, "-")}
                                                                                </label>
                                                                                <OverlayTrigger
                                                                                    trigger="hover"
                                                                                    placement="top"
                                                                                    overlay={
                                                                                        <Popover id={`popover-${region}`}>
                                                                                            <Popover.Body>
                                                                                                {formDataNcbi.genomic_regions[region as keyof typeof formDataNcbi.genomic_regions].comment}
                                                                                            </Popover.Body>
                                                                                        </Popover>
                                                                                    }
                                                                                >
                                                                                    <InfoCircle
                                                                                        style={{
                                                                                            fontSize: "1.2rem",
                                                                                            cursor: "pointer",
                                                                                            color: "#0d6efd",
                                                                                        }}
                                                                                    />
                                                                                </OverlayTrigger>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>


                                                            </form>
                                                        </div>
                                                    )}

                                                    {selectedSource === "ensembl" && (
                                                        <div>
                                                            <form onSubmit={handleSubmit}>
                                                                <div className="row g-3">
                                                                    <div className="col-md-6">
                                                                        <label htmlFor="species" className="form-label">Species</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataEns.source_params.species.value}
                                                                                onChange={handleChangeGenomic}
                                                                            >
                                                                                {ensemblSpecies.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formDataEns.source_params.species.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    <div className="col-md-6">
                                                                        <label htmlFor="annotation_release" className="form-label">Annotation Release</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <input
                                                                                type="number"
                                                                                className="form-control"
                                                                                id="source_params.annotation_release"
                                                                                name="source_params.annotation_release"
                                                                                value={formDataEns.source_params.annotation_release.value}
                                                                                onChange={handleChangeGenomic}
                                                                                placeholder="current"
                                                                            />
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formDataEns.source_params.annotation_release.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    {formDataEns.genomic_regions.exon_exon_junction.value === "true" && (
                                                                        <div className="col-md-6">
                                                                            <label htmlFor="exon_exon_junction_block_size" className="form-label">
                                                                                Exon-Exon-Junction Block Size
                                                                            </label>
                                                                            <div className="d-flex align-items-center">
                                                                                <input
                                                                                    type="number"
                                                                                    className="form-control"
                                                                                    id="exon_exon_junction_block_size"
                                                                                    name="exon_exon_junction_block_size"
                                                                                    value={formDataEns.exon_exon_junction_block_size.value}
                                                                                    onChange={handleChangeGenomic}
                                                                                    placeholder="50"
                                                                                />
                                                                                <OverlayTrigger
                                                                                    trigger="hover"
                                                                                    placement="top"
                                                                                    overlay={
                                                                                        <Popover id="dir_output">
                                                                                            <Popover.Body>
                                                                                                {formDataEns.exon_exon_junction_block_size.comment}
                                                                                            </Popover.Body>
                                                                                        </Popover>
                                                                                    }
                                                                                >
                                                                                    <InfoCircle
                                                                                        style={{
                                                                                            fontSize: "1.2rem",
                                                                                            cursor: "pointer",
                                                                                            color: "#0d6efd",
                                                                                            marginLeft: "10px"
                                                                                        }}
                                                                                    />
                                                                                </OverlayTrigger>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <h5 className="pt-3">Genomic Regions</h5>
                                                                <div className="row g-3">
                                                                    {["gene", "intergenic", "exon", "utr", "cds", "intron", "exon_exon_junction"].map((region) => (
                                                                        <div key={region} className="col-md-4">
                                                                            <div className="d-flex align-items-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="form-check-input me-2"
                                                                                    id={region}
                                                                                    name={region}
                                                                                    checked={
                                                                                        formDataEns.genomic_regions[region as keyof typeof formDataEns.genomic_regions]?.value === "true"
                                                                                    }
                                                                                    onChange={(e) =>
                                                                                        setFormDataEns((prev) => ({
                                                                                            ...prev,
                                                                                            genomic_regions: {
                                                                                                ...prev.genomic_regions,
                                                                                                [region]: {
                                                                                                    ...prev.genomic_regions[region as keyof typeof prev.genomic_regions],
                                                                                                    value: e.target.checked ? "true" : "false",
                                                                                                },
                                                                                            },
                                                                                        }))
                                                                                    }
                                                                                />
                                                                                <label htmlFor={region} className="form-check-label me-2 mb-0">
                                                                                    {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, "-")}
                                                                                </label>
                                                                                <OverlayTrigger
                                                                                    trigger="hover"
                                                                                    placement="top"
                                                                                    overlay={
                                                                                        <Popover id={`popover-${region}`}>
                                                                                            <Popover.Body>
                                                                                                {formDataEns.genomic_regions[region as keyof typeof formDataEns.genomic_regions].comment}
                                                                                            </Popover.Body>
                                                                                        </Popover>
                                                                                    }
                                                                                >
                                                                                    <InfoCircle
                                                                                        style={{
                                                                                            fontSize: "1.2rem",
                                                                                            cursor: "pointer",
                                                                                            color: "#0d6efd",
                                                                                        }}
                                                                                    />
                                                                                </OverlayTrigger>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                            </form>
                                                        </div>
                                                    )}
                                                </div>


                                            </div>
                                        </div>

                                    </>
                                )}

                                <div className="mb-3">
                                    <label htmlFor="files_fasta_reference_database_target_probe" className="form-label">
                                        Fasta Probe Reference Database:
                                    </label>
                                    <div className="d-flex align-items-center w-100">
                                        {/* Hidden file input */}
                                        <input
                                            type="file"
                                            className="form-control visually-hidden"
                                            id="files_fasta_reference_database_target_probe"
                                            name="files_fasta_reference_database_target_probe"
                                            onChange={handleFileChange}
                                            multiple
                                            disabled={generateFastaFiles2}

                                        />
                                        <label
                                            htmlFor="files_fasta_reference_database_target_probe"
                                            className="btn btn-outline-primary d-block me-2 w-100"
                                            style={{
                                                cursor: generateFastaFiles2 ? "not-allowed" : "pointer",
                                                opacity: generateFastaFiles2 ? 0.5 : 1,
                                                pointerEvents: generateFastaFiles2 ? "none" : "auto"
                                            }}
                                        >
                                            Choose File
                                        </label>

                                        {/* Info icon with popover */}
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="files_fasta_reference_database_target_probe">
                                                    <Popover.Body>
                                                        {formData.files_fasta_reference_database_targe_probe.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>

                                    </div>
                                    {/* Display selected file names */}
                                    <div className="text-muted small mt-1">
                                        {files.files_fasta_reference_database_target_probe.length > 0
                                            ? `Selected: ${files.files_fasta_reference_database_target_probe.map(f => f.name).join(', ')}`
                                            : "No files selected"}
                                    </div>
                                </div>
                                <div className="form-check form-switch mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="generateFastaToggle"
                                        checked={generateFastaFiles2}
                                        onChange={(e) => setGenerateFastaFiles2(e.target.checked)}
                                    />


                                    <label className="form-check-label" htmlFor="generateFastaToggle">
                                        Generate FASTA files for reference
                                    </label>
                                </div>
                                {generateFastaFiles2 && (

                                    <>
                                        <div className="row mb-3">
                                            <div className="col-auto">
                                                <label htmlFor="source" className="form-label">Select Source</label>
                                                <select
                                                    className="form-select"
                                                    id="source"
                                                    name="source"
                                                    value={selectedSource2}
                                                    onChange={handleSourceChange2}
                                                >
                                                    <option value="ncbi"> NCBI</option>
                                                    <option value="ensembl"> Ensembl</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center">
                                            <div className="col-md-8">
                                                {/* Source Selection */}

                                                {/* Dynamic Content */}
                                                <div >
                                                    {selectedSource === "ncbi" && (
                                                        <div>
                                                            <form onSubmit={handleSubmit}>
                                                                <div className="row g-3">
                                                                    <div className="col">
                                                                        <label htmlFor="taxon" className="form-label">Taxon</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <select
                                                                                className="form-select"
                                                                                id="source_params.taxon"
                                                                                name="source_params.taxon"
                                                                                value={formData2Ncbi.source_params.taxon.value}
                                                                                onChange={handleChangeGenomicReference}
                                                                            >
                                                                                <option value="vertebrate_mammalian">Vertebrate Mammalian</option>
                                                                                <option value="archaea">Archaea</option>
                                                                                <option value="bacteria">Bacteria</option>
                                                                                <option value="fungi">Fungi</option>
                                                                                <option value="invertebrate">Invertebrate</option>
                                                                                <option value="metagenomes">Metagenomes</option>
                                                                                <option value="mitochondrion">Mitochondrion</option>
                                                                                <option value="plant">Plant</option>
                                                                                <option value="plasmid">Plasmid</option>
                                                                                <option value="plastid">Plastid</option>
                                                                                <option value="protozoa">Protozoa</option>
                                                                                <option value="unknown">Unknown</option>
                                                                                <option value="vertebrate_other">Vertebrate Other</option>
                                                                                <option value="viral">Viral</option>
                                                                            </select>
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formData2Ncbi.source_params.taxon.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    <div className="col-md-6">
                                                                        <label htmlFor="species" className="form-label">Species</label>
                                                                        <div className="d-flex align-items-center">
                                                                            {formData2Ncbi.source_params.taxon.value === "vertebrate_mammalian" ? (
                                                                                <select
                                                                                    name="source_params.species"
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {vertebrate_mammalianEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "archaea" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formDataNcbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {archaeaEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "bacteria" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "fungi" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {fungiEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formDataNcbi.source_params.taxon.value === "invertebrate" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {invertebrateEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "mitochondrion" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {mitochondrionEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "plant" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {plantEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "plasmid" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    {plasmidEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "plastid" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {plastidEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "protozoa" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {protozoaEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "unknown" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {unknownEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "vertebrate_other" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    name="source_params.species"
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                    {vertebrate_otherEntries.map((entry) => (
                                                                                        <option key={entry} value={entry}>{entry}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : formData2Ncbi.source_params.taxon.value === "viral" ? (
                                                                                <select
                                                                                    className="form-control"
                                                                                    id="source_params.species"
                                                                                    name="source_params.species"
                                                                                    value={formData2Ncbi.source_params.species.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                >
                                                                                    <option value="">Select a species</option>
                                                                                </select>
                                                                            ) : null}
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formData2Ncbi.source_params.species.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    <div className="col-md-6">
                                                                        <label htmlFor="annotation_release" className="form-label">Annotation Release</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <input
                                                                                type="number"
                                                                                className="form-control"
                                                                                id="source_params.annotation_release"
                                                                                name="source_params.annotation_release"
                                                                                value={formData2Ncbi.source_params.annotation_release.value}
                                                                                onChange={handleChangeGenomicReference}
                                                                            />
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formData2Ncbi.source_params.annotation_release.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    {formData2Ncbi.genomic_regions.exon_exon_junction.value === "true" && (
                                                                        <div className="col-md-6">
                                                                            <label htmlFor="exon_exon_junction_block_size" className="form-label">
                                                                                Exon-Exon-Junction Block Size
                                                                            </label>
                                                                            <div className="d-flex align-items-center">
                                                                                <input
                                                                                    type="number"
                                                                                    className="form-control"
                                                                                    id="exon_exon_junction_block_size"
                                                                                    name="exon_exon_junction_block_size"
                                                                                    value={formData2Ncbi.exon_exon_junction_block_size.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                    placeholder="50"
                                                                                />
                                                                                <OverlayTrigger
                                                                                    trigger="hover"
                                                                                    placement="top"
                                                                                    overlay={
                                                                                        <Popover id="dir_output">
                                                                                            <Popover.Body>
                                                                                                {formData2Ncbi.exon_exon_junction_block_size.comment}
                                                                                            </Popover.Body>
                                                                                        </Popover>
                                                                                    }
                                                                                >
                                                                                    <InfoCircle
                                                                                        style={{
                                                                                            fontSize: "1.2rem",
                                                                                            cursor: "pointer",
                                                                                            color: "#0d6efd",
                                                                                            marginLeft: "10px"
                                                                                        }}
                                                                                    />
                                                                                </OverlayTrigger>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <h5 className="pt-3">Genomic Regions</h5>
                                                                <div className="row g-3">
                                                                    {["gene", "intergenic", "exon", "utr", "cds", "intron", "exon_exon_junction"].map((region) => (
                                                                        <div key={region} className="col-md-4">
                                                                            <div className="d-flex align-items-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="form-check-input me-2"
                                                                                    id={region}
                                                                                    name={region}
                                                                                    checked={
                                                                                        formData2Ncbi.genomic_regions[region as keyof typeof formData2Ncbi.genomic_regions]?.value === "true"
                                                                                    }
                                                                                    onChange={(e) =>
                                                                                        setFormData2Ncbi((prev) => ({
                                                                                            ...prev,
                                                                                            genomic_regions: {
                                                                                                ...prev.genomic_regions,
                                                                                                [region]: {
                                                                                                    ...prev.genomic_regions[region as keyof typeof prev.genomic_regions],
                                                                                                    value: e.target.checked ? "true" : "false",
                                                                                                },
                                                                                            },
                                                                                        }))
                                                                                    }
                                                                                />
                                                                                <label htmlFor={region} className="form-check-label me-2 mb-0">
                                                                                    {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, "-")}
                                                                                </label>
                                                                                <OverlayTrigger
                                                                                    trigger="hover"
                                                                                    placement="top"
                                                                                    overlay={
                                                                                        <Popover id={`popover-${region}`}>
                                                                                            <Popover.Body>
                                                                                                {formData2Ncbi.genomic_regions[region as keyof typeof formData2Ncbi.genomic_regions].comment}
                                                                                            </Popover.Body>
                                                                                        </Popover>
                                                                                    }
                                                                                >
                                                                                    <InfoCircle
                                                                                        style={{
                                                                                            fontSize: "1.2rem",
                                                                                            cursor: "pointer",
                                                                                            color: "#0d6efd",
                                                                                        }}
                                                                                    />
                                                                                </OverlayTrigger>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>


                                                            </form>
                                                        </div>
                                                    )}

                                                    {selectedSource === "ensembl" && (
                                                        <div>
                                                            <form onSubmit={handleSubmit}>
                                                                <div className="row g-3">
                                                                    <div className="col-md-6">
                                                                        <label htmlFor="species" className="form-label">Species</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formData2Ens.source_params.species.value}
                                                                                onChange={handleChangeGenomicReference}
                                                                            >
                                                                                {ensemblSpecies.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formData2Ens.source_params.species.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    <div className="col-md-6">
                                                                        <label htmlFor="annotation_release" className="form-label">Annotation Release</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <input
                                                                                type="number"
                                                                                className="form-control"
                                                                                id="source_params.annotation_release"
                                                                                name="source_params.annotation_release"
                                                                                value={formData2Ens.source_params.annotation_release.value}
                                                                                onChange={handleChangeGenomicReference}
                                                                                placeholder="current"
                                                                            />
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formData2Ens.source_params.annotation_release.comment}
                                                                                        </Popover.Body>
                                                                                    </Popover>
                                                                                }
                                                                            >
                                                                                <InfoCircle
                                                                                    style={{
                                                                                        fontSize: "1.2rem",
                                                                                        cursor: "pointer",
                                                                                        color: "#0d6efd",
                                                                                        marginLeft: "10px"
                                                                                    }}
                                                                                />
                                                                            </OverlayTrigger>
                                                                        </div>
                                                                    </div>

                                                                    {formDataEns.genomic_regions.exon_exon_junction.value === "true" && (
                                                                        <div className="col-md-6">
                                                                            <label htmlFor="exon_exon_junction_block_size" className="form-label">
                                                                                Exon-Exon-Junction Block Size
                                                                            </label>
                                                                            <div className="d-flex align-items-center">
                                                                                <input
                                                                                    type="number"
                                                                                    className="form-control"
                                                                                    id="exon_exon_junction_block_size"
                                                                                    name="exon_exon_junction_block_size"
                                                                                    value={formData2Ens.exon_exon_junction_block_size.value}
                                                                                    onChange={handleChangeGenomicReference}
                                                                                    placeholder="50"
                                                                                />
                                                                                <OverlayTrigger
                                                                                    trigger="hover"
                                                                                    placement="top"
                                                                                    overlay={
                                                                                        <Popover id="dir_output">
                                                                                            <Popover.Body>
                                                                                                {formData2Ens.exon_exon_junction_block_size.comment}
                                                                                            </Popover.Body>
                                                                                        </Popover>
                                                                                    }
                                                                                >
                                                                                    <InfoCircle
                                                                                        style={{
                                                                                            fontSize: "1.2rem",
                                                                                            cursor: "pointer",
                                                                                            color: "#0d6efd",
                                                                                            marginLeft: "10px"
                                                                                        }}
                                                                                    />
                                                                                </OverlayTrigger>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <h5 className="pt-3">Genomic Regions</h5>
                                                                <div className="row g-3">
                                                                    {["gene", "intergenic", "exon", "utr", "cds", "intron", "exon_exon_junction"].map((region) => (
                                                                        <div key={region} className="col-md-4">
                                                                            <div className="d-flex align-items-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    className="form-check-input me-2"
                                                                                    id={region}
                                                                                    name={region}
                                                                                    checked={
                                                                                        formData2Ens.genomic_regions[region as keyof typeof formData2Ens.genomic_regions]?.value === "true"
                                                                                    }
                                                                                    onChange={(e) =>
                                                                                        setFormData2Ens((prev) => ({
                                                                                            ...prev,
                                                                                            genomic_regions: {
                                                                                                ...prev.genomic_regions,
                                                                                                [region]: {
                                                                                                    ...prev.genomic_regions[region as keyof typeof prev.genomic_regions],
                                                                                                    value: e.target.checked ? "true" : "false",
                                                                                                },
                                                                                            },
                                                                                        }))
                                                                                    }
                                                                                />
                                                                                <label htmlFor={region} className="form-check-label me-2 mb-0">
                                                                                    {region.charAt(0).toUpperCase() + region.slice(1).replace(/_/g, "-")}
                                                                                </label>
                                                                                <OverlayTrigger
                                                                                    trigger="hover"
                                                                                    placement="top"
                                                                                    overlay={
                                                                                        <Popover id={`popover-${region}`}>
                                                                                            <Popover.Body>
                                                                                                {formData2Ens.genomic_regions[region as keyof typeof formData2Ens.genomic_regions].comment}
                                                                                            </Popover.Body>
                                                                                        </Popover>
                                                                                    }
                                                                                >
                                                                                    <InfoCircle
                                                                                        style={{
                                                                                            fontSize: "1.2rem",
                                                                                            cursor: "pointer",
                                                                                            color: "#0d6efd",
                                                                                        }}
                                                                                    />
                                                                                </OverlayTrigger>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                            </form>
                                                        </div>
                                                    )}
                                                </div>


                                            </div>
                                        </div>

                                    </>
                                )}
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="probe_length_min.value" className="form-label">Min Probe Length:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_length_min.value"
                                               name="target_probe_length_min"
                                               value={formData.target_probe_length_min.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="probe_length_min">
                                                    <Popover.Body>
                                                        {formData.target_probe_length_min.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col">
                                    <label htmlFor="probe_length_max" className="form-label">Max Probe Length:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_length_max"
                                               name="target_probe_length_max"
                                               value={formData.target_probe_length_max.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="probe_length_max">
                                                    <Popover.Body>
                                                        {formData.target_probe_length_max.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col">
                                    <label htmlFor="probe_isoform_consensus" className="form-label">Isoform Consensus
                                        (%):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_isoform_consensus"
                                               name="target_probe_isoform_consensus"
                                               value={formData.target_probe_isoform_consensus.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="probe_isoform_consensus">
                                                    <Popover.Body>
                                                        {formData.target_probe_isoform_consensus.comment}


                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                            </div>
    
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="probe_GC_content_min" className="form-label">Min GC Content
                                        (%):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_GC_content_min"
                                               name="target_probe_GC_content_min"
                                               value={formData.target_probe_GC_content_min.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="probe_GC_content_min">

                                                    <Popover.Body>
                                                        {formData.target_probe_GC_content_min.comment}


                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col">
                                    <label htmlFor="probe_GC_content_opt" className="form-label">Optimal GC Content
                                        (%):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_GC_content_opt"
                                               name="target_probe_GC_content_min"
                                               value={formData.target_probe_GC_content_min.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="probe_GC_content_opt">
                                                    <Popover.Body>
                                                        {formData.target_probe_GC_content_min.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="probe_GC_content_max" className="form-label">Max GC Content
                                        (%):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_GC_content_max"
                                               name="target_probe_GC_content_max"
                                               value={formData.target_probe_GC_content_max.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-probe_GC_content_max">
                                                    <Popover.Body>
                                                        {formData.target_probe_GC_content_max.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="probe_Tm_min" className="form-label">Min Tm (°C):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_Tm_min"
                                               name="target_probe_Tm_min"
                                               value={formData.target_probe_Tm_min.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-probe_Tm_min">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_min.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="probe_Tm_max" className="form-label">Max Tm (°C):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_Tm_max"
                                               name="target_probe_Tm_max"
                                               value={formData.target_probe_Tm_max.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-target_probe_Tm_max">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_max.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>


                                </div>
                                <div className="col">
                                    <label htmlFor="probe_Tm_opt" className="form-label">Opt Tm (°C):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_Tm_opt"
                                               name="target_probe_Tm_opt"
                                               value={formData.target_probe_Tm_opt.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_opt.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
    
                                </div>
    
                            </div>
    
                            <h6 className="pt-2">Homopolymeric run per
                                base </h6>
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="homopolymeric_A" className="form-label">A:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="homopolymeric_A"
                                               name="target_probe_homopolymeric_base_n.A"
                                               value={formData.target_probe_homopolymeric_base_n.A.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_homopolymeric_base_n.A.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="homopolymeric_T" className="form-label">T:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="homopolymeric_T"
                                               name="target_probe_homopolymeric_base_n.T"
                                               value={formData.target_probe_homopolymeric_base_n.T.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_homopolymeric_base_n.T.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="homopolymeric_C" className="form-label">C:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="homopolymeric_C"
                                               name="target_probe_homopolymeric_base_n.C"
                                               value={formData.target_probe_homopolymeric_base_n.C.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_homopolymeric_base_n.C.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="homopolymeric_G" className="form-label">G:</label>
                                    <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="homopolymeric_G"
                                               name="target_probe_homopolymeric_base_n.G"
                                               value={formData.target_probe_homopolymeric_base_n.G.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_homopolymeric_base_n.G.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                            </div>
    
                            <div className="mb-3">
                                <label htmlFor="arm_Tm_dif_max" className="form-label">Max Tm Difference Between
                                    Arms:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="arm_Tm_dif_max"
                                           name="target_probe_padlock_arm_Tm_dif_max"
                                           value={formData.target_probe_padlock_arm_Tm_dif_max.value} onChange={handleChange}/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {formData.target_probe_padlock_arm_Tm_dif_max.comment}
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px"
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
    
                            </div>
                            <div className="row g-3">

                                <div className="col">
                                    <label htmlFor="arm_length_min" className="form-label">Min Arm Length:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="arm_length_min"
                                               name="target_probe_padlock_arm_length_min"
                                               value={formData.target_probe_padlock_arm_length_min.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_padlock_arm_length_min.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="arm_Tm_min" className="form-label">Min Arm Tm:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="arm_Tm_min" name="target_probe_padlock_arm_Tm_min"
                                               value={formData.target_probe_padlock_arm_Tm_min.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_padlock_arm_Tm_min.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="arm_Tm_max" className="form-label">Max Arm Tm:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="arm_Tm_max" name="target_probe_padlock_arm_Tm_dif_max"
                                               value={formData.target_probe_padlock_arm_Tm_dif_max.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_padlock_arm_Tm_dif_max.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
    
                            </div>
                            <div className="mb-3">
                                <label htmlFor="ligation_region_size" className="form-label">Litigation Region
                                    Size:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="target_probe_ligation_region_size"
                                           name="target_probe_ligation_region_size"
                                           value={formData.target_probe_ligation_region_size.value} onChange={handleChange}/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {formData.target_probe_ligation_region_size.comment}
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px"
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
    
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="probe_isoform_weight" className="form-label">Probe Isoform
                                        Weight:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="probe_isoform_weight"
                                               name="target_probe_isoform_weight"
                                               value={formData.target_probe_isoform_weight.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_isoform_weight.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>

                                <label htmlFor="probe_GC_weight" className="form-label">GC Content Weight:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probe_GC_weight"
                                           name="target_probe_GC_weight"
                                           value={formData.target_probe_GC_weight.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {formData.target_probe_GC_weight.comment}
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px"
                                            }}
                                                />
                                            </OverlayTrigger>
                                        </div>

                                    <div className="col">
                                        <label htmlFor="probe_Tm_weight" className="form-label">Tm Weight:</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="probe_Tm_weight"
                                                   name="target_probe_Tm_weight"
                                                   value={formData.target_probe_Tm_weight.value} onChange={handleChange} required/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-n_jobs">
                                                        <Popover.Body>
                                                            {formData.target_probe_Tm_weight.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle
                                                    style={{
                                                        fontSize: "1.2rem",
                                                        cursor: "pointer",
                                                        color: "#0d6efd",
                                                        marginLeft: "10px"
                                                    }}
                                                />
                                            </OverlayTrigger>
                                        </div>
    

                            </div>
                            <div className="row g-3">

                                <div className="col">
                                    <label htmlFor="probeset_size_min" className="form-label">Minimum Probe Set
                                        Size:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="set_size_min"
                                               name="set_size_min"
                                               value={formData.set_size_min.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.set_size_opt.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="probeset_size_opt" className="form-label">Optimal Probe Set
                                        Size:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="set_size_opt"
                                               name="set_size_opt"
                                               value={formData.set_size_opt.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.set_size_opt.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="distance_between_probes" className="form-label">Distance Between
                                        Probes:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="distance_between_target_probes"
                                               name="distance_between_target_probes"
                                               value={formData.distance_between_target_probes.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.distance_between_target_probes.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="n_sets" className="form-label">Maximum Number of Sets:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="n_sets" name="n_sets"
                                               value={formData.n_sets.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.n_sets.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                                </div>
                            </div>
                        </div>
                    );

                case 'genomic_region':
                    return ( <div>


                        </div>


                    );
                case 'genomic_region_for_reference':
                    return ( <div>

                        </div>


                    );
                case 'detection_oligos':
                    return (
                        <div>
    
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="min_thymines" className="form-label">Min Thymines:</label>

                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="min_thymines"
                                               name="detection_oligo_min_thymines"
                                               value={formData.detection_oligo_min_thymines.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.detection_oligo_min_thymines.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="detect_oligo_length_min" className="form-label">Min Length
                                        (bp):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="detection_oligo_length_min"
                                               name="detection_oligo_length_min"
                                               value={formData.detection_oligo_length_min.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.detection_oligo_length_min.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="detect_oligo_length_max" className="form-label">Max Length
                                        (bp):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="detection_oligo_length_max"
                                               name="detection_oligo_length_max"
                                               value={formData.detection_oligo_length_max.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.detection_oligo_length_max.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="detection_oligo_U_distance" className="form-label">Preferred U
                                        Distance:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="detection_oligo_U_distance"
                                               name="detection_oligo_U_distance"
                                               value={formData.detection_oligo_U_distance.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.detection_oligo_U_distance.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col">
                                    <label htmlFor="detect_oligo_Tm_opt" className="form-label">Optimal Detection Oligo
                                        Tm (°C):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="detection_oligo_Tm_opt"
                                               name="detection_oligo_Tm_opt"
                                               value={formData.detection_oligo_Tm_opt.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.detection_oligo_Tm_opt.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                            </div>
    
    
                        </div>
                    );

    
                // Add cases for other tabs
                default:
                    return null;
            }
        };
        const renderTabContent2 = () => {
            switch (activetab2) {
                case "specfblastn":
                    return (
                        <div>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="specificity_perc_identity" className="form-label">Percent
                                        Identity:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_specificity_blastn_search_parameters.perc_identity"
                                               name="target_probe_specificity_blastn_search_parameters.perc_identity"
                                               value={formData.target_probe_specificity_blastn_search_parameters.perc_identity.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_specificity_blastn_search_parameters.perc_identity.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="specificity_strand" className="form-label">Strand</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_specificity_blastn_search_parameters.strand"
                                               name="target_probe_specificity_blastn_search_parameters.strand"
                                               value={formData.target_probe_specificity_blastn_search_parameters.strand.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_specificity_blastn_search_parameters.strand.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="specificity_word_size" className="form-label">Word
                                        Size:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_specificity_blastn_search_parameters.word_size."
                                               name="target_probe_specificity_blastn_search_parameters.word_size."
                                               value={formData.target_probe_specificity_blastn_search_parameters.word_size.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_specificity_blastn_search_parameters.word_size.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="specificity_dust" className="form-label">Dust:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_specificity_blastn_search_parameters.dust"
                                               name="target_probe_specificity_blastn_search_parameters.dust"
                                               value={formData.target_probe_specificity_blastn_search_parameters.dust.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_specificity_blastn_search_parameters.dust.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="specificity_soft_masking" className="form-label">Soft
                                        Masking:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_specificity_blastn_search_parameters.soft_masking"
                                               name="target_probe_specificity_blastn_search_parameters.soft_masking"
                                               value={formData.target_probe_specificity_blastn_search_parameters.soft_masking.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_specificity_blastn_search_parameters.soft_masking.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="specificity_max_target_seqs" className="form-label">Max
                                        Target Sequences:</label>
                                    <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                               id="target_probe_specificity_blastn_search_parameters.max_target_seqs" name="target_probe_specificity_blastn_search_parameters.max_target_seqs"
                                               value={formData.target_probe_specificity_blastn_search_parameters.max_target_seqs.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_specificity_blastn_search_parameters.max_target_seqs.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="specificity_max_hsps" className="form-label">Max
                                        HSPs:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_specificity_blastn_search_parameters.max_hsps"
                                               name="target_probe_specificity_blastn_search_parameters.max_hsps"
                                               value={formData.target_probe_specificity_blastn_search_parameters.max_hsps.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_specificity_blastn_search_parameters.max_hsps.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="specificity_coverage" className="form-label">Coverage:
                                        (Specificity_blastn_hit_parameter)</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_cross_hybridization_blastn_hit_parameters.coverage"
                                               name="target_probe_cross_hybridization_blastn_hit_parameters.coverage"
                                               value={formData.target_probe_cross_hybridization_blastn_hit_parameters.coverage.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_cross_hybridization_blastn_hit_parameters.coverage.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                            </div>
                        </div>
                    );
                case 'crossfilterblastn':
                    return (
                        <div>
    
                            <h5>Cross-Hybridization Filters with BlastN</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="crosshybridization_perc_identity" className="form-label">Percent
                                        Identity:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control"
                                               id="target_probe_cross_hybridization_blastn_search_parameters.perc_identity"
                                               name="target_probe_cross_hybridization_blastn_search_parameters.perc_identity"
                                               value={formData.target_probe_cross_hybridization_blastn_search_parameters.perc_identity.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_cross_hybridization_blastn_search_parameters.perc_identity.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="crosshybridization_strand"
                                           className="form-label">Strand:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_cross_hybridization_blastn_search_parameters.strand"
                                               name="target_probe_cross_hybridization_blastn_search_parameters.strand"
                                               value={formData.target_probe_cross_hybridization_blastn_search_parameters.strand.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_cross_hybridization_blastn_search_parameters.strand.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="crosshybridization_word_size" className="form-label">Word
                                        Size:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control"
                                               id="target_probe_cross_hybridization_blastn_search_parameters.word_size" name="target_probe_cross_hybridization_blastn_search_parameters.word_size"
                                               value={formData.target_probe_cross_hybridization_blastn_search_parameters.word_size.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_cross_hybridization_blastn_search_parameters.word_size.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="crosshybridization_dust"
                                           className="form-label">Dust:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_cross_hybridization_blastn_search_parameters.dust"
                                               name="target_probe_cross_hybridization_blastn_search_parameters.dust"
                                               value={formData.target_probe_cross_hybridization_blastn_search_parameters.dust.value}
                                               onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_cross_hybridization_blastn_search_parameters.dust.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="crosshybridization_soft_masking" className="form-label">Soft
                                        Masking:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control"
                                               id="target_probe_cross_hybridization_blastn_search_parameters.soft_masking"
                                               name="target_probe_cross_hybridization_blastn_search_parameters.soft_masking"
                                               value={formData.target_probe_cross_hybridization_blastn_search_parameters.soft_masking.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_cross_hybridization_blastn_search_parameters.soft_masking.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="crosshybridization_max_target_seqs" className="form-label">Max
                                        Target Sequences:</label>
                                    <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                               id="target_probe_cross_hybridization_blastn_search_parameters.max_target_seqs"
                                               name="target_probe_cross_hybridization_blastn_search_parameters.max_target_seqs"
                                               value={formData.target_probe_cross_hybridization_blastn_search_parameters.max_target_seqs.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_cross_hybridization_blastn_search_parameters.max_target_seqs.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="crosshybridization_coverage"
                                           className="form-label">Coverage:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control"
                                               id="target_probe_cross_hybridization_blastn_hit_parameters.coverage" name="target_probe_cross_hybridization_blastn_hit_parameters.coverage"
                                               value={formData.target_probe_cross_hybridization_blastn_hit_parameters.coverage.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_cross_hybridization_blastn_hit_parameters.coverage.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                            </div>
    
                        </div>
                    );
                case'oligosetselection':
                    return (
                        <div>
                            <h5>Oligo Set Selection</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="max_graph_size" className="form-label">Max Graph
                                        Size:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="max_graph_size"
                                               name="max_graph_size"
                                               value={formData.max_graph_size.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.max_graph_size.comment}

                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="n_attempts" className="form-label">Number of
                                        Attempts:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="n_attempts"
                                               name="n_attempts"
                                               value={formData.n_attempts.value} onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.n_attempts.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="heuristic" className="form-label">Heuristic:</label>
                                    <div className="d-flex align-items-center">
                                        <select className="form-control" id="heuristic" name="heuristic"
                                                value={formData.heuristic.value} onChange={handleChange}>
                                            <option value="true">True</option>
                                            <option value="false">False</option>
                                        </select>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.heuristic.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
    
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="heuristic_n_attempts" className="form-label"> Heuristics number of
                                        Attempts:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="n_attempts"
                                               name="heuristic_n_attempts"
                                               value={formData.heuristic_n_attempts.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.heuristic_n_attempts.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>

                                </div>
                            </div>

                        </div>
                    );
                case'meltingtemp':
                    return (
                        <div>
                            <div className="d-flex align-items-center">
                                <h4>Melting Temperature Parameters</h4>
                            </div>

                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_nn_table" className="form-label">Nearest Neighbor Table:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_Tm_parameters.nn_table"
                                               name="target_probe_Tm_parameters.nn_table"
                                               value={formData.target_probe_Tm_parameters.nn_table.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-nn-table">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.nn_table.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_tmm_table" className="form-label">TMM Table:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_Tm_parameters.tmm_table"
                                               name="target_probe_Tm_parameters.tmm_table"
                                               value={formData.target_probe_Tm_parameters.tmm_table.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-tmm-table">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.tmm_table.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_imm_table" className="form-label">IMM Table:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_Tm_parameters.imm_table"
                                               name="target_probe_Tm_parameters.imm_table"
                                               value={formData.target_probe_Tm_parameters.imm_table.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-imm-table">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.imm_table.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="DE_probe_imm_table" className="form-label">DE Table:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_Tm_parameters.de_table"
                                               name="target_probe_Tm_parameters.de_table"
                                               value={formData.target_probe_Tm_parameters.de_table.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-de-table">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.de_table.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_dnac1" className="form-label">DNA Concentration 1 (nM):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.dnac1"
                                               name="target_probe_Tm_parameters.dnac1"
                                               value={formData.target_probe_Tm_parameters.dnac1.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dnac1">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.dnac1.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_dnac2" className="form-label">DNA Concentration 2 (nM):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.dnac2"
                                               name="target_probe_Tm_parameters.dnac2"
                                               value={formData.target_probe_Tm_parameters.dnac2.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dnac2">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.dnac2.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_saltcorr" className="form-label">Salt Correction:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.saltcorr"
                                               name="target_probe_Tm_parameters.saltcorr"
                                               value={formData.target_probe_Tm_parameters.saltcorr.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-saltcorr">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.saltcorr.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_Na" className="form-label">Na Concentration (mM):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.Na"
                                               name="target_probe_Tm_parameters.Na"
                                               value={formData.target_probe_Tm_parameters.Na.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-na">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.Na.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_K" className="form-label">K Concentration (mM):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.K"
                                               name="target_probe_Tm_parameters.K"
                                               value={formData.target_probe_Tm_parameters.K.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-k">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.K.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_Tris" className="form-label">Tris Concentration (mM):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.Tris"
                                               name="target_probe_Tm_parameters.Tris"
                                               value={formData.target_probe_Tm_parameters.Tris.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-tris">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.Tris.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_Mg" className="form-label">Mg Concentration (mM):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.Mg"
                                               name="target_probe_Tm_parameters.Mg"
                                               value={formData.target_probe_Tm_parameters.Mg.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-mg">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.Mg.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_dNTPs" className="form-label">dNTPs Concentration (mM):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.dNTPs"
                                               name="target_probe_Tm_parameters.dNTPs"
                                               value={formData.target_probe_Tm_parameters.dNTPs.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dntps">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.dNTPs.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                            </div>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_DMSO" className="form-label">DMSO (%):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_chem_correction_parameters.DMSO"
                                               name="target_probe_Tm_chem_correction_parameters.DMSO"
                                               value={formData.target_probe_Tm_chem_correction_parameters.DMSO.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dmso">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_chem_correction_parameters.DMSO.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_fmd" className="form-label">Formamide (fmd, %):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_chem_correction_parameters.fmd"
                                               name="target_probe_Tm_chem_correction_parameters.fmd"
                                               value={formData.target_probe_Tm_chem_correction_parameters.fmd.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-fmd">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_chem_correction_parameters.fmd.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_DMSOfactor" className="form-label">DMSO Factor:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control"
                                               id="target_probe_Tm_chem_correction_parameters.DMSOfactor" name="target_probe_Tm_chem_correction_parameters.DMSOfactor"
                                               value={formData.target_probe_Tm_chem_correction_parameters.DMSOfactor.value} step="0.01"
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dmso-factor">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_chem_correction_parameters.DMSOfactor.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_fmdfactor" className="form-label">Formamide Factor:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control"
                                               id="target_probe_Tm_chem_correction_parameters.fmdfactor" name="target_probe_Tm_chem_correction_parameters.fmdfactor"
                                               value={formData.target_probe_Tm_chem_correction_parameters.fmdfactor.value} step="0.01"
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-fmd-factor">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_chem_correction_parameters.fmdfactor.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_fmdmethod" className="form-label">Formamide Method:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control"
                                               id="target_probe_Tm_chem_correction_parameters.fmdmethod" name="target_probe_Tm_chem_correction_parameters.fmdmethod"
                                               value={formData.target_probe_Tm_chem_correction_parameters.fmdmethod.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-fmd-method">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_chem_correction_parameters.fmdmethod.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_GC" className="form-label">GC (optional):</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_Tm_chem_correction_parameters.GC"
                                               name="target_probe_Tm_chem_correction_parameters.GC"
                                               value={formData.target_probe_Tm_chem_correction_parameters.GC.value}
                                               onChange={handleChange}
                                               placeholder="null"/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-gc">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_chem_correction_parameters.GC.comment}
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px"
                                            }}/>
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>

                        </div>
                    );
                case 'chemcorr':
                    return (
                        <div>
                            <div className="mb-4">
                                <div className="d-flex align-items-center">
                                    <h5>Melting Temperature Parameters for Detection Oligo</h5>
                                </div>
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_nn_table" className="form-label">Nearest Neighbor
                                            Table:</label>
                                        <div className="d-flex align-items-center">
                                            <input type="text" className="form-control" id="detection_oligo_Tm_parameters.nn_table"
                                                   name="detection_oligo_Tm_parameters.nn_table"
                                                   value={formData.detection_oligo_Tm_parameters.nn_table.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-nn-table-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.nn_table.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_tmm_table" className="form-label">TMM
                                            Table:</label>
                                        <div className="d-flex align-items-center">
                                            <input type="text" className="form-control" id="detection_oligo_Tm_parameters.tmm_table"
                                                   name="detection_oligo_Tm_parameters.tmm_table"
                                                   value={formData.detection_oligo_Tm_parameters.tmm_table.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-tmm-table-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.tmm_table.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_imm_table" className="form-label">IMM
                                            Table:</label>
                                        <div className="d-flex align-items-center">
                                            <input type="text" className="form-control" id="detection_oligo_Tm_parameters.imm_table"
                                                   name="detection_oligo_Tm_parameters.imm_table"
                                                   value={formData.detection_oligo_Tm_parameters.imm_table.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-imm-table-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.imm_table.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_de_table" className="form-label">DE Table:</label>
                                        <div className="d-flex align-items-center">
                                            <input type="text" className="form-control" id="detection_oligo_Tm_parameters.de_table"
                                                   name="detection_oligo_Tm_parameters.de_table"
                                                   value={formData.detection_oligo_Tm_parameters.de_table.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-de-table-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.de_table.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_dnac1" className="form-label">DNA Concentration 1
                                            (nM):</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="detection_oligo_Tm_parameters.dnac1"
                                                   name="detection_oligo_Tm_parameters.dnac1"
                                                   value={formData.detection_oligo_Tm_parameters.dnac1.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-dnac1-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.dnac1.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_dnac2" className="form-label">DNA Concentration 2
                                            (nM):</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="detection_oligo_Tm_parameters.dnac2"
                                                   name="detection_oligo_Tm_parameters.dnac2"
                                                   value={formData.detection_oligo_Tm_parameters.dnac2.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-dnac2-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.dnac2.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_saltcorr" className="form-label">Salt
                                            Correction:</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="detection_oligo_Tm_parameters.saltcorr"
                                                   name="detection_oligo_Tm_parameters.saltcorr"
                                                   value={formData.detection_oligo_Tm_parameters.saltcorr.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-saltcorr-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.saltcorr.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_Na" className="form-label">Na Concentration
                                            (mM):</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="detection_oligo_Tm_parameters.Na"
                                                   name="detection_oligo_Tm_parameters.Na"
                                                   value={formData.detection_oligo_Tm_parameters.Na.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-na-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.Na.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_K" className="form-label">K Concentration (mM):</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="detection_oligo_Tm_parameters.K"
                                                   name="detection_oligo_Tm_parameters.K"
                                                   value={formData.detection_oligo_Tm_parameters.K.value}
                                                   onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-k-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.K.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_Tris" className="form-label">Tris Concentration (mM):</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="detection_oligo_Tm_parameters.Tris"
                                                   name="detection_oligo_Tm_parameters.Tris"
                                                   value={formData.detection_oligo_Tm_parameters.Tris.value} onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-tris-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.Tris.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_Mg" className="form-label">Mg Concentration (mM):</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="detection_oligo_Tm_parameters.Mg"
                                                   name="detection_oligo_Tm_parameters.Mg"
                                                   value={formData.detection_oligo_Tm_parameters.Mg.value} onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-mg-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.Mg.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_dNTPs" className="form-label">dNTPs Concentration (mM):</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="detection_oligo_Tm_parameters.dNTPs"
                                                   name="detection_oligo_Tm_parameters.dNTPs"
                                                   value={formData.detection_oligo_Tm_parameters.dNTPs.value} onChange={handleChange}/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-dntps-detection">
                                                        <Popover.Body>
                                                            {formData.detection_oligo_Tm_parameters.dNTPs.comment}
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                            </OverlayTrigger>
                                        </div>
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <div className="d-flex align-items-center">
                                        <h5>Chemical Correction Parameters for Detection Oligo</h5>
                                    </div>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label htmlFor="Tm_detection_DMSO" className="form-label">DMSO (%):</label>
                                            <div className="d-flex align-items-center">
                                                <input type="number" className="form-control" id="detection_oligo_Tm_chem_correction_parameters.DMSO"
                                                       name="detection_oligo_Tm_chem_correction_parameters.DMSO"
                                                       value={formData.detection_oligo_Tm_chem_correction_parameters.DMSO.value} onChange={handleChange}/>
                                                <OverlayTrigger
                                                    trigger="hover"
                                                    placement="top"
                                                    overlay={
                                                        <Popover id="popover-dmso-detection">
                                                            <Popover.Body>
                                                                {formData.detection_oligo_Tm_chem_correction_parameters.DMSO.comment}
                                                            </Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                                </OverlayTrigger>
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <label htmlFor="Tm_detection_fmd" className="form-label">Formamide (fmd,
                                                %):</label>
                                            <div className="d-flex align-items-center">
                                                <input type="number" className="form-control" id="detection_oligo_Tm_chem_correction_parameters.fmd"
                                                       name="detection_oligo_Tm_chem_correction_parameters.fmd"
                                                       value={formData.detection_oligo_Tm_chem_correction_parameters.fmd.value}
                                                       onChange={handleChange}/>
                                                <OverlayTrigger
                                                    trigger="hover"
                                                    placement="top"
                                                    overlay={
                                                        <Popover id="popover-fmd-detection">
                                                            <Popover.Body>
                                                                {formData.detection_oligo_Tm_chem_correction_parameters.fmd.comment}
                                                            </Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <InfoCircle style={{
                                                        fontSize: "1.2rem",
                                                        cursor: "pointer",
                                                        color: "#0d6efd",
                                                        marginLeft: "10px"
                                                    }}/>
                                                </OverlayTrigger>
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <label htmlFor="Tm_detection_DMSOfactor" className="form-label">DMSO
                                                Factor:</label>
                                            <div className="d-flex align-items-center">
                                                <input type="number" className="form-control"
                                                       id="detection_oligo_Tm_chem_correction_parameters.DMSOfactor" name="detection_oligo_Tm_chem_correction_parameters.DMSOfactor"
                                                       value={formData.detection_oligo_Tm_chem_correction_parameters.DMSOfactor.value}
                                                       step="0.01"
                                                       onChange={handleChange}/>
                                                <OverlayTrigger
                                                    trigger="hover"
                                                    placement="top"
                                                    overlay={
                                                        <Popover id="popover-dmso-factor-detection">
                                                            <Popover.Body>
                                                                {formData.detection_oligo_Tm_chem_correction_parameters.DMSOfactor.comment}
                                                            </Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <InfoCircle style={{
                                                        fontSize: "1.2rem",
                                                        cursor: "pointer",
                                                        color: "#0d6efd",
                                                        marginLeft: "10px"
                                                    }}/>
                                                </OverlayTrigger>
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <label htmlFor="Tm_detection_fmdfactor" className="form-label">Formamide
                                                Factor:</label>
                                            <div className="d-flex align-items-center">
                                                <input type="number" className="form-control"
                                                       id="detection_oligo_Tm_chem_correction_parameters.fmdfactor" name="detection_oligo_Tm_chem_correction_parameters.fmdfactor"
                                                       value={formData.detection_oligo_Tm_chem_correction_parameters.fmdfactor.value}
                                                       step="0.01"
                                                       onChange={handleChange}/>
                                                <OverlayTrigger
                                                    trigger="hover"
                                                    placement="top"
                                                    overlay={
                                                        <Popover id="popover-fmd-factor-detection">
                                                            <Popover.Body>
                                                                {formData.detection_oligo_Tm_chem_correction_parameters.fmdfactor.comment}
                                                            </Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <InfoCircle style={{
                                                        fontSize: "1.2rem",
                                                        cursor: "pointer",
                                                        color: "#0d6efd",
                                                        marginLeft: "10px"
                                                    }}/>
                                                </OverlayTrigger>
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <label htmlFor="Tm_detection_fmdmethod" className="form-label">Formamide
                                                Method:</label>
                                            <div className="d-flex align-items-center">
                                                <input type="number" className="form-control"
                                                       id="detection_oligo_Tm_chem_correction_parameters.fmdmethod" name="detection_oligo_Tm_chem_correction_parameters.fmdmethod"
                                                       value={formData.detection_oligo_Tm_chem_correction_parameters.fmdmethod.value}
                                                       onChange={handleChange}/>
                                                <OverlayTrigger
                                                    trigger="hover"
                                                    placement="top"
                                                    overlay={
                                                        <Popover id="popover-fmd-method-detection">
                                                            <Popover.Body>
                                                                {formData.detection_oligo_Tm_chem_correction_parameters.fmdmethod.comment}
                                                            </Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                                </OverlayTrigger>
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <label htmlFor="Tm_detection_GC" className="form-label">GC (optional):</label>
                                            <div className="d-flex align-items-center">
                                                <input type="text" className="form-control" id="detection_oligo_Tm_chem_correction_parameters.GC"
                                                       name="detection_oligo_Tm_chem_correction_parameters.GC"
                                                       value={formData.detection_oligo_Tm_chem_correction_parameters.GC.value} onChange={handleChange}
                                                       placeholder="null"/>
                                                <OverlayTrigger
                                                    trigger="hover"
                                                    placement="top"
                                                    overlay={
                                                        <Popover id="popover-gc-detection">
                                                            <Popover.Body>
                                                                {formData.detection_oligo_Tm_chem_correction_parameters.GC.comment}
                                                            </Popover.Body>
                                                        </Popover>
                                                    }
                                                >
                                                    <InfoCircle style={{ fontSize: "1.2rem", cursor: "pointer", color: "#0d6efd", marginLeft: "10px" }}/>
                                                </OverlayTrigger>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    );

                // Add cases for other tabs
                default:
                    return null;
            }
        };
        const handleChangeGenomic = (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

            if (selectedSource === 'ncbi') {
                setFormDataNcbi(prev => updateFormData(prev));
            } else if (selectedSource === 'ensembl') {
                setFormDataEns(prev => updateFormData(prev));
            } else if (selectedSource === 'custom') {
                setFormDataCustom(prev => updateFormData(prev));
            }
        };
        const handleChangeGenomicReference = (
            e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

            if (selectedSource === 'ncbi') {
                setFormData2Ncbi(prev => updateFormData(prev));
            } else if (selectedSource === 'ensembl') {
                setFormData2Ens(prev => updateFormData(prev));
            } else if (selectedSource === 'custom') {
                setFormData2Custom(prev => updateFormData(prev));
            }
        };

        // Handle input changes
        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            const { name, value } = e.target;
            const keys = name.split(".");

            if (keys.length === 2) {
                const [parent, child] = keys;
                setFormData(prev => ({
                    ...prev,
                    [parent]: {
                        ...(prev as any)[parent],
                        [child]: {
                            ...((prev as any)[parent]?.[child]),
                            value
                        }
                    }
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    [name]: {
                        ...(prev as any)[name],
                        value
                    }
                }));
            }
        };

        // Handle form submission
        const handleSubmitGenomic = async (e?: React.FormEvent): Promise<any | null> => {
            e?.preventDefault();
            let finalFormData;

            try {
                if (selectedSource === 'ncbi') {
                    finalFormData = formDataNcbi;
                } else if (selectedSource === 'ensembl') {
                    finalFormData = formDataEns;
                } else if (selectedSource === 'custom') {
                    if (!areAllFilesUploaded()) {
                        alert('Please upload all required files before submitting.');
                        setLoading(false);
                        return null;
                    }

                    const uploadedPaths = await uploadFiles();
                    finalFormData = { ...formDataCustom };

                    for (const key in uploadedPaths) {
                        if (finalFormData[key]) {
                            // @ts-ignore
                            finalFormData[key] = {
                                value: uploadedPaths[key],
                                // @ts-ignore
                                comment: finalFormData[key].comment,
                            };
                        } else {
                            // @ts-ignore
                            finalFormData[key] = {
                                value: uploadedPaths[key],
                                comment: "",
                            };
                        }
                    }
                }

                const response = await axios.post(
                    `http://localhost:5000/api/genomic/${selectedSource}`,
                    finalFormData,
                    {
                        withCredentials: true,
                        headers: { "Content-Type": "application/json" },
                    }
                );

                alert('Form submitted successfully!');
                return response.data.output;

            } catch (error) {
                console.error('Error submitting genomic form:', error);
                alert('Error submitting genomic form. Please try again.');
                return null;
            } finally {
                setLoading(false);
            }
        };
        const handleSubmitGenomicref = async (e?: React.FormEvent): Promise<any | null> => {
            e?.preventDefault();
            let finalFormData;

            try {
                if (selectedSource === 'ncbi') {
                    finalFormData = formData2Ncbi;
                } else if (selectedSource === 'ensembl') {
                    finalFormData = formData2Ens;
                } else if (selectedSource === 'custom') {
                    if (!areAllFilesUploaded()) {
                        alert('Please upload all required files before submitting.');
                        setLoading(false);
                        return null;
                    }

                    const uploadedPaths = await uploadFiles();
                    finalFormData = { ...formData2Custom };

                    for (const key in uploadedPaths) {
                        if (finalFormData[key]) {
                            // @ts-ignore
                            finalFormData[key] = {
                                value: uploadedPaths[key],
                                // @ts-ignore
                                comment: finalFormData[key].comment,
                            };
                        } else {
                            // @ts-ignore
                            finalFormData[key] = {
                                value: uploadedPaths[key],
                                comment: "",
                            };
                        }
                    }
                }

                const response = await axios.post(
                    `http://localhost:5000/api/genomic/${selectedSource}`,
                    finalFormData,
                    {
                        withCredentials: true,
                        headers: { "Content-Type": "application/json" },
                    }
                );

                alert('Form submitted successfully!');
                return response.data.output;

            } catch (error) {
                console.error('Error submitting genomic form:', error);
                alert('Error submitting genomic form. Please try again.');
                return null;
            } finally {
                setLoading(false);
            }
        };
        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setLoading(true);

 
            // First: submit genomic
            if (generateFastaFiles) {
                formData['files_fasta_target_probe_database']['value'] = await handleSubmitGenomic();
                formData['files_fasta_reference_database_targe_probe']['value'] = await handleSubmitGenomicref();

            }

            // Then: handle scrinshot
            if (!areAllFilesUploaded()) {
                alert('Please upload all required files before submitting.');
                setLoading(false);
                return;
            }

            try {
                const uploadedPaths = await uploadFiles();
                const finalFormData = { ...formData };

                for (const key in uploadedPaths) {
                    // @ts-ignore
                    if (finalFormData[key]) {
                        // @ts-ignore
                        finalFormData[key] = {
                            value: uploadedPaths[key],
                            // @ts-ignore
                            comment: finalFormData[key].comment,
                        };
                    } else {
                        // @ts-ignore
                        finalFormData[key] = {
                            value: uploadedPaths[key],
                            comment: "",
                        };
                    }
                }

                const response = await axios.post('http://localhost:5000/api/scrinshot', finalFormData, {
                    withCredentials: true,
                    headers: { "Content-Type": "application/json" },
                });
                const result = response.data;
                console.log(result,'this is the result');

                setStatus("running");
                alert(`Your RunID is: ${result.run_id}, you can paste it to run`);
            } catch (error) {
                console.error('Error submitting scrinshot form:', error);
                alert('Error submitting scrinshot form. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        return (<div>
                <Navbar/>
                <div className="container my-4">
                    <form onSubmit={handleSubmit} id="scrinshotForm">
                        <h2 className="text-center mb-4">Scrinshot Probe Designer</h2>
                        <ul className="nav nav-tabs">

                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link ${activeTab === "general" ? "active" : ""}`}
                                    onClick={() => setActiveTab("general")}
                                >
                                    General Parameters
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link ${activeTab === "probe_sequences" ? "active" : ""}`}
                                    onClick={() => setActiveTab("probe_sequences")}
                                >
                                    Target Probe Parameters
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link ${activeTab === "detection_oligos" ? "active" : ""}`}
                                    onClick={() => setActiveTab("detection_oligos")}
                                >
                                    Detection Oligo Parameters
                                </button>
                            </li>


                        </ul>


                        {/* Tab Content */}
                        <div className="tab-content mt-4">
                            {renderTabContent()}
                        </div>
                        <div className="mt-5">
                            <div className="d-flex align-items-center">
                                <h3 className="me-3">Developer Settings</h3>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={toggleDeveloperSettings}
                                >
                                    {showDeveloperSettings ? "Hide" : "Show"}
                                </button>
                            </div>

                            {showDeveloperSettings && (
                                <>
                                    <ul className="nav nav-tabs mt-3">
                                        <li className="nav-item">
                                            <button
                                                type="button"
                                                className={`nav-link ${activetab2 === "specfblastn" ? "active" : ""}`}
                                                onClick={() => setActivetab2("specfblastn")}
                                            >
                                                Specificity Filters BlastN
                                            </button>
                                        </li>
                                        <li className="nav-item">
                                            <button
                                                type="button"
                                                className={`nav-link ${activetab2 === "crossfilterblastn" ? "active" : ""}`}
                                                onClick={() => setActivetab2("crossfilterblastn")}
                                            >
                                                Cross-hybrid filters BlastN
                                            </button>
                                        </li>
                                        <li className="nav-item">
                                            <button
                                                type="button"
                                                className={`nav-link ${activetab2 === "oligosetselection" ? "active" : ""}`}
                                                onClick={() => setActivetab2("oligosetselection")}
                                            >
                                                Oligo Set Selection Parameters
                                            </button>
                                        </li>
                                        <li className="nav-item">
                                            <button
                                                type="button"
                                                className={`nav-link ${activetab2 === "meltingtemp" ? "active" : ""}`}
                                                onClick={() => setActivetab2("meltingtemp")}
                                            >
                                                Parameters for Melting Temperature
                                            </button>
                                        </li>
                                        <li className="nav-item">
                                            <button
                                                type="button"
                                                className={`nav-link ${activetab2 === "chemcorr" ? "active" : ""}`}
                                                onClick={() => setActivetab2("chemcorr")}
                                            >
                                                Detection Oligo Parameters
                                            </button>
                                        </li>
                                    </ul>

                                    <div className="tab-content mt-4">
                                        {renderTabContent2()}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="container my-4">
                            {!areAllFilesUploaded() && (
                                <div className="alert alert-warning mt-3">
                                    Please upload all required files before submitting.
                                </div>
                            )}
                            <div className="d-flex justify-content-center mt-3">
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSubmitting || !areAllFilesUploaded()}
                                >
                                    {isSubmitting ? "Running..." : "Submit"}
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            </div>
        );
    };

    export default Scrinshot;