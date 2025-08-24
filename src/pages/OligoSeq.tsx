import React, { useState} from 'react';
import Navbar from "../modules/nav";
import axios from "axios";
import {Collapse, OverlayTrigger, Popover} from "react-bootstrap";
import {ChevronDown, ChevronUp, InfoCircle} from "react-bootstrap-icons";
import oligoseq_form from "../forms/oligoseq_form";
import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";
import {createRunId} from "../modules/helpers";
import FastaGenerateForm from "../modules/FastaGenerateForm";
import RunLocallyInfoBox from "../modules/RunLocallyInfoBox";
import seqfishImage from "../images/pipeline_seqfishplus_probes.webp";


const OligoSeq: React.FC = () => {
    const defaultFastaForm = {
          selectedSource: "ncbi",
          formDataNcbi: JSON.parse(JSON.stringify(form_Data_Ncbi)),
          formDataEns: JSON.parse(JSON.stringify(form_Data_Ens)),
        };
    const [fastaForms, setFastaForms] = useState<Array<typeof defaultFastaForm>>([]);
    const [fastaFormsReference, setFastaFormsReference] = useState<Array<typeof defaultFastaForm>>([]);
    const [fastaOption, setFastaOption] = useState("generate"); // "generate" or "upload"
    const [fastaOption2, setFastaOption2] = useState("generate"); // "generate" or "upload"
    const [loading, setLoading] = useState(false);
    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [status, setStatus] = useState("idle");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generateFastaFiles, setGenerateFastaFiles] = useState(false);
    const [expanded, setExpanded] = useState(false);
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
        console.log(files)
    };
    const areAllFilesUploaded = () => {
        return (
            ( (files.file_regions !== null || formData.file_regions.value.length > 0) &&
                (files.files_fasta_target_probe_database.length > 0 || fastaForms.length > 0 ) &&
                (files.files_fasta_reference_database_target_probe.length > 0 || fastaFormsReference.length > 0  )
            )
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
    const [formData, setFormData] = useState({
        ...oligoseq_form,
        target_probe_targeted_exons: { value: 1, comment: "" }
    });
    const [activeTab, setActiveTab] = useState("probe_sequences");
    const [activetab2, setActivetab2] = useState("specfblastn");

    const renderTabContent = () => {
        switch (activeTab) {
            case "probe_sequences":
                // @ts-ignore
                return (
                    <div>
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
                                            <option value="BCAR1" />
                                            <option value="LOC105376749" />
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


                                {/* === Probe Database Section === */}
                                {/*
                                    Probe Database block: allows user to generate or upload probe FASTA files.
                                    Includes: add-form button, file input, info popover, file display, dynamic form rendering.
                                */}
                                <div className="mb-3 pt-3">
                                    <label htmlFor="files_fasta_target_probe_database" className="form-label">
                                        Probe Database:
                                    </label>
                                    <div className="d-flex align-items-center w-100 gap-2">
                                        {/* Add-form button */}
                                        <div className="w-50">
                                            <button
                                                type="button"
                                                className="btn btn-outline-primary w-100"
                                                onClick={() => setFastaForms(forms => [...forms, { ...defaultFastaForm }])}
                                            >
                                                Generate FASTA+
                                            </button>
                                        </div>
                                        {/* File input, label, info popover */}
                                        <div className="w-50 d-flex align-items-center">
                                            {/* File input (hidden) */}
                                            <input
                                                type="file"
                                                className="form-control visually-hidden"
                                                id="files_fasta_target_probe_database"
                                                name="files_fasta_target_probe_database"
                                                onChange={handleFileChange}
                                                multiple
                                            />
                                            {/* File input button */}
                                            <label
                                                htmlFor="files_fasta_target_probe_database"
                                                className="btn btn-outline-primary me-2 w-100"
                                            >
                                                Choose File
                                            </label>
                                            {/* Info popover */}
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
                                    {/* File display */}
                                    <div className="text-muted small mt-1">
                                        {files.files_fasta_target_probe_database.length > 0
                                            ? `Selected: ${files.files_fasta_target_probe_database.map(f => f.name).join(', ')}`
                                            : "No files selected"}
                                    </div>
                                </div>
                                {/* Dynamic form rendering for Probe Database */}
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

                                {/* === Probe Reference Database Section === */}
                                {/*
                                    Probe Reference Database block: allows user to generate or upload reference FASTA files.
                                    Includes: add-form button, file input, info popover, file display, dynamic form rendering.
                                */}
                                <div className="mb-3 pt-3">
                                    <label htmlFor="files_fasta_reference_database_target_probe" className="form-label">
                                        Probe Reference Database:
                                    </label>
                                    <div className="d-flex align-items-center w-100 gap-2">
                                        {/* Add-form button */}
                                        <div className="w-50">
                                            <button
                                                type="button"
                                                className="btn btn-outline-primary w-100"
                                                onClick={() => setFastaFormsReference(forms => [...forms, { ...defaultFastaForm }])}
                                            >
                                                Generate FASTA+
                                            </button>
                                        </div>
                                        {/* File input, label, info popover */}
                                        <div className="w-50 d-flex align-items-center">
                                            {/* File input (hidden) */}
                                            <input
                                                type="file"
                                                className="form-control visually-hidden"
                                                id="files_fasta_reference_database_target_probe"
                                                name="files_fasta_reference_database_target_probe"
                                                onChange={handleFileChange}
                                                multiple
                                            />
                                            {/* File input button */}
                                            <label
                                                htmlFor="files_fasta_reference_database_target_probe"
                                                className="btn btn-outline-primary me-2 w-100"
                                            >
                                                Choose File
                                            </label>
                                            {/* Info popover */}
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
                                    {/* File display */}
                                    <div className="text-muted small mt-1">
                                        {files.files_fasta_reference_database_target_probe.length > 0
                                            ? `Selected: ${files.files_fasta_reference_database_target_probe.map(f => f.name).join(', ')}`
                                            : "No files selected"
                                        }
                                    </div>
                                </div>
                                {/* Dynamic form rendering for Probe Reference Database */}
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
                        </div>
                        {/* Maximum Number of Sets input + info popover */}
                        <div className="mb-3">
                            <label htmlFor="top_n_sets" className="form-label">
                                Maximum Number of Sets:
                            </label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="number"
                                    className="form-control"
                                    id="n_jobs"
                                    name="n_jobs"
                                    value={formData.top_n_sets.value}
                                    onChange={handleChange}
                                    required
                                />
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
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
                        {/* Min/Max Probe Length, Targeted Exons, Isoform Consensus */}
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="probe_length_min" className="form-label">Min Probe Length:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probe_length_min"
                                           name="target_probe_length_min"
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
                                           name="target_probe_length_max"
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
                                <label htmlFor="target_probe_targeted_exons" className="form-label">Targeted Exons:</label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-control"
                                        id="target_probe_targeted_exons"
                                        name="target_probe_targeted_exons"
                                        value={formData.target_probe_targeted_exons.value}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {formData.target_probe_targeted_exons.comment}
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
                        {/* Min/Optimal/Max GC Content */}
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="probe_GC_content_min" className="form-label">Min GC Content
                                    (%):</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probe_GC_content_min"
                                           name="target_probe_GC_content_min"
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
                                           name="target_probe_GC_content_opt"
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
                        {/* Homopolymeric run thresholds per base */}
                        <h6 className="pt-2">
                            Minimum number of nucleotides to consider it a homopolymeric run per base
                        </h6>
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
                                    <input type="number" className="form-control" id="target_probe_homopolymeric_base_n.C"
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
                        {/* Secondary structure thresholds */}
                        <div className="row g-3">
                            <div className="col">

                                <div className="col">
                                    <label htmlFor="target_probe_secondary_structures_threshold_deltaG"
                                           className="form-label">Threshold for secondary structure:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control"
                                               id="target_probe_T_secondary_structure"
                                               name="target_probe_secondary_structures_T"
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

                        {/* GC Content Weight */}
                        <div className="row g-3">

                            <div className="col">
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

                            </div>
                        </div>
                        {/* Probe Set Size and Distance */}
                        <div className="row g-3">

                            <div className="col">
                                <label htmlFor="probeset_size_min" className="form-label">Minimum Probe Set
                                    Size:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probeset_size_min"
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
                                    <input type="number" className="form-control" id="probeset_size_opt"
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
                                    <input type="number" className="form-control" id="distance_between_probes"
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
                            <div className="d-flex align-items-center">
                                <select className="form-select" id="target_probe_hybridization_probability_alignment_method"
                                        name="target_probe_hybridization_probability_alignment_method"
                                        value={formData.target_probe_hybridization_probability_alignment_method.value}
                                        onChange={handleChange}>
                                    <option value="blastn">BlastN</option>
                                    <option value="bowtie">Bowtie</option>
                                </select>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-perc-identity">
                                            <Popover.Body>
                                                {formData.target_probe_hybridization_probability_alignment_method.comment}
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
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_perc_identity"
                                       className="form-label">Percent Identity:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_hybridization_probability_blastn_search_parameters.perc_identity"
                                           name="target_probe_hybridization_probability_blastn_search_parameters.perc_identity"
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
                                            name="target_probe_hybridization_probability_blastn_search_parameters.strand"
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
                                                <Popover.Body>
                                                    {formData.target_probe_hybridization_probability_blastn_search_parameters.strand.comment
                                                        }
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
                                           name="target_probe_hybridization_probability_blastn_search_parameters.word_size"
                                           value={formData.target_probe_hybridization_probability_blastn_search_parameters.word_size.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-word-size">
                                                <Popover.Body>
                                                    {formData.target_probe_hybridization_probability_blastn_search_parameters.word_size.comment
                                                        }
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
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_hybridization_probability_blastn_hit_parameters.coverage"
                                           name="target_probe_hybridization_probability_blastn_hit_parameters.coverage"
                                           value={formData.target_probe_hybridization_probability_blastn_hit_parameters.coverage.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-word-size">
                                                <Popover.Body>
                                                    {formData.target_probe_hybridization_probability_blastn_hit_parameters.coverage.comment}
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
                                <label htmlFor="target_probe_hybridization_probability_bowtie_search_parameters_v"
                                       className="form-label">Allowed Mismatches:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_hybridization_probability_bowtie_search_parameters.v"
                                           name="target_probe_hybridization_probability_bowtie_search_parameters.v"
                                           value={formData.target_probe_hybridization_probability_bowtie_search_parameters.v.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-word-size">
                                                <Popover.Body>
                                                    {formData.target_probe_hybridization_probability_bowtie_search_parameters.v.comment}
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
                                        name="target_probe_hybridization_probability_bowtie_search_parameters.nofw"
                                        checked={formData.target_probe_hybridization_probability_bowtie_search_parameters.nofw.value === "true"}
                                        onChange={(e) =>
                                        setFormData((prev: any) => ({
                                            ...prev,
                                            target_probe_hybridization_probability_bowtie_search_parameters_nofw:{value:e.target.checked ? "true" : "false",comment:formData.target_probe_hybridization_probability_bowtie_search_parameters.nofw.comment} ,
                                        }))
                                    }
                                        />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-word-size">
                                                <Popover.Body>
                                                    { formData.target_probe_hybridization_probability_bowtie_search_parameters.nofw.comment}                                                </Popover.Body>
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
            case 'crossfilterblastn':
                return (
                    <div>

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
                                            <Popover.Body>
                                                {formData.target_probe_cross_hybridization_alignment_method.comment
                                                   }
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
                                           id="target_probe_cross_hybridization_blastn_search_parameters.perc_identity"
                                           name="target_probe_cross_hybridization_blastn_search_parameters.perc_identity"
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
                                            id="target_probe_cross_hybridization_blastn_search_parameters.strand"
                                            name="target_probe_cross_hybridization_blastn_search_parameters.strand"
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
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_blastn_search_parameters.strand.comment }

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
                                           id="target_probe_cross_hybridization_blastn_search_parameters.word_size"
                                           name="target_probe_cross_hybridization_blastn_search_parameters.word_size"
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
                                           id="target_probe_cross_hybridization_blastn_hit_parameters.coverage"
                                           name="target_probe_cross_hybridization_blastn_hit_parameters.coverage"
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
                                           id="target_probe_cross_hybridization_bowtie_search_parameters.v"
                                           name="target_probe_cross_hybridization_bowtie_search_parameters.v"
                                           value={formData.target_probe_cross_hybridization_bowtie_search_parameters.v.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-bowtie-mismatches">
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_bowtie_search_parameters.v.comment
                                                      }
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
                                    id="target_probe_cross_hybridization_bowtie_search_parameters.nofw"
                                    name="target_probe_cross_hybridization_bowtie_search_parameters.nofw"
                                    checked={formData.target_probe_cross_hybridization_bowtie_search_parameters.nofw.value === "true"}
                                    onChange={(e) =>
                                        setFormData((prev: any) => ({
                                            ...prev,
                                            target_probe_cross_hybridization_bowtie_search_parameters: {
                                                nofw: {
                                                    value: e.target.checked ? "true" : "false",
                                                    comment: prev.target_probe_cross_hybridization_bowtie_search_parameters.nofw.comment,
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
                    <div>                            <label htmlFor="max_graph_size" className="form-label">Max Graph
                        Size:</label>

                        <div className="row g-3">

                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="max_graph_size"
                                           name="max_graph_size"
                                           value={formData.max_graph_size.value} onChange={handleChange} required/>
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

                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_nn_table" className="form-label">Nearest Neighbor
                                        Table:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="target_probe_Tm_parameters.nn_table"
                                               name="target_probe_Tm_parameters.nn_table"
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
                                        <input type="text" className="form-control" id="target_probe_Tm_parameters.tmm_table"
                                               name="target_probe_Tm_parameters.tmm_table"
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
                                        <input type="text" className="form-control" id="target_probe_Tm_parameters.imm_table"
                                               name="target_probe_Tm_parameters.imm_table"
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
                                        <input type="text" className="form-control" id="target_probe_Tm_parameters.de_table"
                                               name="target_probe_Tm_parameters.de_table"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.dnac1"
                                               name="target_probe_Tm_parameters.dnac1"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.dnac2"
                                               name="target_probe_Tm_parameters.dnac2"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.saltcorr"
                                               name="target_probe_Tm_parameters.saltcorr"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.Na"
                                               name="target_probe_Tm_parameters.Na"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.K"
                                               name="target_probe_Tm_parameters.K"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.Tris"
                                               name="target_probe_Tm_parameters.Tris"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.Mg"
                                               name="target_probe_Tm_parameters.Mg"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.dNTPs"
                                               name="target_probe_Tm_parameters.dNTPs"
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
    // Update the handleChange function with proper typing
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


    // Handle form submission
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
    return (
        <div>
            <Navbar/>
            <div className="container my-4">
                <form onSubmit={handleSubmit} id="scrinshotForm">
                     <div className="mb-3">
                            <div className="d-flex justify-content-center align-items-center">
                                <h2 className="mb-0">OligoSeq Probe Designer</h2>

                                <button
                                    type="button"
                                    className="btn btn-link p-0 ms-2"
                                    onClick={() => setExpanded(!expanded)}
                                    aria-expanded={expanded}
                                    style={{ textDecoration: "none" }}
                                >
                                    {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                            </div>

                            <Collapse in={expanded}>
                                <div className="text-center mt-2">
                                    <p className="text-muted">
                                        An oligo-seq probe is an oligo hybridization probe, which is optimized for probe-based targeted sequencing to measure RNA expression.
                                    </p>
                                </div>
                            </Collapse>
                        </div>
                    <ul className="nav nav-tabs">

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
                                    Please upload all required files or fill the values before submitting.
                                </div>
                            )}
                           <div className="d-flex justify-content-center mt-4">
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={isSubmitting || loading || !areAllFilesUploaded()}
                                aria-busy={isSubmitting}
                              >
                                {isSubmitting ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Submitting...
                                  </>
                                ) : (
                                  'Submit'
                                )}
                              </button>
                            </div>
                        </div>

                </form>
                <RunLocallyInfoBox />
            </div>
        </div>
    );
};

export default OligoSeq;