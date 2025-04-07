    import React, { useState } from 'react';
    import Navbar from "../modules/nav";
    import axios from "axios";
    import { OverlayTrigger, Popover} from 'react-bootstrap';
    import { InfoCircle } from "react-bootstrap-icons"; // Bootstrap icon
    import formDatas from "../forms/scrinshot_form";
    const Scrinshot: React.FC = () => {
        const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
        const [status, setStatus] = useState("idle");
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [formData, setFormData] = useState(formDatas);

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
                (files.file_regions !== null || formData.file_regions.value.length >0)&&
                files.files_fasta_target_probe_database.length > 0 &&
                files.files_fasta_reference_database_target_probe.length > 0
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
                                <label htmlFor="dir_output" className="form-label">Output Directory:</label>
                                <div className="d-flex align-items-center">
                                    <input type="text" className="form-control" id="dir_output" name="dir_output"
                                           value={formData.dir_output.value} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="dir_output">
                                                <Popover.Body>
                                                    {formData.dir_output.comment}
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
                                            placeholder="Enter genes (comma-separated)"
                                            onChange={handleChange}
                                        />

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
                                        />
                                        <label
                                            htmlFor="files_fasta_target_probe_database" // Corrected from "file_regions"
                                            className="btn btn-outline-primary d-block me-2 w-100"
                                            style={{cursor: 'pointer'}}
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
                                        />
                                        <label
                                            htmlFor="files_fasta_reference_database_target_probe" // Correct ID
                                            className="btn btn-outline-primary d-block me-2 w-100"
                                            style={{cursor: 'pointer'}}
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
        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();

            // Check if all files are uploaded
            if (!areAllFilesUploaded()) {
                alert('Please upload all required files before submitting.');
                return;
            }

            try {
                // Upload files and get their paths
                const uploadedPaths = await uploadFiles();
                console.log(uploadedPaths,'there are the paths');
                // Combine form data with uploaded file paths while preserving the { value, comment } structure
                const finalFormData = { ...formData };

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

                // Submit the form data
                const response = await axios.post(
                    'http://localhost:5000/api/oligoseq',
                    finalFormData,
                    {
                        headers: {"Content-Type": "application/json"},
                    }
                );

                setStatus("running");
                alert('Form submitted successfully!');
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('Error submitting form. Please try again.');
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