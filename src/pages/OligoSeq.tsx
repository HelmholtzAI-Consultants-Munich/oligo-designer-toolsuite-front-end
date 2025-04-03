import React, { useState, useEffect } from 'react';
import Navbar from "../modules/nav";
import axios from "axios";
import {OverlayTrigger, Popover} from "react-bootstrap";
import {InfoCircle} from "react-bootstrap-icons";
import formDatas from "../forms/oligoseq_form";
import oligoseq_form from "../forms/oligoseq_form";
const OligoSeq: React.FC = () => {
    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [progress, setProgress] = useState(0);
    //const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [isSubmitting, setIsSubmitting] = useState(false);
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
            (files.file_regions !== null || formData.file_regions.value.length >0) &&
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
                        console.log(files[key],key,'what it look like not array');
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
    // useEffect(() => {
    //     const socket = io("http://localhost:5000"); // Connect to Flask-SocketIO
    //     socket.on("update", (data) => {
    //         setProgress(data.progress);
    //         setStatus(data.status);
    //
    //     });
    //
    //     return () => {
    //         socket.disconnect(); // Clean up connection on component unmount
    //     };
    // }, []);
    const [formData, setFormData] = useState(oligoseq_form);
    const [activeTab, setActiveTab] = useState("general");
    const [activetab2, setActivetab2] = useState("specfblastn");

    const renderTabContent = () => {
        switch (activeTab) {
            case "general":
                // @ts-ignore
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
                                            <Popover id="popover-n_jobs">
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
                                        <Popover id="popover-n_jobs">
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
                                className="form-label mb-2" // mb-2 ile label ile input arasında biraz boşluk bırakıyoruz
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
                                        <Popover id="popover-write_intermediate_steps">
                                            <Popover.Body>
                                                {formData.write_intermediate_steps.comment}                                            </Popover.Body>
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
                                <input type="number" className="form-control" id="n_jobs" name="n_jobs"
                                       value={formData.top_n_sets.value} onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {formData.top_n_sets.comment}                                            </Popover.Body>
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
                // @ts-ignore
                return (
                    <div>
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
                                        />
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="file_regions"
                                            name="file_regions"
                                            placeholder="Enter genes (comma-separated)"
                                            value={formData.file_regions.value}
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
                                                    <Popover id="popover-n_jobs">
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
                                            htmlFor="file_regions"
                                            className="btn btn-outline-primary d-block me-2 w-100 "
                                            style={{cursor: 'pointer'}}
                                        >
                                            Choose File
                                        </label>

                                        {/* Info icon with popover */}
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
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
                                            htmlFor="file_regions"
                                            className="btn btn-outline-primary d-block me-2 w-100 "
                                            style={{cursor: 'pointer'}}
                                        >
                                            Choose File
                                        </label>

                                        {/* Info icon with popover */}
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
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
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="probe_length_min" className="form-label">Min Probe Length:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probe_length_min"
                                           name="probe_length_min"
                                           value={formData.target_probe_length_min.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
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
                                           name="probe_length_max"
                                           value={formData.target_probe_length_max.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
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
                                           name="probe_isoform_consensus"
                                           value={formData.target_probe_isoform_consensus.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
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
                                           name="probe_GC_content_min"
                                           value={formData.target_probe_GC_content_min.value} onChange={handleChange}
                                           required/>
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
                                           name="probe_GC_content_opt"
                                           value={formData.target_probe_GC_content_opt.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="probe_GC_content_opt">
                                                <Popover.Body>
                                                    {formData.target_probe_GC_content_opt.comment}
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
                                           name="probe_GC_content_max"
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
                        <h6 className="pt-2">Minimum number of nucleotides to consider it a homopolymeric run per
                            base </h6>
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="homopolymeric_A" className="form-label">A:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="homopolymeric_A"
                                           name="homopolymeric_A"
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
                                           name="homopolymeric_T"
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
                                           name="homopolymeric_C"
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
                                           name="homopolymeric_G"
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
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="target_probe_T_secondary_structure" className="form-label">Secondary
                                    Structure Temperature:</label>
                                <div className="col">
                                    <label htmlFor="target_probe_secondary_structures_threshold_deltaG"
                                           className="form-label">Threshold for secondary structure:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control"
                                               id="target_probe_T_secondary_structure"
                                               name="target_probe_T_secondary_structure"
                                               value={formData.target_probe_secondary_structures_T.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.target_probe_secondary_structures_T.comment}
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
                            <div className="col">
                                <label htmlFor="target_probe_secondary_structures_threshold_deltaG"
                                       className="form-label">Threshold for secondary structure:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_secondary_structures_threshold_deltaG"
                                           name="target_probe_secondary_structures_threshold_deltaG"
                                           value={formData.target_probe_secondary_structures_threshold_deltaG.value}
                                           onChange={handleChange}/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {formData.target_probe_secondary_structures_threshold_deltaG.comment}
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
                                <label htmlFor="probe_GC_weight" className="form-label">GC Content Weight:</label>

                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probe_GC_weight"
                                           name="probe_GC_weight"
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

                            </div>
                        </div>
                        <div className="row g-3">

                            <div className="col">
                                <label htmlFor="probeset_size_min" className="form-label">Minimum Probe Set
                                    Size:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probeset_size_min"
                                           name="probeset_size_min"
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
                                    <input type="number" className="form-control" id="probeset_size_opt"
                                           name="probeset_size_opt"
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
                                    <input type="number" className="form-control" id="distance_between_probes"
                                           name="distance_between_probes"
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
                )
                    ;
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
                        <div className="mb-3">
                            <label htmlFor="target_probe_hybridization_probability_alignment_method"
                                   className="form-label">Alignment Method:</label>
                            <select className="form-select" id="target_probe_hybridization_probability_alignment_method"
                                    name="target_probe_hybridization_probability_alignment_method"
                                    value={formData.target_probe_hybridization_probability_alignment_method.value}
                                    onChange={handleChange}>
                                <option value="blastn">BlastN</option>
                                <option value="bowtie">Bowtie</option>
                            </select>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_perc_identity"
                                       className="form-label">Percent Identity:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_specificity_blastn_search_parameters_perc_identity"
                                           name="target_probe_specificity_blastn_search_parameters_perc_identity"
                                           value={formData.target_probe_hybridization_probability_blastn_search_parameters.perc_identity.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-perc-identity">
                                                <Popover.Header as="h3">Percent Identity</Popover.Header>
                                                <Popover.Body>
                                                    {formData.target_probe_hybridization_probability_blastn_search_parameters.perc_identity.comment ||
                                                        "Minimum percentage identity for BLASTn search"}
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
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_strand"
                                       className="form-label">Strand:</label>
                                <div className="d-flex align-items-center">
                                    <select className="form-select"
                                            id="target_probe_specificity_blastn_search_parameters_strand"
                                            name="target_probe_specificity_blastn_search_parameters_strand"
                                            value={formData.target_probe_hybridization_probability_blastn_search_parameters.strand.value}
                                            onChange={handleChange}
                                            required>
                                        <option value="minus">Minus</option>
                                        <option value="plus">Plus</option>
                                        <option value="both">Both</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-strand">
                                                <Popover.Header as="h3">Strand Selection</Popover.Header>
                                                <Popover.Body>
                                                    {formData.target_probe_hybridization_probability_blastn_search_parameters.strand.comment ||
                                                        "If reference is whole genome, consider using 'both'"}
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
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_word_size"
                                       className="form-label">Word Size:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_specificity_blastn_search_parameters_word_size"
                                           name="target_probe_specificity_blastn_search_parameters_word_size"
                                           value={formData.target_probe_hybridization_probability_blastn_search_parameters.word_size.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-word-size">
                                                <Popover.Header as="h3">Word Size</Popover.Header>
                                                <Popover.Body>
                                                    {formData.target_probe_hybridization_probability_blastn_search_parameters.word_size.comment ||
                                                        "Word size for BLASTn search"}
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
                                <label htmlFor="target_probe_hybridization_probability_blastn_hit_parameters_coverage"
                                       className="form-label">Max
                                    Target Sequences:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_hybridization_probability_blastn_hit_parameters_coverage"
                                       name="target_probe_hybridization_probability_blastn_hit_parameters_coverage"
                                       value={formData.target_probe_hybridization_probability_blastn_hit_parameters.coverage.value}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_hybridization_probability_bowtie_search_parameters_v"
                                       className="form-label">Allowed Mismatches:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_hybridization_probability_bowtie_search_parameters_v"
                                       name="target_probe_hybridization_probability_bowtie_search_parameters_v"
                                       value={formData.target_probe_hybridization_probability_bowtie_search_parameters.v.value}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="mb-3 form-check">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                    name="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                    checked={formData.target_probe_hybridization_probability_bowtie_search_parameters.nofw.value === "true"}
                                    onChange={(e) =>
                                        setFormData((prev: any) => ({
                                            ...prev,
                                            target_probe_hybridization_probability_bowtie_search_parameters_nofw:{value:e.target.checked ? "true" : "false",comment:formData.target_probe_hybridization_probability_bowtie_search_parameters.nofw.comment} ,
                                        }))
                                    }
                                />
                            </div>

                        </div>
                    </div>
                );
            case 'crossfilterblastn':
                return (
                    <div>

                        <h5>Cross-Hybridization Filters</h5>
                        <div className="mb-3">
                            <label htmlFor="target_probe_cross_hybridization_alignment_method"
                                   className="form-label">Alignment Method for cross hybridization:</label>
                            <div className="d-flex align-items-center">
                                <select className="form-select"
                                        id="target_probe_cross_hybridization_alignment_method"
                                        name="target_probe_cross_hybridization_alignment_method"
                                        value={formData.target_probe_cross_hybridization_alignment_method.value}
                                        onChange={handleChange}>
                                    <option value="blastn">BlastN</option>
                                    <option value="bowtie">Bowtie</option>
                                </select>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-alignment-method">
                                            <Popover.Header as="h3">Alignment Method</Popover.Header>
                                            <Popover.Body>
                                                {formData.target_probe_cross_hybridization_alignment_method.comment ||
                                                    "Select alignment method for cross-hybridization detection"}
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

                        <div className="row">
                            {/* BLASTn Parameters */}
                            <div className="col-md-6">
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_perc_identity"
                                       className="form-label">Percent Identity:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_cross_hybridization_blastn_search_parameters_perc_identity"
                                           name="target_probe_cross_hybridization_blastn_search_parameters_perc_identity"
                                           value={formData.target_probe_cross_hybridization_blastn_search_parameters.perc_identity.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-blastn-perc-identity">
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_blastn_search_parameters.perc_identity.comment ||
                                                        "Minimum percentage identity for BLASTn search"}
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
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_strand"
                                       className="form-label">Strand:</label>
                                <div className="d-flex align-items-center">
                                    <select className="form-select"
                                            id="target_probe_cross_hybridization_blastn_search_parameters_strand"
                                            name="target_probe_cross_hybridization_blastn_search_parameters_strand"
                                            value={formData.target_probe_cross_hybridization_blastn_search_parameters.strand.value}
                                            onChange={handleChange}
                                            required>
                                        <option value="minus">Minus</option>
                                        <option value="plus">Plus</option>
                                        <option value="both">Both</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-blastn-strand">
                                                <Popover.Header as="h3">Strand Selection</Popover.Header>
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_blastn_search_parameters.strand.comment ||
                                                        "If reference is whole genome, consider using 'both'"}
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
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_word_size"
                                       className="form-label">Word Size:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_cross_hybridization_blastn_search_parameters_word_size"
                                           name="target_probe_cross_hybridization_blastn_search_parameters_word_size"
                                           value={formData.target_probe_cross_hybridization_blastn_search_parameters.word_size.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-blastn-word-size">
                                                <Popover.Header as="h3">Word Size</Popover.Header>
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_blastn_search_parameters.word_size.comment ||
                                                        "Word size for BLASTn search"}
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
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_coverage"
                                       className="form-label">Max Target Sequences:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_cross_hybridization_blastn_search_parameters_coverage"
                                           name="target_probe_cross_hybridization_blastn_search_parameters_coverage"
                                           value={formData.target_probe_cross_hybridization_blastn_hit_parameters.coverage.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-blastn-coverage">
                                                <Popover.Header as="h3">Max Target Sequences</Popover.Header>
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_blastn_hit_parameters.coverage.comment ||
                                                        "Maximum number of target sequences to report"}
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

                            {/* Bowtie Parameters */}
                            <div className="col-md-6">
                                <label htmlFor="target_probe_cross_hybridization_bowtie_search_parameters_v"
                                       className="form-label">Allowed Mismatches:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_cross_hybridization_bowtie_search_parameters_v"
                                           name="target_probe_cross_hybridization_bowtie_search_parameters_v"
                                           value={formData.target_probe_cross_hybridization_bowtie_search_parameters.v.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-bowtie-mismatches">
                                                <Popover.Header as="h3">Allowed Mismatches</Popover.Header>
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_bowtie_search_parameters.v.comment ||
                                                        "Number of allowed mismatches for Bowtie alignment"}
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
                        <label
                            htmlFor="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                            className="form-check-label"
                        >
                            No forward strand:
                        </label>
                        <div className="mb-3 form-check">

                            <div className="d-flex align-items-center">

                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                    name="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                    checked={formData.target_probe_hybridization_probability_bowtie_search_parameters.nofw.value === "true"}
                                    onChange={(e) =>
                                        setFormData((prev: any) => ({
                                            ...prev,
                                            target_probe_hybridization_probability_bowtie_search_parameters: {
                                                nofw: {
                                                    value: e.target.checked ? "true" : "false",
                                                    comment: prev.target_probe_hybridization_probability_bowtie_search_parameters.nofw.comment,
                                                },
                                            },
                                        }))
                                    }
                                />
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-bowtie-mismatches">
                                            <Popover.Header as="h3">Allowed Mismatches</Popover.Header>
                                            <Popover.Body>
                                                {formData.target_probe_cross_hybridization_bowtie_search_parameters.v.comment ||
                                                    "Number of allowed mismatches for Bowtie alignment"}
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
                                </div>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-bowtie-mismatches">
                                            <Popover.Body>
                                                {formData.max_graph_size.comment}
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

                            <div className="col-md-6">
                                <label htmlFor="n_attempts" className="form-label">Number of Attempts:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="n_attempts"
                                           name="n_attempts"
                                           value={formData.n_attempts.value} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n-attempts">
                                                <Popover.Body>
                                                    {formData.n_attempts.comment}
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
                                            <Popover id="popover-heuristic">
                                                <Popover.Body>
                                                    {formData.heuristic.comment}
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
                                <label htmlFor="heuristic_n_attempts" className="form-label">Heuristics number of Attempts:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="heuristic_n_attempts"
                                           name="heuristic_n_attempts"
                                           value={formData.heuristic_n_attempts.value} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-heuristic-n-attempts">
                                                <Popover.Body>
                                                    {formData.heuristic_n_attempts.comment}
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
            case'meltingtemp':
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
                                        <input type="text" className="form-control" id="Tm_detection_nn_table"
                                               name="Tm_detection_nn_table"
                                               value={formData.target_probe_Tm_parameters.nn_table.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-nn-table-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.nn_table.comment}
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
                                        <input type="text" className="form-control" id="Tm_detection_tmm_table"
                                               name="Tm_detection_tmm_table"
                                               value={formData.target_probe_Tm_parameters.tmm_table.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-tmm-table-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.tmm_table.comment}
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
                                        <input type="text" className="form-control" id="Tm_detection_imm_table"
                                               name="Tm_detection_imm_table"
                                               value={formData.target_probe_Tm_parameters.imm_table.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-imm-table-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.imm_table.comment}
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
                                        <input type="text" className="form-control" id="Tm_detection_de_table"
                                               name="Tm_detection_de_table"
                                               value={formData.target_probe_Tm_parameters.de_table.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-de-table-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.de_table.comment}
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
                                        <input type="number" className="form-control" id="Tm_detection_dnac1"
                                               name="Tm_detection_dnac1"
                                               value={formData.target_probe_Tm_parameters.dnac1.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dnac1-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.dnac1.comment}
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
                                        <input type="number" className="form-control" id="Tm_detection_dnac2"
                                               name="Tm_detection_dnac2"
                                               value={formData.target_probe_Tm_parameters.dnac2.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dnac2-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.dnac2.comment}
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
                                        <input type="number" className="form-control" id="Tm_detection_saltcorr"
                                               name="Tm_detection_saltcorr"
                                               value={formData.target_probe_Tm_parameters.saltcorr.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-saltcorr-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.saltcorr.comment}
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
                                        <input type="number" className="form-control" id="Tm_detection_Na"
                                               name="Tm_detection_Na"
                                               value={formData.target_probe_Tm_parameters.Na.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-na-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.Na.comment}
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
                                        <input type="number" className="form-control" id="Tm_detection_K"
                                               name="Tm_detection_K"
                                               value={formData.target_probe_Tm_parameters.K.value}
                                               onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-k-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.K.comment}
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
                                        <input type="number" className="form-control" id="Tm_detection_Tris"
                                               name="Tm_detection_Tris"
                                               value={formData.target_probe_Tm_parameters.Tris.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-tris-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.Tris.comment}
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
                                        <input type="number" className="form-control" id="Tm_detection_Mg"
                                               name="Tm_detection_Mg"
                                               value={formData.target_probe_Tm_parameters.Mg.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-mg-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.Mg.comment}
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
                                        <input type="number" className="form-control" id="Tm_detection_dNTPs"
                                               name="Tm_detection_dNTPs"
                                               value={formData.target_probe_Tm_parameters.dNTPs.value} onChange={handleChange}/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dntps-detection">
                                                    <Popover.Body>
                                                        {formData.target_probe_Tm_parameters.dNTPs.comment}
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
                );

            // Add cases for other tabs
            default:
                return null;
        }
    };

    // Handle input changes
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const {name, value} = e.target;
        setFormData({...formData, [name]: value});
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

            // Combine form data with uploaded file paths
            const finalFormData = {
                ...formData,
                ...uploadedPaths,
            };

            // Submit the form data
            const response = await axios.post(
                'http://localhost:5000/api/oligoseq',
                finalFormData,
                {
                    headers: { "Content-Type": "application/json" },
                }
            );

            setStatus("running");
            alert('Form submitted successfully!');
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('Error submitting form. Please try again.');
        }
    };
    return (
        <div>
            <Navbar/>
            <div className="container my-4">
                <form onSubmit={handleSubmit} id="scrinshotForm">
                    <h2 className="text-center mb-4">Oligo-Seq Designer</h2>
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

export default OligoSeq;