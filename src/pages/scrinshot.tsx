import React, { useState } from 'react';
import axios from "axios";
import { OverlayTrigger, Popover,Spinner } from 'react-bootstrap';
import { InfoCircle } from "react-bootstrap-icons";

import Navbar from "../modules/nav";
import FastaGenerateForm from "../modules/FastaGenerateForm";
import { createRunId } from "../modules/helpers";
import formDatas from "../forms/scrinshot_form";
import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";
import RunLocallyInfoBox from "../modules/RunLocallyInfoBox";

    const Scrinshot: React.FC = () => {
    // ====== State Declarations ======
    const [fastaOption, setFastaOption] = useState("generate"); // "generate" or "upload"
    const [fastaOption2, setFastaOption2] = useState("generate"); // "generate" or "upload"
    const defaultFastaForm = {
        selectedSource: "ncbi",
        formDataNcbi: JSON.parse(JSON.stringify(form_Data_Ncbi)),
        formDataEns: JSON.parse(JSON.stringify(form_Data_Ens)),
    };
    const [fastaForms, setFastaForms] = useState<Array<typeof defaultFastaForm>>([]);
    const [fastaFormsReference, setFastaFormsReference] = useState<Array<typeof defaultFastaForm>>([]);
    const [loading, setLoading] = useState(false);
    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [status, setStatus] = useState("idle");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState(formDatas);

    interface FileState {
        file_regions: File | null;
        files_fasta_target_probe_database: File[];
        files_fasta_reference_database_target_probe: File[];
    }
    const [files, setFiles] = useState<FileState>({
        file_regions: null,
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
    });

    const [activeTab, setActiveTab] = useState("probe_sequences");
    const [activetab2, setActivetab2] = useState("specfblastn");


    // ====== Functions ======

    /**
     * Handles file input changes for both single and multiple file fields.
     * Updates the `files` state accordingly based on the input's name.
     */
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: selectedFiles } = e.target;
        if (!selectedFiles) return;
        setFiles((prevFiles) => ({
            ...prevFiles,
            [name]: name === 'file_regions'
                ? selectedFiles[0]
                : Array.from(selectedFiles),
        }));
    };

    /**
     * Checks if all required files are uploaded, unless "generate" is selected.
     * Returns true if either generation is chosen or all file arrays are non-empty.
     */
    const areAllFilesUploaded = () => {
        return (
            (fastaOption === 'generate') ||
            (
                files.files_fasta_target_probe_database.length > 0 &&
                files.files_fasta_reference_database_target_probe.length > 0
            )
        );
    };

    /**
     * Uploads all files in the `files` state to the backend.
     * Returns an object mapping file field names to their uploaded file paths.
     */
    const uploadFiles = async () => {
        const filePaths: { [key: string]: string } = {};
        // Only include keys whose value is a non-empty array or not null
        const filteredFiles: { [key: string]: File | File[] } = {};
        Object.keys(files).forEach(key => {
            const val = files[key as keyof typeof files];
            if (Array.isArray(val)) {
                if (val.length > 0) filteredFiles[key] = val;
            } else if (val) {
                filteredFiles[key] = val;
            }
        });
        for (const key in filteredFiles) {
            if (filteredFiles[key]) {
                const formDataU = new FormData();
                if (Array.isArray(filteredFiles[key])) {
                    let paths = [];
                    for (const file of filteredFiles[key] as File[]) {
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
                    formDataU.append("file", filteredFiles[key] as File);
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
        return filePaths;
    };

    /**
     * Toggles the visibility of developer settings.
     */
    const toggleDeveloperSettings = () => {
        setShowDeveloperSettings(!showDeveloperSettings);
    };

    /**
     * Renders the content for the currently active tab.
     * Switches based on `activeTab` value.
     */
    const renderTabContent = () => {
        switch (activeTab) {
                case "probe_sequences":
                    return (
                        <div className="mb-4">
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
                                        className="btn btn-outline-primary d-block me-2 w-100"
                                        style={{ cursor: 'pointer' }}
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
                                                    fontSize: "1.2rem",
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
                                        : "No file selected"
                                    }
                                </div>
                            </div>


                            {/* Probe Database input group */}
                            <div className="mb-3 pt-3">
                                <label htmlFor="files_fasta_target_probe_database" className="form-label">
                                    Probe Database:
                                </label>
                                <div className="d-flex align-items-center w-100 gap-2">
                                    <div className="w-50">
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary w-100"
                                            onClick={() => setFastaForms(forms => [...forms, { ...defaultFastaForm }])}
                                        >
                                            Generate FASTA+
                                        </button>
                                    </div>
                                    <div className="w-50 d-flex align-items-center">
                                        <input
                                            type="file"
                                            className="form-control visually-hidden"
                                            id="files_fasta_target_probe_database"
                                            name="files_fasta_target_probe_database"
                                            onChange={handleFileChange}
                                            multiple
                                        />
                                        <label
                                            htmlFor="files_fasta_target_probe_database"
                                            className="btn btn-outline-primary me-2 w-100"
                                        >
                                            Choose File
                                        </label>
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
                                </div>
                                <div className="text-muted small mt-1">
                                    {files.files_fasta_target_probe_database.length > 0
                                        ? `Selected: ${files.files_fasta_target_probe_database.map(f => f.name).join(', ')}`
                                        : "No files selected"
                                    }
                                </div>
                            </div>

                            {/* FASTA generation form for Probe Database */}
                            {fastaOption === "generate" && (
                                <form onSubmit={handleSubmit}>
                                    {fastaForms.map((form, idx) => (
                                        <FastaGenerateForm
                                            key={idx}
                                            form={form}
                                            onChange={updatedForm =>
                                                setFastaForms(forms => forms.map((f, i) => (i === idx ? updatedForm : f)))
                                            }
                                            onRemove={() =>
                                                setFastaForms(forms =>
                                                    forms.length === 0 ? forms : forms.filter((_, i) => i !== idx)
                                                )
                                            }
                                            disableRemove={fastaForms.length === 0}
                                        />
                                    ))}
                                </form>
                            )}

                            {/* Probe Reference Database input group */}
                            <div className="mb-3 pt-3">
                                <label htmlFor="files_fasta_reference_database_target_probe" className="form-label">
                                    Probe Reference Database:
                                </label>
                                <div className="d-flex align-items-center w-100 gap-2">
                                    <div className="w-50">
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary w-100"
                                            onClick={() => setFastaFormsReference(forms => [...forms, { ...defaultFastaForm }])}
                                        >
                                            Generate FASTA+
                                        </button>
                                    </div>
                                    <div className="w-50 d-flex align-items-center">
                                        <input
                                            type="file"
                                            className="form-control visually-hidden"
                                            id="files_fasta_reference_database_target_probe"
                                            name="files_fasta_reference_database_target_probe"
                                            onChange={handleFileChange}
                                            multiple
                                        />
                                        <label
                                            htmlFor="files_fasta_reference_database_target_probe"
                                            className="btn btn-outline-primary me-2 w-100"
                                        >
                                            Choose File
                                        </label>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="files_fasta_reference_database_target_probe">
                                                    <Popover.Body>
                                                        {formData.files_fasta_reference_database_target_probe.comment}
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
                                <div className="text-muted small mt-1">
                                    {files.files_fasta_reference_database_target_probe.length > 0
                                        ? `Selected: ${files.files_fasta_reference_database_target_probe.map(f => f.name).join(', ')}`
                                        : "No files selected"
                                    }
                                </div>
                            </div>
                            {/* FASTA generation form for Probe Reference Database */}
                            {fastaOption2 === 'generate' && (
                                <form onSubmit={handleSubmit}>
                                    {fastaFormsReference.map((form, idx) => (
                                        <FastaGenerateForm
                                            key={idx}
                                            form={form}
                                            onChange={updatedForm =>
                                                setFastaFormsReference(forms => forms.map((f, i) => (i === idx ? updatedForm : f)))
                                            }
                                            onRemove={() =>
                                                setFastaFormsReference(forms =>
                                                    forms.length === 0 ? forms : forms.filter((_, i) => i !== idx)
                                                )
                                            }
                                            disableRemove={fastaFormsReference.length === 0}
                                        />
                                    ))}
                                </form>
                            )}
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

        // Batch submit for multiple FASTA forms
        const handleSubmitGenomicAll = async (
            forms: typeof fastaForms,           // Accept forms as argument
            setLoadingFn?: (val: boolean) => void,
            e?: React.FormEvent
        ): Promise<string> => {
            e?.preventDefault();
            setLoadingFn?.(true);
            try {

                let results = "";
                for (let i = 0; i < forms.length; ++i) {
                    const form = forms[i];
                    let payload;
                    let endpoint;
                    if (form.selectedSource === 'ncbi') {
                        payload = form.formDataNcbi;
                        endpoint = 'ncbi';
                    } else if (form.selectedSource === 'ensembl') {
                        payload = form.formDataEns;
                        endpoint = 'ensembl';
                    } else {
                        continue; // skip unknown
                    }
                    try {
                        const response = await axios.post(
                            `http://localhost:5000/api/genomic/cascaded/${endpoint}`,
                            payload,
                            {
                                withCredentials: true,
                                headers: { "Content-Type": "application/json" },
                            }
                        );
                        if (results === '') {
                            results = response.data.output;
                        } else {
                            results += '\n' + response.data.output;
                        }
                    } catch (error) {
                        console.error('Error submitting genomic form:', error);
                    }
                }
                return results;
            } catch (error) {
                console.error('Error in batch FASTA submission:', error);
                alert('Error submitting genomic forms. Please try again.');
                return 'error';
            } finally {
                setLoadingFn?.(false);
            }
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setLoading(true);

            // ---- FASTA target probe database ----
            let generatedTargetPaths = '';
            if (fastaForms.length > 0) {
                generatedTargetPaths = await handleSubmitGenomicAll(fastaForms, setLoading);
            }
            const uploadedPaths = await uploadFiles();
            let uploadedTargetFastaPath = '';
            if (uploadedPaths['files_fasta_target_probe_database']) {
                uploadedTargetFastaPath = uploadedPaths['files_fasta_target_probe_database'];
            }
            const mergedTargetValue = [generatedTargetPaths, uploadedTargetFastaPath]
                .filter(v => v && v.length > 0)
                .join('\n');
            if (mergedTargetValue.length > 0) {
                formData['files_fasta_target_probe_database']['value'] = mergedTargetValue;
            }

            // ---- FASTA reference probe database ----
            let generatedReferencePaths = '';
            if (fastaFormsReference.length > 0) {
                generatedReferencePaths = await handleSubmitGenomicAll(fastaFormsReference, setLoading);
            }
            let uploadedReferenceFastaPath = '';
            if (uploadedPaths['files_fasta_reference_database_target_probe']) {
                uploadedReferenceFastaPath = uploadedPaths['files_fasta_reference_database_target_probe'];
            }
            const mergedReferenceValue = [generatedReferencePaths, uploadedReferenceFastaPath]
                .filter(v => v && v.length > 0)
                .join('\n');
            if (mergedReferenceValue.length > 0) {
                formData['files_fasta_reference_database_target_probe']['value'] = mergedReferenceValue;
            }

            const runid = await createRunId();

            // Then: handle scrinshot (upload other files and submit form)
            if (!areAllFilesUploaded()) {
                alert('Please upload all required files before submitting.');
                setLoading(false);
                return;
            }

            try {
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

                const response = await axios.post('http://localhost:5000/api/scrinshot', { formdata: finalFormData, runid: runid }, {
                    withCredentials: true,
                    headers: { "Content-Type": "application/json" },
                });
                const result = response.data;
                console.log(result, 'this is the result');

                setStatus("running");
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
                                    className={`nav-link ${activeTab === "probe_sequences" ? "active" : ""}`}
                                    onClick={() =>{
                                        setActiveTab("probe_sequences")
                                        setActivetab2('specfblastn')
                                    }}
                                >
                                    Target Probe Parameters
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    type="button"
                                    className={`nav-link ${activeTab === "detection_oligos" ? "active" : ""}`}
                                    onClick={() =>{
                                        setActivetab2('chemcorr')
                                        setActiveTab("detection_oligos")
                                    }}
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

                            {showDeveloperSettings &&  (
                                <>

                                    <ul className="nav nav-tabs mt-3">
                                        {activeTab!=='detection_oligos' && (
                                            <>
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
                                            </>
                                         )}
                                        {activeTab==='detection_oligos' && (
                                        <li className="nav-item">
                                            <button
                                                type="button"
                                                className={`nav-link ${activetab2 === "chemcorr" ? "active" : ""}`}
                                                onClick={() => setActivetab2("chemcorr")}
                                            >
                                                Detection Oligo Parameters
                                            </button>
                                        </li>
                                            )}
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
                    <RunLocallyInfoBox />
                </div>
            </div>
        );
    };

    export default Scrinshot;