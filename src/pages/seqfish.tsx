import React, { useState } from "react";
import axios from "axios";
import { Collapse, OverlayTrigger, Popover } from "react-bootstrap";
import { ChevronDown, ChevronUp, InfoCircle } from "react-bootstrap-icons";

import Navbar from "../modules/nav";
import FastaGenerateForm from "../modules/FastaGenerateForm";
import seqfish_form from "../forms/seqfish_form";
import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";
import { copyToClipboard, createRunId } from "../modules/helpers";
import RunLocallyInfoBox from "../modules/RunLocallyInfoBox";
import seqfishImage from "../images/pipeline_seqfishplus_probes.webp";
import { RunLinkModal } from "../components/modal/RunLinkModal";
import { InfoModal } from "../components/modal/InfoModal";
import { RunIdAlert } from "../components/alert/RunIdAlert";

const SeqFish: React.FC = () => {
    const defaultFastaForm = {
        selectedSource: "ncbi",
        formDataNcbi: JSON.parse(JSON.stringify(form_Data_Ncbi)),
        formDataEns: JSON.parse(JSON.stringify(form_Data_Ens)),
    };

    const [fastaOption, setFastaOption] = useState("generate"); // "generate" or "upload"
    const [fastaOption2, setFastaOption2] = useState("generate");
    const [fastaOptionReadout, setFastaOptionReadout] = useState("generate");
    const [fastaOptionPrimer, setFastaOptionPrimer] = useState("generate");
    const [fastaForms, setFastaForms] = useState<
        Array<typeof defaultFastaForm>
    >([]);
    const [fastaFormsReference, setFastaFormsReference] = useState<
        Array<typeof defaultFastaForm>
    >([]);
    const [fastaFormsReadout, setFastaFormsReadout] = useState<
        Array<typeof defaultFastaForm>
    >([]);
    const [fastaFormsPrimer, setFastaFormsPrimer] = useState<
        Array<typeof defaultFastaForm>
    >([]);
    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [formData, setFormData] = useState(seqfish_form);
    const [activeTab, setActiveTab] = useState("probe_sequences");
    const [activetab2, setActivetab2] = useState("specfblastn");
    const [expanded, setExpanded] = useState(false);
    const [runId, setRunId] = useState<string | null>(null);
    const [runStatus, setRunStatus] = useState<
        "idle" | "submitting" | "running"
    >("idle");
    const [idCopySuccess, setIdCopySuccess] = useState<boolean>(false);
    const [modal, setModal] = useState<{
        show: boolean;
        title: string;
        body: string;
    }>({
        show: false,
        title: "",
        body: "",
    });

    interface FileState {
        file_regions_file: File | null;
        files_fasta_target_probe_database: File[];
        files_fasta_reference_database_target_probe: File[];
        files_fasta_reference_database_readout_probe: File[];
        files_fasta_reference_database_primer: File[];
    }

    const [files, setFiles] = useState<FileState>({
        file_regions_file: null,
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
        files_fasta_reference_database_readout_probe: [],
        files_fasta_reference_database_primer: [],
    });

    // Handles file input changes: updates the `files` state with selected files for a given input.
    // Parameters:
    //   e: React.ChangeEvent<HTMLInputElement> - the file input change event.
    // Logic:
    //   - For single file input ('file_regions'), stores the first file.
    //   - For multi-file inputs, stores all selected files as an array.
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: selectedFiles } = e.target;
        if (!selectedFiles) return;

        setFiles((prevFiles) => ({
            ...prevFiles,
            [name]:
                name === "file_regions"
                    ? selectedFiles[0]
                    : Array.from(selectedFiles),
        }));
    };

    // Checks if all required file inputs have at least one file uploaded.
    // Returns true if all FASTA-related file arrays have files, false otherwise.
    const areAllFilesUploaded = () => {
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

    // Asynchronously uploads all selected files to the server and collects their file paths.
    // For each file (or array of files) in the files state:
    //   - Uploads the file(s) via axios POST to /api/upload.
    //   - Collects and returns an object mapping file keys to their uploaded server file paths.
    const uploadFiles = async () => {
        const filePaths: { [key: string]: string } = {};
        console.log(files, "from the event");
        for (const key in files) {
            // @ts-ignore
            if (files[key]) {
                // @ts-ignore
                if (Array.isArray(files[key])) {
                    console.log(`Processing multiple files for key: ${key}`);
                    const paths: string[] = [];
                    // @ts-ignore
                    for (const file of files[key]) {
                        console.log(file);
                        const formDataU = new FormData();
                        formDataU.append("file", file);
                        try {
                            const response = await axios.post(
                                "http://localhost:5000/api/upload",
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
                        const formDataU = new FormData();
                        // @ts-ignore
                        formDataU.append("file", files[key]);
                        // @ts-ignore
                        console.log(
                            files[key],
                            key,
                            "what it look like not array"
                        );
                        try {
                            const response = await axios.post(
                                "http://localhost:5000/api/upload",
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
        console.log(filePaths);
        return filePaths;
    };

    // Toggles the visibility of the developer settings panel by updating the state.
    const toggleDeveloperSettings = () => {
        setShowDeveloperSettings(!showDeveloperSettings);
    };
    // Returns the content for the currently active tab.
    // Uses a switch statement to render tab-specific JSX for 'probe_sequences' or 'readout'.
    const renderTabContent = () => {
        switch (activeTab) {
            case "probe_sequences":
                return (
                    <div>
                        <div className="mb-4">
                            <div className="mb-3">
                                <label
                                    htmlFor="file_regions"
                                    className="form-label"
                                >
                                    Target File:
                                </label>
                                <div className="d-flex flex-column w-100">
                                    <div className="d-flex align-items-center w-100 gap-2">
                                        <input
                                            type="file"
                                            className="form-control visually-hidden"
                                            id="file_regions"
                                            name="file_regions_file"
                                            onChange={handleFileChange}
                                        />
                                        <div className="w-50">
                                            <input
                                                type="text"
                                                className="form-control"
                                                id="file_regions"
                                                name="file_regions"
                                                list="geneExamples"
                                                placeholder="Enter genes (comma-separated) or pick an example"
                                                onChange={handleChange}
                                                value={
                                                    formData.file_regions.value
                                                }
                                            />

                                            <datalist id="geneExamples">
                                                <option value="AARS1" />
                                                <option value="ABCC1" />
                                                <option value="BCAR1" />
                                                <option value="LOC105376749" />
                                            </datalist>
                                        </div>
                                        <div className="w-50 d-flex align-items-center">
                                            <label
                                                htmlFor="file_regions"
                                                className="btn btn-outline-primary me-2 w-100"
                                                style={{ cursor: "pointer" }}
                                            >
                                                Choose File
                                            </label>

                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-n_jobs">
                                                        <Popover.Body>
                                                            {
                                                                formData
                                                                    .file_regions
                                                                    .comment
                                                            }
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle
                                                    style={{
                                                        fontSize: "1.2rem",
                                                        cursor: "pointer",
                                                        color: "#0d6efd",
                                                        marginLeft: "10px",
                                                    }}
                                                />
                                            </OverlayTrigger>
                                        </div>
                                    </div>

                                    <div className="text-muted small mt-1">
                                        {files.file_regions_file
                                            ? `Selected: ${files.file_regions_file.name}`
                                            : "No file selected"}
                                    </div>
                                </div>

                                {/* --- Fasta Probe Database --- */}

                                <div className="mb-3">
                                    <label
                                        htmlFor="files_fasta_target_probe_database"
                                        className="form-label"
                                    >
                                        Probe Database:
                                    </label>
                                    <div className="d-flex align-items-center w-100 gap-2">
                                        <div className="w-50">
                                            <button
                                                type="button"
                                                className="btn btn-outline-primary w-100"
                                                onClick={() =>
                                                    setFastaForms((forms) => [
                                                        ...forms,
                                                        { ...defaultFastaForm },
                                                    ])
                                                }
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
                                                            {
                                                                formData
                                                                    .files_fasta_target_probe_database
                                                                    .comment
                                                            }
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle
                                                    style={{
                                                        fontSize: "1.2rem",
                                                        cursor: "pointer",
                                                        color: "#0d6efd",
                                                        marginLeft: "10px",
                                                    }}
                                                />
                                            </OverlayTrigger>
                                        </div>
                                    </div>
                                    <div className="text-muted small mt-1">
                                        {files.files_fasta_target_probe_database
                                            .length > 0
                                            ? `Selected: ${files.files_fasta_target_probe_database.map((f) => f.name).join(", ")}`
                                            : "No files selected"}
                                    </div>
                                </div>

                                {fastaOption === "generate" && (
                                    <form onSubmit={handleSubmit}>
                                        {fastaForms.map((form, idx) => (
                                            <FastaGenerateForm
                                                key={idx}
                                                form={form}
                                                onChange={(updatedForm) =>
                                                    setFastaForms((forms) =>
                                                        forms.map((f, i) =>
                                                            i === idx
                                                                ? updatedForm
                                                                : f
                                                        )
                                                    )
                                                }
                                                onRemove={() =>
                                                    setFastaForms((forms) =>
                                                        forms.length === 0
                                                            ? forms
                                                            : forms.filter(
                                                                  (_, i) =>
                                                                      i !== idx
                                                              )
                                                    )
                                                }
                                                disableRemove={
                                                    fastaForms.length === 0
                                                }
                                            />
                                        ))}
                                    </form>
                                )}

                                <div className="mb-3 pt-3">
                                    <label
                                        htmlFor="files_fasta_reference_database_target_probe"
                                        className="form-label"
                                    >
                                        Probe Reference Database:
                                    </label>
                                    <div className="d-flex align-items-center w-100 gap-2">
                                        <div className="w-50">
                                            <button
                                                type="button"
                                                className="btn btn-outline-primary w-100"
                                                onClick={() =>
                                                    setFastaFormsReference(
                                                        (forms) => [
                                                            ...forms,
                                                            {
                                                                ...defaultFastaForm,
                                                            },
                                                        ]
                                                    )
                                                }
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
                                                            {
                                                                formData
                                                                    .files_fasta_reference_database_target_probe
                                                                    .comment
                                                            }
                                                        </Popover.Body>
                                                    </Popover>
                                                }
                                            >
                                                <InfoCircle
                                                    style={{
                                                        fontSize: "1.2rem",
                                                        cursor: "pointer",
                                                        color: "#0d6efd",
                                                        marginLeft: "10px",
                                                    }}
                                                />
                                            </OverlayTrigger>
                                        </div>
                                    </div>
                                    <div className="text-muted small mt-1">
                                        {files
                                            .files_fasta_reference_database_target_probe
                                            .length > 0
                                            ? `Selected: ${files.files_fasta_reference_database_target_probe.map((f) => f.name).join(", ")}`
                                            : "No files selected"}
                                    </div>
                                </div>
                                {/* FASTA generation form for Probe Reference Database */}
                                {fastaOption2 === "generate" && (
                                    <form onSubmit={handleSubmit}>
                                        {fastaFormsReference.map(
                                            (form, idx) => (
                                                <FastaGenerateForm
                                                    key={idx}
                                                    form={form}
                                                    onChange={(updatedForm) =>
                                                        setFastaFormsReference(
                                                            (forms) =>
                                                                forms.map(
                                                                    (f, i) =>
                                                                        i ===
                                                                        idx
                                                                            ? updatedForm
                                                                            : f
                                                                )
                                                        )
                                                    }
                                                    onRemove={() =>
                                                        setFastaFormsReference(
                                                            (forms) =>
                                                                forms.length ===
                                                                0
                                                                    ? forms
                                                                    : forms.filter(
                                                                          (
                                                                              _,
                                                                              i
                                                                          ) =>
                                                                              i !==
                                                                              idx
                                                                      )
                                                        )
                                                    }
                                                    disableRemove={
                                                        fastaFormsReference.length ===
                                                        0
                                                    }
                                                />
                                            )
                                        )}
                                    </form>
                                )}
                            </div>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="top_n_sets" className="form-label">
                                Maximum Number of Sets:
                            </label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="number"
                                    className="form-control"
                                    id="top_n_sets"
                                    name="top_n_sets"
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
                                            marginLeft: "10px",
                                        }}
                                    />
                                </OverlayTrigger>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="probe_length_min"
                                    className="form-label"
                                >
                                    Min Probe Length:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probe_length_min"
                                        name="target_probe_length_min"
                                        value={
                                            formData.target_probe_length_min
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_length_min
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="probe_length_max"
                                    className="form-label"
                                >
                                    Max Probe Length:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probe_length_max"
                                        name="target_probe_length_max"
                                        value={
                                            formData.target_probe_length_max
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_length_max
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label
                                    htmlFor="probe_isoform_consensus"
                                    className="form-label"
                                >
                                    Isoform Consensus (%):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probe_isoform_consensus"
                                        name="target_probe_isoform_consensus"
                                        value={
                                            formData
                                                .target_probe_isoform_consensus
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_isoform_consensus
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="probe_GC_content_min"
                                    className="form-label"
                                >
                                    Min GC Content (%):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probe_GC_content_min"
                                        name="target_probe_GC_content_min"
                                        value={
                                            formData.target_probe_GC_content_min
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="probe_GC_content_min">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_GC_content_min
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="probe_GC_content_opt"
                                    className="form-label"
                                >
                                    Optimal GC Content (%):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probe_GC_content_opt"
                                        name="target_probe_GC_content_opt"
                                        value={
                                            formData.target_probe_GC_content_opt
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="probe_GC_content_opt">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_GC_content_opt
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="probe_GC_content_max"
                                    className="form-label"
                                >
                                    Max GC Content (%):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probe_GC_content_max"
                                        name="target_probe_GC_content_max"
                                        value={
                                            formData.target_probe_GC_content_max
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-probe_GC_content_max">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_GC_content_max
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <h6 className="pt-2">
                            Minimum number of nucleotides to consider it a
                            homopolymeric run per base{" "}
                        </h6>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="homopolymeric_A"
                                    className="form-label"
                                >
                                    A:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="homopolymeric_A"
                                        name="target_probe_homopolymeric_base_n.A"
                                        value={
                                            formData
                                                .target_probe_homopolymeric_base_n
                                                .A.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_homopolymeric_base_n
                                                            .A.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="homopolymeric_T"
                                    className="form-label"
                                >
                                    T:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="homopolymeric_T"
                                        name="target_probe_homopolymeric_base_n.T"
                                        value={
                                            formData
                                                .target_probe_homopolymeric_base_n
                                                .T.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_homopolymeric_base_n
                                                            .T.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="homopolymeric_C"
                                    className="form-label"
                                >
                                    C:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_homopolymeric_base_n.C"
                                        name="target_probe_homopolymeric_base_n.C"
                                        value={
                                            formData
                                                .target_probe_homopolymeric_base_n
                                                .C.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_homopolymeric_base_n
                                                            .C.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="homopolymeric_G"
                                    className="form-label"
                                >
                                    G:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="homopolymeric_G"
                                        name="target_probe_homopolymeric_base_n.G"
                                        value={
                                            formData
                                                .target_probe_homopolymeric_base_n
                                                .G.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_homopolymeric_base_n
                                                            .G.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <div className="col">
                                    <label
                                        htmlFor="target_probe_secondary_structures_threshold_deltaG"
                                        className="form-label"
                                    >
                                        Threshold for secondary structure:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="target_probe_T_secondary_structure"
                                            name="target_probe_secondary_structures_T"
                                            value={
                                                formData
                                                    .target_probe_T_secondary_structure
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .target_probe_T_secondary_structure
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="target_probe_secondary_structures_threshold_deltaG"
                                    className="form-label"
                                >
                                    Threshold for secondary structure:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_secondary_structures_threshold_deltaG"
                                        name="target_probe_secondary_structures_threshold_deltaG"
                                        value={
                                            formData
                                                .target_probe_secondary_structures_threshold_deltaG
                                                .value
                                        }
                                        onChange={handleChange}
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_secondary_structures_threshold_deltaG
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>

                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="probe_GC_weight"
                                    className="form-label"
                                >
                                    GC Content Weight:
                                </label>

                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probe_GC_weight"
                                        name="target_probe_GC_weight"
                                        value={
                                            formData.target_probe_GC_weight
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_GC_weight
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="probeset_size_min"
                                    className="form-label"
                                >
                                    Minimum Probe Set Size:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probeset_size_min"
                                        name="set_size_min"
                                        value={formData.set_size_min.value}
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData.set_size_opt
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="probeset_size_opt"
                                    className="form-label"
                                >
                                    Optimal Probe Set Size:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="probeset_size_opt"
                                        name="set_size_opt"
                                        value={formData.set_size_opt.value}
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData.set_size_opt
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="distance_between_probes"
                                    className="form-label"
                                >
                                    Distance Between Probes:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="distance_between_probes"
                                        name="distance_between_target_probes"
                                        value={
                                            formData
                                                .distance_between_target_probes
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .distance_between_target_probes
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label htmlFor="n_sets" className="form-label">
                                    Maximum Number of Sets:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="n_sets"
                                        name="n_sets"
                                        value={formData.n_sets.value}
                                        onChange={handleChange}
                                        required
                                    />
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
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case "readout":
                return (
                    <div className="mb-4">
                        <div className="mb-3">
                            <label
                                htmlFor="files_fasta_reference_database_readout_probe"
                                className="form-label"
                            >
                                Fasta Probe Readout Database:
                            </label>
                            <div className="d-flex align-items-center w-100 gap-2">
                                <div className="w-50">
                                    <button
                                        type="button"
                                        className="btn btn-outline-primary w-100"
                                        onClick={() =>
                                            setFastaFormsReadout((forms) => [
                                                ...forms,
                                                { ...defaultFastaForm },
                                            ])
                                        }
                                    >
                                        Generate FASTA+
                                    </button>
                                </div>
                                <div className="w-50 d-flex align-items-center">
                                    <input
                                        type="file"
                                        className="form-control visually-hidden"
                                        id="files_fasta_reference_database_readout_probe"
                                        name="files_fasta_reference_database_readout_probe"
                                        onChange={handleFileChange}
                                        multiple
                                    />
                                    <label
                                        htmlFor="files_fasta_reference_database_readout_probe"
                                        className="btn btn-outline-primary me-2 w-100"
                                    >
                                        Choose File
                                    </label>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-files_fasta_reference_database_readout_probe">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .files_fasta_reference_database_readout_probe
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="text-muted small mt-1">
                                {files.files_fasta_reference_database_readout_probe &&
                                files
                                    .files_fasta_reference_database_readout_probe
                                    .length > 0
                                    ? `Selected: ${files.files_fasta_reference_database_readout_probe.map((f) => f.name).join(", ")}`
                                    : "No files selected"}
                            </div>
                            <form onSubmit={handleSubmit}>
                                {fastaFormsReadout.map((form, idx) => (
                                    <FastaGenerateForm
                                        key={idx}
                                        form={form}
                                        onChange={(updatedForm) =>
                                            setFastaFormsReadout((forms) =>
                                                forms.map((f, i) =>
                                                    i === idx ? updatedForm : f
                                                )
                                            )
                                        }
                                        onRemove={() =>
                                            setFastaFormsReadout((forms) =>
                                                forms.length === 0
                                                    ? forms
                                                    : forms.filter(
                                                          (_, i) => i !== idx
                                                      )
                                            )
                                        }
                                        disableRemove={
                                            fastaFormsReadout.length === 0
                                        }
                                    />
                                ))}
                            </form>
                        </div>
                        <div className="mb-3">
                            <label
                                htmlFor="readout_probe_length"
                                className="form-label"
                            >
                                Length of readout probes:
                            </label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="number"
                                    className="form-control"
                                    id="readout_probe_length"
                                    name="readout_probe_length"
                                    value={formData.readout_probe_length.value}
                                    onChange={handleChange}
                                    required
                                />
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {
                                                    formData
                                                        .readout_probe_length
                                                        .comment
                                                }
                                            </Popover.Body>
                                        </Popover>
                                    }
                                >
                                    <InfoCircle
                                        style={{
                                            fontSize: "1.2rem",
                                            cursor: "pointer",
                                            color: "#0d6efd",
                                            marginLeft: "10px",
                                        }}
                                    />
                                </OverlayTrigger>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="readout_probe_base_prob_a"
                                    className="form-label"
                                >
                                    Probability of base A:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="readout_probe_base_probabilities.A"
                                        name="readout_probe_base_probabilities.A"
                                        value={
                                            formData
                                                .readout_probe_base_probabilities
                                                .A.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .readout_probe_base_probabilities
                                                            .A.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="readout_probe_base_prob_c"
                                    className="form-label"
                                >
                                    Probability of base C:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="readout_probe_base_probabilities.C"
                                        name="readout_probe_base_probabilities.C"
                                        value={
                                            formData
                                                .readout_probe_base_probabilities
                                                .C.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .readout_probe_base_probabilities
                                                            .C.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="readout_probe_base_prob_g"
                                    className="form-label"
                                >
                                    Probability of base A:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="readout_probe_base_probabilities.G"
                                        name="readout_probe_base_probabilities.G"
                                        value={
                                            formData
                                                .readout_probe_base_probabilities
                                                .G.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .readout_probe_base_probabilities
                                                            .G.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="readout_probe_base_prob_t"
                                    className="form-label"
                                >
                                    Probability of base A:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="readout_probe_base_probabilities.T"
                                        name="readout_probe_base_probabilities.T"
                                        value={
                                            formData
                                                .readout_probe_base_probabilities
                                                .T.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .readout_probe_base_probabilities
                                                            .T.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="readout_probe_GC_content_min"
                                    className="form-label"
                                >
                                    Minimum GC content:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="readout_probe_GC_content_min"
                                        name="readout_probe_GC_content_min"
                                        value={
                                            formData
                                                .readout_probe_GC_content_min
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-gc-min">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .readout_probe_GC_content_min
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label
                                    htmlFor="readout_probe_GC_content_max"
                                    className="form-label"
                                >
                                    Maximum GC content:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="readout_probe_GC_content_max"
                                        name="readout_probe_GC_content_max"
                                        value={
                                            formData
                                                .readout_probe_GC_content_max
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-gc-max">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .readout_probe_GC_content_max
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>

                        <div className="mb-3">
                            <label
                                htmlFor="readout_probe_homopolymeric_base_n_g"
                                className="form-label"
                            >
                                Minimum number of Nucleotides:
                            </label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="number"
                                    className="form-control"
                                    id="readout_probe_homopolymeric_base_n.G"
                                    name="readout_probe_homopolymeric_base_n.G"
                                    value={
                                        formData
                                            .readout_probe_homopolymeric_base_n
                                            .G.value
                                    }
                                    onChange={handleChange}
                                    required
                                />
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {
                                                    formData
                                                        .readout_probe_homopolymeric_base_n
                                                        .G.comment
                                                }
                                            </Popover.Body>
                                        </Popover>
                                    }
                                >
                                    <InfoCircle
                                        style={{
                                            fontSize: "1.2rem",
                                            cursor: "pointer",
                                            color: "#0d6efd",
                                            marginLeft: "10px",
                                        }}
                                    />
                                </OverlayTrigger>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="channels_ids"
                                    className="form-label"
                                >
                                    Channel IDs:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="channels_ids"
                                        name="channels_ids"
                                        value={formData.channels_ids.value}
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData.channels_ids
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="mb-3">
                            <label
                                htmlFor="n_barcode_rounds"
                                className="form-label"
                            >
                                Barcode Rounds:
                            </label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="number"
                                    className="form-control"
                                    id="n_barcode_rounds"
                                    name="n_barcode_rounds"
                                    value={formData.n_barcode_rounds.value}
                                    onChange={handleChange}
                                    required
                                />
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover>
                                            <Popover.Body>
                                                {
                                                    formData.n_barcode_rounds
                                                        .comment
                                                }
                                            </Popover.Body>
                                        </Popover>
                                    }
                                >
                                    <InfoCircle
                                        className="ms-2"
                                        style={{
                                            fontSize: "1.2rem",
                                            color: "#0d6efd",
                                            cursor: "pointer",
                                        }}
                                    />
                                </OverlayTrigger>
                            </div>
                        </div>

                        {/* Pseudocolors */}
                        <div className="mb-3">
                            <label
                                htmlFor="n_pseudocolors"
                                className="form-label"
                            >
                                Pseudocolors:
                            </label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="number"
                                    className="form-control"
                                    id="n_pseudocolors"
                                    name="n_pseudocolors"
                                    value={formData.n_pseudocolors.value}
                                    onChange={handleChange}
                                    required
                                />
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover>
                                            <Popover.Body>
                                                {
                                                    formData.n_pseudocolors
                                                        .comment
                                                }
                                            </Popover.Body>
                                        </Popover>
                                    }
                                >
                                    <InfoCircle
                                        className="ms-2"
                                        style={{
                                            fontSize: "1.2rem",
                                            color: "#0d6efd",
                                            cursor: "pointer",
                                        }}
                                    />
                                </OverlayTrigger>
                            </div>
                        </div>

                        {/* Channel IDs */}
                        <div className="mb-3">
                            <label
                                htmlFor="channels_ids"
                                className="form-label"
                            >
                                Channel IDs:
                            </label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="text"
                                    className="form-control"
                                    id="channels_ids"
                                    name="channels_ids"
                                    value={formData.channels_ids.value}
                                    onChange={handleChange}
                                    placeholder="Comma-separated channel names"
                                    required
                                />
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover>
                                            <Popover.Body>
                                                {formData.channels_ids.comment}
                                            </Popover.Body>
                                        </Popover>
                                    }
                                >
                                    <InfoCircle
                                        className="ms-2"
                                        style={{
                                            fontSize: "1.2rem",
                                            color: "#0d6efd",
                                            cursor: "pointer",
                                        }}
                                    />
                                </OverlayTrigger>
                            </div>
                        </div>
                    </div>
                );

            case "primer_parameters":
                return (
                    <div>
                        <div className="mb-4">
                            <div className="mb-3">
                                <label
                                    htmlFor="files_fasta_reference_database_primer"
                                    className="form-label"
                                >
                                    Probe Primer Reference Database:
                                </label>
                                <div className="d-flex align-items-center w-100 gap-2">
                                    {/* Left: Generate FASTA+ button */}
                                    <div className="w-50">
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary w-100"
                                            onClick={() =>
                                                setFastaFormsPrimer((forms) => [
                                                    ...forms,
                                                    { ...defaultFastaForm },
                                                ])
                                            }
                                        >
                                            Generate FASTA+
                                        </button>
                                    </div>
                                    {/* Right: File input, always enabled */}
                                    <div className="w-50 d-flex align-items-center">
                                        <input
                                            type="file"
                                            className="form-control visually-hidden"
                                            id="files_fasta_reference_database_primer"
                                            name="files_fasta_reference_database_primer"
                                            onChange={handleFileChange}
                                            multiple
                                        />
                                        <label
                                            htmlFor="files_fasta_reference_database_primer"
                                            className="btn btn-outline-primary me-2 w-100"
                                        >
                                            Choose File
                                        </label>
                                        {/* Info icon with popover */}
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-files_fasta_reference_database_primer">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .files_fasta_reference_database_primer
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                                {/* Display selected file names */}
                                <div className="text-muted small mt-1">
                                    {files.files_fasta_reference_database_primer
                                        .length > 0
                                        ? `Selected: ${files.files_fasta_reference_database_primer.map((f) => f.name).join(", ")}`
                                        : "No files selected"}
                                </div>
                                {/* FASTA generation forms */}
                                <form onSubmit={handleSubmit}>
                                    {fastaFormsPrimer.map((form, idx) => (
                                        <FastaGenerateForm
                                            key={idx}
                                            form={form}
                                            onChange={(updatedForm) =>
                                                setFastaFormsPrimer((forms) =>
                                                    forms.map((f, i) =>
                                                        i === idx
                                                            ? updatedForm
                                                            : f
                                                    )
                                                )
                                            }
                                            onRemove={() =>
                                                setFastaFormsPrimer((forms) =>
                                                    forms.length === 0
                                                        ? forms
                                                        : forms.filter(
                                                              (_, i) =>
                                                                  i !== idx
                                                          )
                                                )
                                            }
                                            disableRemove={
                                                fastaFormsPrimer.length === 0
                                            }
                                        />
                                    ))}
                                </form>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="reverse_primer_sequence"
                                        className="form-label"
                                    >
                                        Reverse Primer Sequence:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="reverse_primer_sequence"
                                            name="reverse_primer_sequence"
                                            value={
                                                formData.reverse_primer_sequence
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-reverse-primer">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .reverse_primer_sequence
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="primer_length"
                                        className="form-label"
                                    >
                                        Primer Length:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_length"
                                            name="primer_length"
                                            value={formData.primer_length.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-primer-length">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_length
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="primer_base_probabilities_a"
                                        className="form-label"
                                    >
                                        Probability of Base A:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_base_probabilities.A"
                                            name="primer_base_probabilities.A"
                                            value={
                                                formData
                                                    .primer_base_probabilities.A
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-a">
                                                    <Popover.Header as="h3">
                                                        Base A Probability
                                                    </Popover.Header>
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_base_probabilities
                                                                .A.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="primer_base_probabilities_c"
                                        className="form-label"
                                    >
                                        Probability of Base C:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_base_probabilities.C"
                                            name="primer_base_probabilities.C"
                                            value={
                                                formData
                                                    .primer_base_probabilities.C
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-c">
                                                    <Popover.Header as="h3">
                                                        Base C Probability
                                                    </Popover.Header>
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_base_probabilities
                                                                .C.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="primer_base_probabilities_g"
                                        className="form-label"
                                    >
                                        Probability of Base G:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_base_probabilities.G"
                                            name="primer_base_probabilities.G"
                                            value={
                                                formData
                                                    .primer_base_probabilities.G
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-g">
                                                    <Popover.Header as="h3">
                                                        Base G Probability
                                                    </Popover.Header>
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_base_probabilities
                                                                .G.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="primer_base_probabilities_t"
                                        className="form-label"
                                    >
                                        Probability of Base T:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_base_probabilities.T"
                                            name="primer_base_probabilities.T"
                                            value={
                                                formData
                                                    .primer_base_probabilities.T
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-t">
                                                    <Popover.Header as="h3">
                                                        Base T Probability
                                                    </Popover.Header>
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_base_probabilities
                                                                .T.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="primer_GC_content_min"
                                        className="form-label"
                                    >
                                        Min GC Content:
                                    </label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_GC_content_min"
                                        name="primer_GC_content_min"
                                        value={
                                            formData.primer_GC_content_min.value
                                        }
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="col">
                                    <label
                                        htmlFor="primer_GC_content_max"
                                        className="form-label"
                                    >
                                        Max GC Content:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_GC_content_max"
                                            name="primer_GC_content_max"
                                            value={
                                                formData.primer_GC_content_max
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_GC_content_max
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="primer_number_GC_GCclamp"
                                        className="form-label"
                                    >
                                        GC Clamp (GC Count):
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_number_GC_GCclamp"
                                            name="primer_number_GC_GCclamp"
                                            value={
                                                formData
                                                    .primer_number_GC_GCclamp
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_number_GC_GCclamp
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                                <div className="col">
                                    <label
                                        htmlFor="primer_number_three_prime_base_GCclamp"
                                        className="form-label"
                                    >
                                        3' Base GC Clamp Count:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_number_three_prime_base_GCclamp"
                                            name="primer_number_three_prime_base_GCclamp"
                                            value={
                                                formData
                                                    .primer_number_three_prime_base_GCclamp
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_number_three_prime_base_GCclamp
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col-md-3">
                                    <label
                                        htmlFor="primer_homopolymeric_base_n_a"
                                        className="form-label"
                                    >
                                        Homopolymeric A:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_homopolymeric_base_n.A"
                                            name="primer_homopolymeric_base_n.A"
                                            value={
                                                formData
                                                    .primer_homopolymeric_base_n
                                                    .A.value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-a">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_homopolymeric_base_n
                                                                .A.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <label
                                        htmlFor="primer_homopolymeric_base_n_t"
                                        className="form-label"
                                    >
                                        Homopolymeric T:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_homopolymeric_base_n.T"
                                            name="primer_homopolymeric_base_n.T"
                                            value={
                                                formData
                                                    .primer_homopolymeric_base_n
                                                    .T.value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-t">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_homopolymeric_base_n
                                                                .T.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <label
                                        htmlFor="primer_homopolymeric_base_n_c"
                                        className="form-label"
                                    >
                                        Homopolymeric C:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_homopolymeric_base_n.C"
                                            name="primer_homopolymeric_base_n.C"
                                            value={
                                                formData
                                                    .primer_homopolymeric_base_n
                                                    .C.value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-c">
                                                    <Popover.Header as="h3">
                                                        Homopolymeric C
                                                    </Popover.Header>
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_homopolymeric_base_n
                                                                .C.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <label
                                        htmlFor="primer_homopolymeric_base_n_g"
                                        className="form-label"
                                    >
                                        Homopolymeric G:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_homopolymeric_base_n.G"
                                            name="primer_homopolymeric_base_n.G"
                                            value={
                                                formData
                                                    .primer_homopolymeric_base_n
                                                    .G.value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-g">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_homopolymeric_base_n
                                                                .G.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="primer_max_len_selfcomplement"
                                        className="form-label"
                                    >
                                        Max Self-Complementary Length:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_max_len_selfcomplement"
                                            name="primer_max_len_selfcomplement"
                                            value={
                                                formData
                                                    .primer_max_len_selfcomplement
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-selfcomplement">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_max_len_selfcomplement
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="primer_max_len_complement_reverse_primer"
                                        className="form-label"
                                    >
                                        Max Complement Reverse Primer Length:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_max_len_complement_reverse_primer"
                                            name="primer_max_len_complement_reverse_primer"
                                            value={
                                                formData
                                                    .primer_max_len_complement_reverse_primer
                                                    .value
                                            }
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-reverse-complement">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_max_len_complement_reverse_primer
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="primer_Tm_min"
                                        className="form-label"
                                    >
                                        Min Primer Tm (°C):
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_Tm_min"
                                            name="primer_Tm_min"
                                            value={formData.primer_Tm_min.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-tm-min">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_Tm_min
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="primer_Tm_max"
                                        className="form-label"
                                    >
                                        Max Primer Tm (°C):
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_Tm_max"
                                            name="primer_Tm_max"
                                            value={formData.primer_Tm_max.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-tm-max">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .primer_Tm_max
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="primer_T_secondary_structure"
                                    className="form-label"
                                >
                                    Secondary Structure Temperature (°C):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_T_secondary_structure"
                                        name="primer_T_secondary_structure"
                                        value={
                                            formData
                                                .primer_T_secondary_structure
                                                .value
                                        }
                                        onChange={handleChange}
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_T_secondary_structure
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="primer_secondary_structures_threshold_deltaG"
                                    className="form-label"
                                >
                                    Threshold Delta G:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_secondary_structures_threshold_deltaG"
                                        name="primer_secondary_structures_threshold_deltaG"
                                        value={
                                            formData
                                                .primer_secondary_structures_threshold_deltaG
                                                .value
                                        }
                                        onChange={handleChange}
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_secondary_structures_threshold_deltaG
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
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
                                <label
                                    htmlFor="specificity_perc_identity"
                                    className="form-label"
                                >
                                    Percent Identity:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_specificity_blastn_search_parameters.perc_identity"
                                        name="target_probe_specificity_blastn_search_parameters.perc_identity"
                                        value={
                                            formData
                                                .target_probe_specificity_blastn_search_parameters
                                                .perc_identity.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_specificity_blastn_search_parameters
                                                            .perc_identity
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="specificity_strand"
                                    className="form-label"
                                >
                                    Strand
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="target_probe_specificity_blastn_search_parameters.strand"
                                        name="target_probe_specificity_blastn_search_parameters.strand"
                                        value={
                                            formData
                                                .target_probe_specificity_blastn_search_parameters
                                                .strand.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_specificity_blastn_search_parameters
                                                            .strand.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="specificity_word_size"
                                    className="form-label"
                                >
                                    Word Size:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_specificity_blastn_search_parameters.word_size"
                                        name="target_probe_specificity_blastn_search_parameters.word_size"
                                        value={
                                            formData
                                                .target_probe_specificity_blastn_search_parameters
                                                .word_size.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_specificity_blastn_search_parameters
                                                            .word_size.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="specificity_dust"
                                    className="form-label"
                                >
                                    Dust:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="target_probe_specificity_blastn_search_parameters.dust"
                                        name="target_probe_specificity_blastn_search_parameters.dust"
                                        value={
                                            formData
                                                .target_probe_specificity_blastn_search_parameters
                                                .dust.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_specificity_blastn_search_parameters
                                                            .dust.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="specificity_soft_masking"
                                    className="form-label"
                                >
                                    Soft Masking:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="target_probe_specificity_blastn_search_parameters.soft_masking"
                                        name="target_probe_specificity_blastn_search_parameters.soft_masking"
                                        value={
                                            formData
                                                .target_probe_specificity_blastn_search_parameters
                                                .soft_masking.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_specificity_blastn_search_parameters
                                                            .soft_masking
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="specificity_max_target_seqs"
                                    className="form-label"
                                >
                                    Max Target Sequences:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_specificity_blastn_search_parameters.max_target_seqs"
                                        name="target_probe_specificity_blastn_search_parameters.max_target_seqs"
                                        value={
                                            formData
                                                .target_probe_specificity_blastn_search_parameters
                                                .max_target_seqs.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_specificity_blastn_search_parameters
                                                            .max_target_seqs
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="specificity_max_hsps"
                                    className="form-label"
                                >
                                    Max HSPs:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_specificity_blastn_search_parameters.max_hsps"
                                        name="target_probe_specificity_blastn_search_parameters.max_hsps"
                                        value={
                                            formData
                                                .target_probe_specificity_blastn_search_parameters
                                                .max_hsps.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_specificity_blastn_search_parameters
                                                            .max_hsps.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="specificity_coverage"
                                    className="form-label"
                                >
                                    Coverage: (Specificity_blastn_hit_parameter)
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length"
                                        name="target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length"
                                        value={
                                            formData
                                                .target_probe_cross_hybridization_blastn_hit_parameters
                                                .min_alignment_length.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_cross_hybridization_blastn_hit_parameters
                                                            .min_alignment_length
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case "crossfilterblastn":
                return (
                    <div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label
                                    htmlFor="crosshybridization_perc_identity"
                                    className="form-label"
                                >
                                    Percent Identity:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_cross_hybridization_blastn_search_parameters.perc_identity"
                                        name="target_probe_cross_hybridization_blastn_search_parameters.perc_identity"
                                        value={
                                            formData
                                                .target_probe_cross_hybridization_blastn_search_parameters
                                                .perc_identity.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_cross_hybridization_blastn_search_parameters
                                                            .perc_identity
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="crosshybridization_strand"
                                    className="form-label"
                                >
                                    Strand:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="target_probe_cross_hybridization_blastn_search_parameters.strand"
                                        name="target_probe_cross_hybridization_blastn_search_parameters.strand"
                                        value={
                                            formData
                                                .target_probe_cross_hybridization_blastn_search_parameters
                                                .strand.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_cross_hybridization_blastn_search_parameters
                                                            .strand.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="crosshybridization_word_size"
                                    className="form-label"
                                >
                                    Word Size:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_cross_hybridization_blastn_search_parameters.word_size"
                                        name="target_probe_cross_hybridization_blastn_search_parameters.word_size"
                                        value={
                                            formData
                                                .target_probe_cross_hybridization_blastn_search_parameters
                                                .word_size.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_cross_hybridization_blastn_search_parameters
                                                            .word_size.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="crosshybridization_dust"
                                    className="form-label"
                                >
                                    Dust:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="target_probe_cross_hybridization_blastn_search_parameters.dust"
                                        name="target_probe_cross_hybridization_blastn_search_parameters.dust"
                                        value={
                                            formData
                                                .target_probe_cross_hybridization_blastn_search_parameters
                                                .dust.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_cross_hybridization_blastn_search_parameters
                                                            .dust.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="crosshybridization_soft_masking"
                                    className="form-label"
                                >
                                    Soft Masking:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="target_probe_cross_hybridization_blastn_search_parameters.soft_masking"
                                        name="target_probe_cross_hybridization_blastn_search_parameters.soft_masking"
                                        value={
                                            formData
                                                .target_probe_cross_hybridization_blastn_search_parameters
                                                .soft_masking.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_cross_hybridization_blastn_search_parameters
                                                            .soft_masking
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="crosshybridization_max_target_seqs"
                                    className="form-label"
                                >
                                    Max Target Sequences:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_cross_hybridization_blastn_search_parameters.max_target_seqs"
                                        name="target_probe_cross_hybridization_blastn_search_parameters.max_target_seqs"
                                        value={
                                            formData
                                                .target_probe_cross_hybridization_blastn_search_parameters
                                                .max_target_seqs.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_cross_hybridization_blastn_search_parameters
                                                            .max_target_seqs
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="crosshybridization_coverage"
                                    className="form-label"
                                >
                                    Coverage:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length"
                                        name="target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length"
                                        value={
                                            formData
                                                .target_probe_cross_hybridization_blastn_hit_parameters
                                                .min_alignment_length.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .target_probe_cross_hybridization_blastn_hit_parameters
                                                            .min_alignment_length
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case "oligosetselection":
                return (
                    <div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label
                                    htmlFor="max_graph_size"
                                    className="form-label"
                                >
                                    Max Graph Size:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="max_graph_size"
                                        name="max_graph_size"
                                        value={formData.max_graph_size.value}
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData.max_graph_size
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="n_attempts"
                                    className="form-label"
                                >
                                    Number of Attempts:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="n_attempts"
                                        name="n_attempts"
                                        value={formData.n_attempts.value}
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData.n_attempts
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="heuristic"
                                    className="form-label"
                                >
                                    Heuristic:
                                </label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-control"
                                        id="heuristic"
                                        name="heuristic"
                                        value={formData.heuristic.value}
                                        onChange={handleChange}
                                    >
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
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label
                                    htmlFor="heuristic_n_attempts"
                                    className="form-label"
                                >
                                    {" "}
                                    Heuristics number of Attempts:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="heuristic_n_attempts"
                                        name="heuristic_n_attempts"
                                        value={
                                            formData.heuristic_n_attempts.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .heuristic_n_attempts
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case "readout":
                return (
                    <div>
                        <div className="mb-4">
                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="readout_probe_initial_num_sequences"
                                        className="form-label"
                                    >
                                        Initial Number of Sequences:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="readout_probe_initial_num_sequences"
                                            name="readout_probe_initial_num_sequences"
                                            value={
                                                formData
                                                    .readout_probe_initial_num_sequences
                                                    .value
                                            }
                                            onChange={handleChange}
                                            required
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-initial-sequences">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_initial_num_sequences
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="perc_identity"
                                        className="form-label"
                                    >
                                        Percentage Identity:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="readout_probe_specificity_blastn_search_parameters.perc_identity"
                                            name="readout_probe_specificity_blastn_search_parameters.perc_identity"
                                            value={
                                                formData
                                                    .readout_probe_specificity_blastn_search_parameters
                                                    .perc_identity.value
                                            }
                                            onChange={handleChange}
                                            required
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-perc-identity">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_specificity_blastn_search_parameters
                                                                .perc_identity
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="strand"
                                        className="form-label"
                                    >
                                        Strand:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <select
                                            className="form-select"
                                            id="strand"
                                            name="readout_probe_specificity_blastn_search_parameters.strand"
                                            value={
                                                formData
                                                    .readout_probe_specificity_blastn_search_parameters
                                                    .strand.value
                                            }
                                            onChange={handleChange}
                                        >
                                            <option value="minus">Minus</option>
                                            <option value="plus">Plus</option>
                                        </select>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-strand">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_specificity_blastn_search_parameters
                                                                .strand.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="word_size"
                                        className="form-label"
                                    >
                                        Word Size:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="word_size"
                                            name="readout_probe_specificity_blastn_search_parameters.word_size"
                                            value={
                                                formData
                                                    .readout_probe_specificity_blastn_search_parameters
                                                    .word_size.value
                                            }
                                            onChange={handleChange}
                                            required
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-word-size">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_specificity_blastn_search_parameters
                                                                .word_size
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="dust"
                                        className="form-label"
                                    >
                                        Dust:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <select
                                            className="form-select"
                                            id="readout_probe_specificity_blastn_search_parameters.dust"
                                            name="readout_probe_specificity_blastn_search_parameters.dust"
                                            value={
                                                formData
                                                    .readout_probe_specificity_blastn_search_parameters
                                                    .dust.value
                                            }
                                            onChange={handleChange}
                                        >
                                            <option value="no">No</option>
                                            <option value="yes">Yes</option>
                                        </select>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dust">
                                                    <Popover.Header as="h3">
                                                        Dust Filtering
                                                    </Popover.Header>
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_specificity_blastn_search_parameters
                                                                .dust.comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="soft_masking"
                                        className="form-label"
                                    >
                                        Soft Masking:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <select
                                            className="form-select"
                                            id="soft_masking"
                                            name="readout_probe_specificity_blastn_search_parameters.soft_masking"
                                            value={
                                                formData
                                                    .readout_probe_specificity_blastn_search_parameters
                                                    .soft_masking.value
                                            }
                                            onChange={handleChange}
                                        >
                                            <option value="false">False</option>
                                            <option value="true">True</option>
                                        </select>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-soft-masking">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_specificity_blastn_search_parameters
                                                                .soft_masking
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col">
                                    <label
                                        htmlFor="max_target_seqs"
                                        className="form-label"
                                    >
                                        Max Target Sequences:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="max_target_seqs"
                                            name="readout_probe_specificity_blastn_search_parameters.max_target_seqs"
                                            value={
                                                formData
                                                    .readout_probe_specificity_blastn_search_parameters
                                                    .max_target_seqs.value
                                            }
                                            onChange={handleChange}
                                            required
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-max-target-seqs">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_specificity_blastn_search_parameters
                                                                .max_target_seqs
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>

                                <div className="col">
                                    <label
                                        htmlFor="max_hsps"
                                        className="form-label"
                                    >
                                        Max HSPs:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="max_hsps"
                                            name="readout_probe_specificity_blastn_search_parameters.max_hsps"
                                            value={
                                                formData
                                                    .readout_probe_specificity_blastn_search_parameters
                                                    .max_hsps.value
                                            }
                                            onChange={handleChange}
                                            required
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-max-hsps">
                                                    <Popover.Header as="h3">
                                                        Maximum HSPs
                                                    </Popover.Header>
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_specificity_blastn_search_parameters
                                                                .max_hsps
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4>Readout Probe BLASTn Hit Parameters</h4>
                                <div className="mb-3">
                                    <label
                                        htmlFor="min_alignment_length"
                                        className="form-label"
                                    >
                                        Min Alignment Length:
                                    </label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="readout_probe_specificity_blastn_hit_parameters.min_alignment_length"
                                            name="readout_probe_specificity_blastn_hit_parameters.min_alignment_length"
                                            value={
                                                formData
                                                    .readout_probe_specificity_blastn_hit_parameters
                                                    .min_alignment_length.value
                                            }
                                            onChange={handleChange}
                                            required
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-min-alignment">
                                                    <Popover.Body>
                                                        {
                                                            formData
                                                                .readout_probe_specificity_blastn_hit_parameters
                                                                .min_alignment_length
                                                                .comment
                                                        }
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px",
                                                }}
                                            />
                                        </OverlayTrigger>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case "primerpro":
                return (
                    <div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="primer_initial_num_sequences"
                                    className="form-label"
                                >
                                    Initial Number of Sequences:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_initial_num_sequences"
                                        name="primer_initial_num_sequences"
                                        value={
                                            formData
                                                .primer_initial_num_sequences
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-initial-sequences">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_initial_num_sequences
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="perc_identity"
                                    className="form-label"
                                >
                                    Percentage Identity:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="perc_identity"
                                        name="primer_specificity_refrence_blastn_search_parameters.perc_identity"
                                        value={
                                            formData
                                                .primer_specificity_refrence_blastn_search_parameters
                                                .perc_identity.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-perc-identity">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_refrence_blastn_search_parameters
                                                            .perc_identity
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label htmlFor="strand" className="form-label">
                                    Strand:
                                </label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-select"
                                        id="strand"
                                        name="primer_specificity_refrence_blastn_search_parameters.strand"
                                        value={
                                            formData
                                                .primer_specificity_refrence_blastn_search_parameters
                                                .strand.value
                                        }
                                        onChange={handleChange}
                                    >
                                        <option value="minus">Minus</option>
                                        <option value="plus">Plus</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-strand">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_refrence_blastn_search_parameters
                                                            .strand.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="word_size"
                                    className="form-label"
                                >
                                    Word Size:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="word_size"
                                        name="primer_specificity_refrence_blastn_search_parameters.word_size"
                                        value={
                                            formData
                                                .primer_specificity_refrence_blastn_search_parameters
                                                .word_size.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-word-size">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_refrence_blastn_search_parameters
                                                            .word_size.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label htmlFor="dust" className="form-label">
                                    Dust:
                                </label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-select"
                                        id="dust"
                                        name="primer_specificity_refrence_blastn_search_parameters.dust"
                                        value={
                                            formData
                                                .primer_specificity_refrence_blastn_search_parameters
                                                .dust.value
                                        }
                                        onChange={handleChange}
                                    >
                                        <option value="no">No</option>
                                        <option value="yes">Yes</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-dust">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_refrence_blastn_search_parameters
                                                            .dust.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="soft_masking"
                                    className="form-label"
                                >
                                    Soft Masking:
                                </label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-select"
                                        id="soft_masking"
                                        name="primer_specificity_refrence_blastn_search_parameters.soft_masking"
                                        value={
                                            formData
                                                .primer_specificity_refrence_blastn_search_parameters
                                                .soft_masking.value
                                        }
                                        onChange={handleChange}
                                    >
                                        <option value="false">False</option>
                                        <option value="true">True</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-soft-masking">
                                                <Popover.Header as="h3">
                                                    Soft Masking
                                                </Popover.Header>
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_refrence_blastn_search_parameters
                                                            .soft_masking
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="max_target_seqs"
                                    className="form-label"
                                >
                                    Max Target Sequences:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="max_target_seqs"
                                        name="primer_specificity_refrence_blastn_search_parameters.max_target_seqs"
                                        value={
                                            formData
                                                .primer_specificity_refrence_blastn_search_parameters
                                                .max_target_seqs.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-max-target-seqs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_refrence_blastn_search_parameters
                                                            .max_target_seqs
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label
                                    htmlFor="max_hsps"
                                    className="form-label"
                                >
                                    Max HSPs:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_specificity_refrence_blastn_search_parameters.max_hsps"
                                        name="primer_specificity_refrence_blastn_search_parameters.max_hsps"
                                        value={
                                            formData
                                                .primer_specificity_refrence_blastn_search_parameters
                                                .max_hsps.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-max-hsps">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_refrence_blastn_search_parameters
                                                            .max_hsps.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="min_alignment_length"
                                    className="form-label"
                                >
                                    Min Alignment Length:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="min_alignment_length"
                                        name="primer_specificity_refrence_blastn_hit_parameters.min_alignment_length"
                                        value={
                                            formData
                                                .primer_specificity_refrence_blastn_hit_parameters
                                                .min_alignment_length.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-min-alignment-length">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_refrence_blastn_hit_parameters
                                                            .min_alignment_length
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="perc_identity"
                                    className="form-label"
                                >
                                    Percentage Identity:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="perc_identity"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.perc_identity"
                                        value={
                                            formData
                                                .primer_specificity_encoding_probes_blastn_search_parameters
                                                .perc_identity.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-enc-perc-identity">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_encoding_probes_blastn_search_parameters
                                                            .perc_identity
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label htmlFor="strand" className="form-label">
                                    Strand:
                                </label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-select"
                                        id="strand"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.strand"
                                        value={
                                            formData
                                                .primer_specificity_encoding_probes_blastn_search_parameters
                                                .strand.value
                                        }
                                        onChange={handleChange}
                                    >
                                        <option value="minus">Minus</option>
                                        <option value="plus">Plus</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-enc-strand">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_encoding_probes_blastn_search_parameters
                                                            .strand.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label
                                    htmlFor="word_size"
                                    className="form-label"
                                >
                                    Word Size:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="word_size"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.word_size"
                                        value={
                                            formData
                                                .primer_specificity_encoding_probes_blastn_search_parameters
                                                .word_size.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-enc-word-size">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_encoding_probes_blastn_search_parameters
                                                            .word_size.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="dust" className="form-label">
                                    Dust:
                                </label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-select"
                                        id="dust"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.dust"
                                        value={
                                            formData
                                                .primer_specificity_encoding_probes_blastn_search_parameters
                                                .dust.value
                                        }
                                        onChange={handleChange}
                                    >
                                        <option value="no">No</option>
                                        <option value="yes">Yes</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-enc-dust">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_encoding_probes_blastn_search_parameters
                                                            .dust.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label
                                    htmlFor="soft_masking"
                                    className="form-label"
                                >
                                    Soft Masking:
                                </label>
                                <div className="d-flex align-items-center">
                                    <select
                                        className="form-select"
                                        id="soft_masking"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.soft_masking"
                                        value={
                                            formData
                                                .primer_specificity_encoding_probes_blastn_search_parameters
                                                .soft_masking.value
                                        }
                                        onChange={handleChange}
                                    >
                                        <option value="false">False</option>
                                        <option value="true">True</option>
                                    </select>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-enc-soft-masking">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_encoding_probes_blastn_search_parameters
                                                            .soft_masking
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label
                                    htmlFor="max_target_seqs"
                                    className="form-label"
                                >
                                    Max Target Sequences:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_specificity_encoding_probes_blastn_search_parameters.max_target_seqs"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.max_target_seqs"
                                        value={
                                            formData
                                                .primer_specificity_encoding_probes_blastn_search_parameters
                                                .max_target_seqs.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-enc-max-target-seqs">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_encoding_probes_blastn_search_parameters
                                                            .max_target_seqs
                                                            .comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>

                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="max_hsps"
                                    className="form-label"
                                >
                                    Max HSPs:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="max_hsps"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.max_hsps"
                                        value={
                                            formData
                                                .primer_specificity_encoding_probes_blastn_search_parameters
                                                .max_hsps.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-enc-max-hsps">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_specificity_encoding_probes_blastn_search_parameters
                                                            .max_hsps.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="min_alignment_length"
                                    className="form-label"
                                >
                                    Min Alignment Length:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_specificity_encoding_probes_blastn_hit_parameters.min_alignment_length"
                                        name="primer_specificity_encoding_probes_blastn_hit_parameters.min_alignment_length"
                                        value={
                                            formData
                                                .primer_specificity_encoding_probes_blastn_hit_parameters
                                                .min_alignment_length.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-nn-table">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .nn_table.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label
                                    htmlFor="nn_table"
                                    className="form-label"
                                >
                                    NN Table:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="primer_Tm_parameters.nn_table"
                                        name="primer_Tm_parameters.nn_table"
                                        value={
                                            formData.primer_Tm_parameters
                                                .nn_table.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-nn-table">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .nn_table.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label
                                    htmlFor="tmm_table"
                                    className="form-label"
                                >
                                    TMM Table:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="primer_Tm_parameters.tmm_table"
                                        name="primer_Tm_parameters.tmm_table"
                                        value={
                                            formData.primer_Tm_parameters
                                                .tmm_table.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-tmm-table">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .tmm_table.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label
                                    htmlFor="imm_table"
                                    className="form-label"
                                >
                                    IMM Table:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="primer_Tm_parameters.imm_table"
                                        name="primer_Tm_parameters.imm_table"
                                        value={
                                            formData.primer_Tm_parameters
                                                .imm_table.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-imm-table">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .imm_table.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label
                                    htmlFor="de_table"
                                    className="form-label"
                                >
                                    DE Table:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="primer_Tm_parameters.de_table"
                                        name="primer_Tm_parameters.de_table"
                                        value={
                                            formData.primer_Tm_parameters
                                                .de_table.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-de-table">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .de_table.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="dnac1" className="form-label">
                                    DNA Concentration 1 (dnac1):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_Tm_parameters.dnac1"
                                        name="primer_Tm_parameters.dnac1"
                                        value={
                                            formData.primer_Tm_parameters.dnac1
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-dnac1">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .dnac1.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label htmlFor="dnac2" className="form-label">
                                    DNA Concentration 2 (dnac2):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_Tm_parameters.dnac2"
                                        name="primer_Tm_parameters.dnac2"
                                        value={
                                            formData.primer_Tm_parameters.dnac2
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-dnac2">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .dnac2.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>

                        <div className=" row g-3">
                            <div className="col">
                                <label
                                    htmlFor="saltcorr"
                                    className="form-label"
                                >
                                    Salt Correction (saltcorr):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_Tm_parameters.saltcorr"
                                        name="primer_Tm_parameters.saltcorr"
                                        value={
                                            formData.primer_Tm_parameters
                                                .saltcorr.value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-saltcorr">
                                                <Popover.Header as="h3">
                                                    Salt Correction
                                                </Popover.Header>
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .saltcorr.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label htmlFor="Na" className="form-label">
                                    Sodium Concentration (Na):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_Tm_parameters.Na"
                                        name="primer_Tm_parameters.Na"
                                        value={
                                            formData.primer_Tm_parameters.Na
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-na-concentration">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .Na.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                            <div className="col">
                                <label htmlFor="K" className="form-label">
                                    Potassium Concentration (K):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_Tm_parameters.K"
                                        name="primer_Tm_parameters.K"
                                        value={
                                            formData.primer_Tm_parameters.K
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-k-concentration">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .K.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="Tris" className="form-label">
                                    Tris Concentration:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_Tm_parameters.Tris"
                                        name="primer_Tm_parameters.Tris"
                                        value={
                                            formData.primer_Tm_parameters.Tris
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-tris-concentration">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .Tris.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label htmlFor="Mg" className="form-label">
                                    Magnesium Concentration (Mg):
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_Tm_parameters.Mg"
                                        name="primer_Tm_parameters.Mg"
                                        value={
                                            formData.primer_Tm_parameters.Mg
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-mg-concentration">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .Mg.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
                                            }}
                                        />
                                    </OverlayTrigger>
                                </div>
                            </div>

                            <div className="col">
                                <label htmlFor="dNTPs" className="form-label">
                                    dNTPs Concentration:
                                </label>
                                <div className="d-flex align-items-center">
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_Tm_parameters.dNTPs"
                                        name="primer_Tm_parameters.dNTPs"
                                        value={
                                            formData.primer_Tm_parameters.dNTPs
                                                .value
                                        }
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-dntps-concentration">
                                                <Popover.Body>
                                                    {
                                                        formData
                                                            .primer_Tm_parameters
                                                            .dNTPs.comment
                                                    }
                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
                                                fontSize: "1.2rem",
                                                cursor: "pointer",
                                                color: "#0d6efd",
                                                marginLeft: "10px",
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
    const handleSubmitGenomicAll = async (
        forms: typeof fastaForms, // Accept forms as argument
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
                        `http://localhost:5000/api/genomic/cascaded/${endpoint}`,
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

    // Handle input changes
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        const keys = name.split(".");

        if (keys.length === 2) {
            const [parent, child] = keys;
            setFormData((prev) => ({
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
            setFormData((prev) => ({
                ...prev,
                [name]: {
                    ...(prev as any)[name],
                    value,
                },
            }));
        }
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        if (e) e.preventDefault();
        if (runStatus === "submitting" || runStatus === "running") return; // prevent double-clicks
        setRunStatus("submitting");
        setRunId(null);

        // ---- FASTA target probe database ----
        let generatedTargetPaths = "";
        if (fastaForms.length > 0) {
            generatedTargetPaths = await handleSubmitGenomicAll(fastaForms);
        }
        if (generatedTargetPaths === "error") {
            setModal({
                show: true,
                title: "Pipeline Failed",
                body: `An error occurred while submitting the genomic forms (FASTA). Please try again.`,
            });
            setRunStatus("idle");
            return;
        }
        const uploadedPaths = await uploadFiles();
        if (uploadedPaths["file_regions_file"]) {
            formData["file_regions"]["value"] =
                uploadedPaths["file_regions_file"];
        }
        let uploadedTargetFastaPath = "";
        if (uploadedPaths["files_fasta_target_probe_database"]) {
            uploadedTargetFastaPath =
                uploadedPaths["files_fasta_target_probe_database"];
        }
        const mergedTargetValue = [
            generatedTargetPaths,
            uploadedTargetFastaPath,
        ]
            .filter((v) => v && v.length > 0)
            .join("\n");
        if (mergedTargetValue.length > 0) {
            formData["files_fasta_target_probe_database"]["value"] =
                mergedTargetValue;
        }

        // ---- FASTA reference probe database ----
        let generatedReferencePaths = "";
        if (fastaFormsReference.length > 0) {
            generatedReferencePaths =
                await handleSubmitGenomicAll(fastaFormsReference);
        }
        if (generatedReferencePaths === "error") {
            setModal({
                show: true,
                title: "Pipeline Failed",
                body: `An error occurred while submitting the genomic forms (FASTA). Please try again.`,
            });
            setRunStatus("idle");
            return;
        }
        let uploadedReferenceFastaPath = "";
        if (uploadedPaths["files_fasta_reference_database_target_probe"]) {
            uploadedReferenceFastaPath =
                uploadedPaths["files_fasta_reference_database_target_probe"];
        }
        const mergedReferenceValue = [
            generatedReferencePaths,
            uploadedReferenceFastaPath,
        ]
            .filter((v) => v && v.length > 0)
            .join("\n");
        if (mergedReferenceValue.length > 0) {
            formData["files_fasta_reference_database_target_probe"]["value"] =
                mergedReferenceValue;
        }

        // ---- FASTA primer probe database ----
        let generatedPrimerPaths = "";
        if (fastaFormsPrimer && fastaFormsPrimer.length > 0) {
            generatedPrimerPaths =
                await handleSubmitGenomicAll(fastaFormsPrimer);
        }
        if (generatedPrimerPaths === "error") {
            setModal({
                show: true,
                title: "Pipeline Failed",
                body: `An error occurred while submitting the genomic forms (FASTA). Please try again.`,
            });
            setRunStatus("idle");
            return;
        }
        let uploadedPrimerFastaPath = "";
        if (uploadedPaths["files_fasta_reference_database_primer"]) {
            uploadedPrimerFastaPath =
                uploadedPaths["files_fasta_reference_database_primer"];
        }
        const mergedPrimerValue = [
            generatedPrimerPaths,
            uploadedPrimerFastaPath,
        ]
            .filter((v) => v && v.length > 0)
            .join("\n");
        if (mergedPrimerValue.length > 0) {
            formData["files_fasta_reference_database_primer"]["value"] =
                mergedPrimerValue;
        }

        // ---- FASTA readout probe database ----
        let generatedReadoutPaths = "";
        if (fastaFormsReadout && fastaFormsReadout.length > 0) {
            generatedReadoutPaths =
                await handleSubmitGenomicAll(fastaFormsReadout);
        }
        if (generatedReadoutPaths === "error") {
            setModal({
                show: true,
                title: "Pipeline Failed",
                body: `An error occurred while submitting the genomic forms (FASTA). Please try again.`,
            });
            setRunStatus("idle");
            return;
        }
        let uploadedReadoutFastaPath = "";
        if (uploadedPaths["files_fasta_reference_database_readout_probe"]) {
            uploadedReadoutFastaPath =
                uploadedPaths["files_fasta_reference_database_readout_probe"];
        }
        const mergedReadoutValue = [
            generatedReadoutPaths,
            uploadedReadoutFastaPath,
        ]
            .filter((v) => v && v.length > 0)
            .join("\n");
        if (mergedReadoutValue.length > 0) {
            formData["files_fasta_reference_database_readout_probe"]["value"] =
                mergedReadoutValue;
        }

        // Then: handle scrinshot (upload other files and submit form)
        if (!areAllFilesUploaded()) {
            setModal({
                show: true,
                title: "Pipeline Failed",
                body: `Please upload all required files before submitting.`,
            });
            setRunStatus("idle");
            return;
        }

        const newId = await createRunId();
        if (newId) {
            // setRunId does not immediately update runId due to React state batching
            // so we use newId directly in the submission
            setRunId(newId);
            setIdCopySuccess(await copyToClipboard(newId));
        } else {
            setModal({
                show: true,
                title: "Pipeline Failed",
                body: `The pipeline has failed to create a new run.`,
            });
            setRunStatus("idle");
            return;
        }

        try {
            setRunStatus("running");
            const response = await axios.post(
                "http://localhost:5000/api/seqfish",
                { formdata: formData, runid: newId },
                {
                    withCredentials: true,
                    headers: { "Content-Type": "application/json" },
                }
            );
            const result = response.data;
            console.log(result, "this is the result");

            setModal({
                show: true,
                title: "Pipeline Finished",
                body: `The pipeline has successfully finished processing. Your run ID is: ${newId}`,
            });
        } catch (error) {
            console.error("Error submitting seqfish form:", error);
            setModal({
                show: true,
                title: "Pipeline Failed",
                body: `The pipeline has failed during processing. Your run ID is: ${newId}.`,
            });
        } finally {
            setRunStatus("idle");
        }
    };

    const closeModal = () => {
        setModal({ ...modal, show: false });
    };

    return (
        <div>
            <Navbar />

            {runId ? (
                <RunLinkModal
                    show={modal.show}
                    close={closeModal}
                    title={modal.title}
                    body={modal.body}
                    runId={runId}
                />
            ) : (
                <InfoModal
                    show={modal.show}
                    close={closeModal}
                    title={modal.title}
                    body={modal.body}
                />
            )}

            <div className="container my-4">
                <form onSubmit={handleSubmit} id="scrinshotForm">
                    <div className="mb-3">
                        <div className="d-flex justify-content-center align-items-center">
                            <h2 className="mb-0">Seqfish+ Probe Designer</h2>

                            <button
                                type="button"
                                className="btn btn-link p-0 ms-2"
                                onClick={() => setExpanded(!expanded)}
                                aria-expanded={expanded}
                                style={{ textDecoration: "none" }}
                            >
                                {expanded ? (
                                    <ChevronUp size={20} />
                                ) : (
                                    <ChevronDown size={20} />
                                )}
                            </button>
                        </div>

                        <Collapse in={expanded}>
                            <div className="text-center mt-2">
                                <p className="text-muted">
                                    SeqFISH+ (sequential fluorescence in situ
                                    hybridization) probes are short DNA
                                    oligonucleotides designed for multiplexed
                                    single-molecule FISH. In seqFISH+, multiple
                                    rounds of hybridization and imaging are
                                    performed sequentially, enabling detailed
                                    visualization and quantification of hundreds
                                    of RNA targets in a single sample. This
                                    technique preserves the spatial context of
                                    gene expression while providing
                                    high-throughput and single-cell resolution.
                                    A SeqFISH+ probe is a flourescent probe that
                                    contains a 28-nt gene-specific sequence
                                    complementary to the mRNA, four 15-nt
                                    barcode sequences, which are read out by
                                    fluorescent secondary readout probes, single
                                    T-nucleotide spacers between readout and
                                    gene-specific regions, and two 20-nt PCR
                                    primer binding sites. The specific readout
                                    sequences contained by an encoding probe are
                                    determined by the binary barcode assigned to
                                    that RNA.
                                </p>
                                <img
                                    src={seqfishImage}
                                    alt="Seqfish+ Pipeline"
                                    className="img-fluid my-3"
                                />
                            </div>
                        </Collapse>
                    </div>
                    <ul className="nav nav-tabs">
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link ${activeTab === "probe_sequences" ? "active" : ""}`}
                                onClick={() => {
                                    setActiveTab("probe_sequences");
                                    setActivetab2("specfblastn");
                                }}
                            >
                                Target Probe Parameters
                            </button>
                        </li>

                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link ${activeTab === "readout" ? "active" : ""}`}
                                onClick={() => {
                                    setActivetab2("readout");
                                    setActiveTab("readout");
                                }}
                            >
                                Readout Probe Parameters
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link ${activeTab === "primer_parameters" ? "active" : ""}`}
                                onClick={() => {
                                    setActivetab2("primerpro");
                                    setActiveTab("primer_parameters");
                                }}
                            >
                                Primer Parameters
                            </button>
                        </li>
                    </ul>

                    {/* Tab Content */}
                    <div className="tab-content mt-4">{renderTabContent()}</div>
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
                                    {activeTab === "probe_sequences" && (
                                        <>
                                            <li className="nav-item">
                                                <button
                                                    type="button"
                                                    className={`nav-link ${activetab2 === "specfblastn" ? "active" : ""}`}
                                                    onClick={() =>
                                                        setActivetab2(
                                                            "specfblastn"
                                                        )
                                                    }
                                                >
                                                    Specificity Filters BlastN
                                                </button>
                                            </li>
                                            <li className="nav-item">
                                                <button
                                                    type="button"
                                                    className={`nav-link ${activetab2 === "crossfilterblastn" ? "active" : ""}`}
                                                    onClick={() =>
                                                        setActivetab2(
                                                            "crossfilterblastn"
                                                        )
                                                    }
                                                >
                                                    Cross-hybrid filters BlastN
                                                </button>
                                            </li>
                                            <li className="nav-item">
                                                <button
                                                    type="button"
                                                    className={`nav-link ${activetab2 === "oligosetselection" ? "active" : ""}`}
                                                    onClick={() =>
                                                        setActivetab2(
                                                            "oligosetselection"
                                                        )
                                                    }
                                                >
                                                    Oligo Set Selection
                                                    Parameters
                                                </button>
                                            </li>
                                        </>
                                    )}
                                    {activeTab === "readout" && (
                                        <>
                                            <li className="nav-item">
                                                <button
                                                    type="button"
                                                    className={`nav-link ${activetab2 === "readout" ? "active" : ""}`}
                                                    onClick={() =>
                                                        setActivetab2("readout")
                                                    }
                                                >
                                                    Readout Parameters
                                                </button>
                                            </li>
                                        </>
                                    )}
                                    {activeTab === "primer_parameters" && (
                                        <>
                                            <li className="nav-item">
                                                <button
                                                    type="button"
                                                    className={`nav-link ${activetab2 === "primerpro" ? "active" : ""}`}
                                                    onClick={() =>
                                                        setActivetab2(
                                                            "primerpro"
                                                        )
                                                    }
                                                >
                                                    Primer Parameters
                                                </button>
                                            </li>
                                        </>
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
                                Please upload all required files or fill the
                                values before submitting.
                            </div>
                        )}
                        {runId && (
                            <RunIdAlert
                                runId={runId}
                                idCopySuccess={idCopySuccess}
                            />
                        )}
                        <div className="d-flex justify-content-center mt-4">
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={
                                    runStatus === "submitting" ||
                                    runStatus === "running" ||
                                    !areAllFilesUploaded()
                                }
                                aria-busy={
                                    runStatus === "submitting" ||
                                    runStatus === "running"
                                }
                            >
                                {runStatus === "submitting" && (
                                    <>
                                        <span
                                            className="spinner-border spinner-border-sm me-2"
                                            role="status"
                                            aria-hidden="true"
                                        ></span>
                                        Submitting...
                                    </>
                                )}
                                {runStatus === "running" && (
                                    <>
                                        <span
                                            className="spinner-border spinner-border-sm me-2"
                                            role="status"
                                            aria-hidden="true"
                                        ></span>
                                        Running...
                                    </>
                                )}
                                {runStatus === "idle" && "Submit"}
                            </button>
                        </div>
                    </div>
                </form>
                <RunLocallyInfoBox />
            </div>
        </div>
    );
};

export default SeqFish;
