import React, {useEffect, useState} from 'react';
import Navbar from "../modules/nav";
import axios from "axios";
import {OverlayTrigger, Popover} from "react-bootstrap";
import {InfoCircle} from "react-bootstrap-icons";
import merfish_form from "../forms/merfish_form";
import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";
import form_Data_Custom from "../forms/genomic_custom_form";
import {createRunId} from "../modules/helpers";
import {
    archaeaEntries,
    fungiEntries,
    invertebrateEntries,
    mitochondrionEntries, plantEntries, plasmidEntries, plastidEntries, protozoaEntries, unknownEntries,
    vertebrate_mammalianEntries, vertebrate_otherEntries
} from "../forms/refseqSpecies";
import {ensemblSpecies} from "../forms/ensemblSpecies";
const Merfish: React.FC = () => {
    const [fastaOption, setFastaOption] = useState("upload"); // "generate" or "upload"
    const [fastaOption2, setFastaOption2] = useState("upload"); // "generate" or "upload"
    const [fastaOptionReadout, setFastaOptionReadout] = useState("upload"); // "generate" or "upload"
    const [fastaOptionPrimer, setFastaOptionPrimer] = useState("upload"); // "generate" or "upload"


    const [loading, setLoading] = useState(false);
    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [progress, setProgress] = useState(0);
    //const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formDataNcbi, setFormDataNcbi] = useState(form_Data_Ncbi);
    const [formDataEns, setFormDataEns] = useState(form_Data_Ens);
    const [formDataCustom, setFormDataCustom] = useState(form_Data_Custom);
    const [formData2Ncbi, setFormData2Ncbi] = useState(form_Data_Ncbi);
    const [formData2Ens, setFormData2Ens] = useState(form_Data_Ens);
    const [formData2Custom, setFormData2Custom] = useState(form_Data_Custom);
    const [formDataNcbiReadout, setFormDataNcbiReadout] = useState(form_Data_Ncbi);
    const [formDataEnsReadout, setFormDataEnsReadout] = useState(form_Data_Ens);
    const [formDataCustomReadout, setFormDataCustomReadout] = useState(form_Data_Custom);
    const [formDataNcbiPrimer, setFormDataNcbiPrimer] = useState(form_Data_Ncbi);
    const [formDataEnsPrimer, setFormDataEnsPrimer] = useState(form_Data_Ens);
    const [formDataCustomPrimer, setFormDataCustomPrimer] = useState(form_Data_Custom);
    const [generateFastaFiles, setGenerateFastaFiles] = useState(false);
    const [generateFastaFiles2, setGenerateFastaFiles2] = useState(false);
    const [generateFastaFilesReadout, setGenerateFastaFilesReadout] = useState(false);
    const [generateFastaFilesPrimer, setGenerateFastaFilesPrimer] = useState(false);
    const [useSameReferenceForm, setUseSameReferenceForm] = useState(false);
    const [selectedSource, setSelectedSource] = useState("ncbi"); // State to hold selected source
    const [selectedSource2, setSelectedSource2] = useState("ncbi"); // State to hold selected source
    const [selectedSourceReadout, setSelectedSourceReadout] = useState("ncbi"); // State to hold selected source
    const [selectedSourcePrimer, setSelectedSourcePrimer] = useState("ncbi");
    const [useSameFasta, setUseSameFasta] = useState(true);
    const [useSameFasta2, setUseSameFasta2] = useState(true);
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
    const handleChangeGenomicPrimer = (
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
            setFormDataNcbiPrimer(prev => updateFormData(prev));
        } else if (selectedSource === 'ensembl') {
            setFormDataEnsPrimer(prev => updateFormData(prev));
        } else if (selectedSource === 'custom') {
            setFormDataCustomPrimer(prev => updateFormData(prev));
        }
    };
    const handleChangeGenomicReadout = (
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

        if (selectedSourceReadout === 'ncbi') {
            setFormDataNcbiReadout(prev => updateFormData(prev));
        } else if (selectedSourceReadout === 'ensembl') {
            setFormDataEnsReadout(prev => updateFormData(prev));
        } else if (selectedSourceReadout === 'custom') {
            setFormDataCustomReadout(prev => updateFormData(prev));
        }
    };
    const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSource(e.target.value);
    };
    const handleSourceChange2 = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSource2(e.target.value);
    };
    const handleSourceChangePrimer = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSourcePrimer(e.target.value);
    };
    const handleSourceChangeReadout = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSourceReadout(e.target.value);
    };
    interface FileState {
        file_regions: File | null;
        files_fasta_target_probe_database: File[]; // Always an array
        files_fasta_reference_database_target_probe: File[]; // Always an array
        files_fasta_reference_database_readout_probe: File[]; // Always an array
        files_fasta_reference_database_primer: File[]; // Always an array
    }

// In your component
    const [files, setFiles] = useState<FileState>({
        file_regions: null,
        files_fasta_target_probe_database: [], // Empty array
        files_fasta_reference_database_target_probe: [], // Empty array
        files_fasta_reference_database_readout_probe: [], // Empty array
        files_fasta_reference_database_primer: [], // Empty array
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
            files.files_fasta_target_probe_database.length > 0 &&
            files.files_fasta_reference_database_target_probe.length > 0 &&
            files.files_fasta_reference_database_readout_probe.length > 0 &&
            files.files_fasta_reference_database_primer.length > 0


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
    useEffect(() => {
        if (useSameFasta) {
            setFormDataNcbiReadout(formDataNcbi);
            setFormDataEnsReadout(formDataEns);
            setFormDataCustomReadout(formDataCustom);
        }
        if (useSameFasta2) {
            setFormDataNcbiPrimer(formDataNcbi);
            setFormDataEnsPrimer(formDataEns);
            setFormDataCustomPrimer(formDataCustom);
        }
    }, [formDataNcbi, formDataEns, formDataCustom, useSameReferenceForm,useSameFasta]);
    const [formData, setFormData] = useState(merfish_form);
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



                                <div className="mb-3">
                                  <label htmlFor="files_fasta_target_probe_database" className="form-label">
                                    Fasta Probe Database:
                                  </label>
                                  <div className="d-flex align-items-center w-100 gap-2">
                                    {/* Radio buttons - left half */}
                                    <div className="w-50">
                                      <div className="btn-group w-100" role="group" aria-label="FASTA option">
                                        <input
                                          type="radio"
                                          className="btn-check"
                                          name="fastaOption"
                                          id="generateFastaOption"
                                          value="generate"
                                          autoComplete="off"
                                          checked={fastaOption === "generate"}
                                          onChange={() => setFastaOption("generate")}
                                        />
                                        <label className="btn btn-outline-primary" htmlFor="generateFastaOption">
                                          Generate FASTA
                                        </label>

                                        <input
                                          type="radio"
                                          className="btn-check"
                                          name="fastaOption"
                                          id="uploadFastaOption"
                                          value="upload"
                                          autoComplete="off"
                                          checked={fastaOption === "upload"}
                                          onChange={() => setFastaOption("upload")}
                                        />
                                        <label className="btn btn-outline-primary" htmlFor="uploadFastaOption">
                                          Upload File
                                        </label>
                                      </div>
                                    </div>
                                    {/* File input + choose button - right half */}
                                    <div className="w-50 d-flex align-items-center">
                                      <input
                                        type="file"
                                        className="form-control visually-hidden"
                                        id="files_fasta_target_probe_database"
                                        name="files_fasta_target_probe_database"
                                        onChange={handleFileChange}
                                        multiple
                                        disabled={fastaOption !== "upload"}
                                      />
                                      <label
                                        htmlFor="files_fasta_target_probe_database"
                                        className="btn btn-outline-primary me-2 w-100"
                                        style={{
                                          cursor: fastaOption !== "upload" ? "not-allowed" : "pointer",
                                          opacity: fastaOption !== "upload" ? 0.5 : 1,
                                          pointerEvents: fastaOption !== "upload" ? "none" : "auto"
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
                                  </div>
                                  <div className="text-muted small mt-1">
                                    {files.files_fasta_target_probe_database.length > 0
                                      ? `Selected: ${files.files_fasta_target_probe_database.map(f => f.name).join(', ')}`
                                      : "No files selected"}
                                  </div>
                                </div>

                                {fastaOption ==='generate' && (

                                    <>
                                        <div className="row mb-3">

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
                                                                    <div className="col-md-3">
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
                                                                    <div className="col-md-3">
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

                                                                    <div className="col-md-3">
                                                                        <label htmlFor="species" className="form-label">Species</label>
                                                                        <div className="d-flex align-items-center">
                                                                            {formDataNcbi.source_params.taxon.value === "vertebrate_mammalian" ? (
                                                                                <select
                                                                                    name="source_params.species"
                                                                                    className="form-select"
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

                                                                    <div className="col-md-3">
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


                                                                </div>

                                                                <h6 className="pt-3">Genomic Regions</h6>
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
                                                                {formDataNcbi.genomic_regions.exon_exon_junction.value === "true" && (
                                                                        <div className="col-md-4 pt-2">
                                                                             <label htmlFor="exon_exon_junction_block_size" className="form-label me-2 mb-0">
                                                                                    Block Size
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



                                                            </form>
                                                        </div>
                                                    )}

                                                    {selectedSource === "ensembl" && (
                                                        <div>
                                                            <form onSubmit={handleSubmit}>
                                                                <div className="row g-3">
                                                                    <div className="col-md-4">
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
                                                                    <div className="col-md-4">
                                                                        <label htmlFor="species" className="form-label">Species</label>
                                                                        <div className="d-flex align-items-center">
                                                                            <select
                                                                                className="form-select"
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

                                                                    <div className="col-md-4">
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
                                                                {formDataEns.genomic_regions.exon_exon_junction.value === "true" && (
                                                                        <div className="col-md-4 pt-2">
                                                                             <label htmlFor="exon_exon_junction_block_size" className="form-label me-2 mb-0">
                                                                                    Block Size
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

                                                            </form>
                                                        </div>
                                                    )}
                                                </div>


                                            </div>
                                        </div>

                                    </>
                                )}

                                <div className="mb-3 pt-3">
                                  <label htmlFor="files_fasta_reference_database_target_probe" className="form-label">
                                    Fasta Probe Reference Database:
                                  </label>
                                  <div className="d-flex align-items-center w-100 gap-2">
                                    {/* Button group: 3 options */}
                                    <div className="w-50">
                                      <div className="btn-group w-100" role="group" aria-label="FASTA option">
                                        <input
                                          type="radio"
                                          className="btn-check"
                                          name="fastaOption2"
                                          id="generateFastaOption2"
                                          value="generate"
                                          autoComplete="off"
                                          checked={fastaOption2 === "generate"}
                                          onChange={() => setFastaOption2("generate")}
                                        />
                                        <label className="btn btn-outline-primary" htmlFor="generateFastaOption2">
                                          Generate FASTA
                                        </label>



                                        <input
                                          type="radio"
                                          className="btn-check"
                                          name="fastaOption2"
                                          id="useGeneratedFastaOption2"
                                          value="useGenerated"
                                          autoComplete="off"
                                          checked={fastaOption2 === "useGenerated"}
                                          onChange={() => setFastaOption2("useGenerated")}
                                        />
                                        <label className="btn btn-outline-primary" htmlFor="useGeneratedFastaOption2">
                                          Use Generated
                                        </label>
                                           <input
                                          type="radio"
                                          className="btn-check"
                                          name="fastaOption2"
                                          id="uploadFastaOption2"
                                          value="upload"
                                          autoComplete="off"
                                          checked={fastaOption2 === "upload"}
                                          onChange={() => setFastaOption2("upload")}
                                        />
                                        <label className="btn btn-outline-primary" htmlFor="uploadFastaOption2">
                                          Upload File
                                        </label>
                                      </div>
                                    </div>
                                    {/* File upload area, only visible if "Upload File" is selected */}
                                    <div className="w-50 d-flex align-items-center">
                                      <input
                                        type="file"
                                        className="form-control visually-hidden"
                                        id="files_fasta_reference_database_target_probe"
                                        name="files_fasta_reference_database_target_probe"
                                        onChange={handleFileChange}
                                        multiple
                                        disabled={fastaOption2 !== "upload"}
                                      />
                                      <label
                                        htmlFor="files_fasta_reference_database_target_probe"
                                        className="btn btn-outline-primary me-2 w-100"
                                        style={{
                                          cursor: fastaOption2 !== "upload" ? "not-allowed" : "pointer",
                                          opacity: fastaOption2 !== "upload" ? 0.5 : 1,
                                          pointerEvents: fastaOption2 !== "upload" ? "none" : "auto"
                                        }}
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
                                  {/* Display selected file names */}
                                  <div className="text-muted small mt-1">
                                    {files.files_fasta_reference_database_target_probe.length > 0
                                      ? `Selected: ${files.files_fasta_reference_database_target_probe.map(f => f.name).join(', ')}`
                                      : "No files selected"}
                                  </div>
                                </div>
                                {fastaOption2 ==='generate' && (

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
                                                                                    className="form-select"
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
                                                                                className="form-select"
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
                        </div>
                        <div className="mb-3">
                            <label htmlFor="top_n_sets" className="form-label">Maximum Number of Sets:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="top_n_sets" name="top_n_sets"
                                       value={formData.top_n_sets.value} onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={<Popover id="popover-n_jobs">
                                        <Popover.Body>
                                            {formData.top_n_sets.comment}
                                        </Popover.Body>
                                    </Popover>}
                                >
                                    <InfoCircle
                                        style={{
                                            fontSize: "1.2rem",
                                            cursor: "pointer",
                                            color: "#0d6efd",
                                            marginLeft: "10px"
                                        }}/>
                                </OverlayTrigger>
                            </div>

                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="probe_length_min" className="form-label">Min Probe Length:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="target_probe_length_min"
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
                                    <input type="number" className="form-control" id="target_probe_length_max"
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
                                <label htmlFor="probe_isoform_consensus" className="form-label">Isoform Consensus
                                    (%):</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="target_probe_isoform_consensus"
                                           name="target_probe_isoform_consensus"
                                           value={formData.target_probe_isoform_consensus.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
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
                                    <input type="number" className="form-control" id="target_probe_GC_content_min"
                                           name="target_probe_GC_content_min"
                                           value={formData.target_probe_GC_content_min.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
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
                                    <input type="number" className="form-control" id="target_probe_GC_content_opt"
                                           name="target_probe_GC_content_opt"
                                           value={formData.target_probe_GC_content_opt.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
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
                                    <input type="number" className="form-control" id="target_probe_GC_content_max"
                                           name="target_probe_GC_content_max"
                                           value={formData.target_probe_GC_content_max.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
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
                                <div className="col">

                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_min"
                                               name="target_probe_Tm_min"
                                               value={formData.target_probe_Tm_min.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Header as="h3">Number of Jobs</Popover.Header>
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

                            </div>
                            <div className="col">
                                <label htmlFor="probe_Tm_max" className="form-label">Max Tm (°C):</label>
                                <div className="col">
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="target_probe_Tm_max"
                                               name="target_probe_Tm_max"
                                               value={formData.target_probe_Tm_max.value} onChange={handleChange}
                                               required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
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

                            </div>
                            <div className="col">
                                <label htmlFor="probe_Tm_opt" className="form-label">Opt Tm (°C):</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="target_probe_Tm_opt" name="target_probe_Tm_opt"
                                           value={formData.target_probe_Tm_opt.value} onChange={handleChange} required/>
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
                        <h6 className="pt-2">Minimum number of nucleotides to consider it a homopolymeric run per
                            base </h6>
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="homopolymeric_A" className="form-label">A:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="target_probe_homopolymeric_base_n.A"
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
                                    <input type="number" className="form-control" id="target_probe_homopolymeric_base_n.T"
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
                                    <input type="number" className="form-control" id="target_probe_homopolymeric_base_n.G"
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

                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="probe_isoform_weight" className="form-label">Probe Isoform
                                    Weight:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="target_probe_isoform_weight"
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
                                <input type="number" className="form-control" id="target_probe_GC_weight"
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
                                    <input type="number" className="form-control" id="target_probe_Tm_weight"
                                           name="target_probe_Tm_weight"
                                           value={formData.target_probe_Tm_weight.value} onChange={handleChange}
                                           required/>
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
            )
                ;

            case 'readout':
                return (
                <div className="mb-4">
                    <div className="mb-3">
                      <label htmlFor="files_fasta_reference_database_readout_probe" className="form-label">
                        Fasta Probe Reference Database:
                      </label>
                      <div className="d-flex align-items-center w-100 gap-2">
                        {/* Button group: 3 options */}
                        <div className="w-50">
                          <div className="btn-group w-100" role="group" aria-label="FASTA option">
                            <input
                              type="radio"
                              className="btn-check"
                              name="fastaOptionReadout"
                              id="generateFastaOptionReadout"
                              value="generate"
                              autoComplete="off"
                              checked={fastaOptionReadout === "generate"}
                              onChange={() => setFastaOptionReadout("generate")}
                            />
                            <label className="btn btn-outline-primary" htmlFor="generateFastaOptionReadout">
                              Generate FASTA
                            </label>

                            <input
                              type="radio"
                              className="btn-check"
                              name="fastaOptionReadout"
                              id="uploadFastaOptionReadout"
                              value="upload"
                              autoComplete="off"
                              checked={fastaOptionReadout === "upload"}
                              onChange={() => setFastaOptionReadout("upload")}
                            />
                            <label className="btn btn-outline-primary" htmlFor="uploadFastaOptionReadout">
                              Upload File
                            </label>

                            <input
                              type="radio"
                              className="btn-check"
                              name="fastaOptionReadout"
                              id="useGeneratedFastaOptionReadout"
                              value="useGenerated"
                              autoComplete="off"
                              checked={fastaOptionReadout === "useGenerated"}
                              onChange={() => setFastaOptionReadout("useGenerated")}
                            />
                            <label className="btn btn-outline-primary" htmlFor="useGeneratedFastaOptionReadout">
                              Use Generated
                            </label>
                          </div>
                        </div>
                        {/* File upload area, only visible if "Upload File" is selected */}
                        <div className="w-50 d-flex align-items-center">
                          <input
                            type="file"
                            className="form-control visually-hidden"
                            id="files_fasta_reference_database_readout_probe"
                            name="files_fasta_reference_database_readout_probe"
                            onChange={handleFileChange}
                            multiple
                            disabled={fastaOptionReadout !== "upload"}
                          />
                          <label
                            htmlFor="files_fasta_reference_database_readout_probe"
                            className="btn btn-outline-primary me-2 w-100"
                            style={{
                              cursor: fastaOptionReadout !== "upload" ? "not-allowed" : "pointer",
                              opacity: fastaOptionReadout !== "upload" ? 0.5 : 1,
                              pointerEvents: fastaOptionReadout !== "upload" ? "none" : "auto"
                            }}
                          >
                            Choose Files
                          </label>
                          {/* Info icon with popover */}
                          <OverlayTrigger
                            trigger="hover"
                            placement="top"
                            overlay={
                              <Popover id="popover-files_fasta_reference_database_readout_probe">
                                <Popover.Body>
                                  {formData.files_fasta_reference_database_readout_probe.comment}
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
                      {/* Display selected file names */}
                      <div className="text-muted small mt-1">
                        {files.files_fasta_reference_database_readout_probe.length > 0
                          ? `Selected: ${files.files_fasta_reference_database_readout_probe.map(f => f.name).join(', ')}`
                          : "No files selected"}
                      </div>
</div>
                    {fastaOptionReadout ==='generate' && (

                            <>
                                <div className="row mb-3">
                                    <div className="col-auto">
                                        <label htmlFor="source" className="form-label">Select Source</label>
                                        <select
                                            className="form-select"
                                            id="source"
                                            name="source"
                                            value={selectedSourceReadout}
                                            onChange={handleSourceChangeReadout}
                                        >
                                            <option value="ncbi">NCBI</option>
                                            <option value="ensembl">Ensembl</option>
                                        </select>
                                    </div>

                                </div>

                                <div className="d-flex align-items-center">
                                    <div className="col-md-8">
                                        {/* Source Selection */}

                                        {/* Dynamic Content */}
                                        <div >
                                            {selectedSourceReadout === "ncbi" && (
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
                                                                        value={formDataNcbiReadout.source_params.taxon.value}
                                                                        onChange={handleChangeGenomicReadout}
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
                                                                                    {formDataNcbiReadout.source_params.taxon.comment}
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
                                                                    {formDataNcbiReadout.source_params.taxon.value === "vertebrate_mammalian" ? (
                                                                        <select
                                                                            name="source_params.species"
                                                                            className="form-select"
                                                                            id="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {vertebrate_mammalianEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "archaea" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {archaeaEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "bacteria" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "fungi" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {fungiEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "invertebrate" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {invertebrateEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "mitochondrion" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {mitochondrionEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "plant" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
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
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            {plasmidEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "plastid" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {plastidEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "protozoa" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {protozoaEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "unknown" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {unknownEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "vertebrate_other" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            name="source_params.species"
                                                                            onChange={handleChangeGenomicReadout}
                                                                        >
                                                                            <option value="">Select a species</option>
                                                                            {vertebrate_otherEntries.map((entry) => (
                                                                                <option key={entry} value={entry}>{entry}</option>
                                                                            ))}
                                                                        </select>
                                                                    ) : formDataNcbiReadout.source_params.taxon.value === "viral" ? (
                                                                        <select
                                                                            className="form-control"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataNcbiReadout.source_params.species.value}
                                                                            onChange={handleChangeGenomicReadout}
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
                                                                                    {formDataNcbiReadout.source_params.species.comment}
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
                                                                        value={formDataNcbiReadout.source_params.annotation_release.value}
                                                                        onChange={handleChangeGenomicReadout}
                                                                    />
                                                                    <OverlayTrigger
                                                                        trigger="hover"
                                                                        placement="top"
                                                                        overlay={
                                                                            <Popover id="dir_output">
                                                                                <Popover.Body>
                                                                                    {formDataNcbiReadout.source_params.annotation_release.comment}
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

                                                            {formDataNcbiReadout.genomic_regions.exon_exon_junction.value === "true" && (
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
                                                                            value={formDataNcbiReadout.exon_exon_junction_block_size.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                            placeholder="50"
                                                                        />
                                                                        <OverlayTrigger
                                                                            trigger="hover"
                                                                            placement="top"
                                                                            overlay={
                                                                                <Popover id="dir_output">
                                                                                    <Popover.Body>
                                                                                        {formDataNcbiReadout.exon_exon_junction_block_size.comment}
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
                                                                                formDataNcbiReadout.genomic_regions[region as keyof typeof formDataNcbiReadout.genomic_regions]?.value === "true"
                                                                            }
                                                                            onChange={(e) =>
                                                                                setFormDataNcbiReadout((prev) => ({
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
                                                                                        {formDataNcbiReadout.genomic_regions[region as keyof typeof formDataNcbiReadout.genomic_regions].comment}
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

                                            {selectedSourceReadout === "ensembl" && (
                                                <div>
                                                    <form onSubmit={handleSubmit}>
                                                        <div className="row g-3">
                                                            <div className="col-md-6">
                                                                <label htmlFor="species" className="form-label">Species</label>
                                                                <div className="d-flex align-items-center">
                                                                    <select
                                                                        className="form-select"
                                                                        id="source_params.species"
                                                                        name="source_params.species"
                                                                        value={formDataEnsReadout.source_params.species.value}
                                                                        onChange={handleChangeGenomicReadout}
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
                                                                                    {formDataEnsReadout.source_params.species.comment}
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
                                                                        value={formDataEnsReadout.source_params.annotation_release.value}
                                                                        onChange={handleChangeGenomicReadout}
                                                                        placeholder="current"
                                                                    />
                                                                    <OverlayTrigger
                                                                        trigger="hover"
                                                                        placement="top"
                                                                        overlay={
                                                                            <Popover id="dir_output">
                                                                                <Popover.Body>
                                                                                    {formDataEnsReadout.source_params.annotation_release.comment}
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

                                                            {formDataEnsReadout.genomic_regions.exon_exon_junction.value === "true" && (
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
                                                                            value={formDataEnsReadout.exon_exon_junction_block_size.value}
                                                                            onChange={handleChangeGenomicReadout}
                                                                            placeholder="50"
                                                                        />
                                                                        <OverlayTrigger
                                                                            trigger="hover"
                                                                            placement="top"
                                                                            overlay={
                                                                                <Popover id="dir_output">
                                                                                    <Popover.Body>
                                                                                        {formDataEnsReadout.exon_exon_junction_block_size.comment}
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
                                                                                formDataEnsReadout.genomic_regions[region as keyof typeof formDataEnsReadout.genomic_regions]?.value === "true"
                                                                            }
                                                                            onChange={(e) =>
                                                                                setFormDataEnsReadout((prev) => ({
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
                                                                                        {formDataEnsReadout.genomic_regions[region as keyof typeof formDataEnsReadout.genomic_regions].comment}
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
                        <label htmlFor="readout_probe_length" className="form-label">Length of readout
                            probes:</label>
                        <div className="d-flex align-items-center">
                            <input type="number" className="form-control" id="readout_probe_length"
                                   name="readout_probe_length"
                                   value={formData.readout_probe_length.value} onChange={handleChange} required/>
                            <OverlayTrigger
                                trigger="hover"
                                placement="top"
                                overlay={
                                    <Popover id="popover-n_jobs">
                                        <Popover.Body>
                                            {formData.readout_probe_length.comment}
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
                            <label htmlFor="readout_probe_base_prob_a" className="form-label">Probability of
                                base
                                A:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="readout_probe_base_probabilities.A"
                                       name="readout_probe_base_probabilities.A"
                                       value={formData.readout_probe_base_probabilities.A.value}
                                       onChange={handleChange}
                                       required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {formData.readout_probe_base_probabilities.A.comment}
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
                            <label htmlFor="readout_probe_base_prob_c" className="form-label">Probability of
                                base
                                C:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="readout_probe_base_probabilities.C"
                                       name="readout_probe_base_probabilities.C"
                                       value={formData.readout_probe_base_probabilities.C.value}
                                       onChange={handleChange}
                                       required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {formData.readout_probe_base_probabilities.C.comment}
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
                            <label htmlFor="readout_probe_base_prob_g" className="form-label">Probability of
                                base
                                A:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="readout_probe_base_probabilities.G"
                                       name="readout_probe_base_probabilities.G"
                                       value={formData.readout_probe_base_probabilities.G.value}
                                       onChange={handleChange}
                                       required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {formData.readout_probe_base_probabilities.G.comment}
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
                            <label htmlFor="readout_probe_base_prob_t" className="form-label">Probability of
                                base
                                A:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="readout_probe_base_probabilities.T"
                                       name="readout_probe_base_probabilities.T"
                                       value={formData.readout_probe_base_probabilities.T.value}
                                       onChange={handleChange}
                                       required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {formData.readout_probe_base_probabilities.T.comment}
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
                            <label htmlFor="readout_probe_GC_content_min" className="form-label">Minimum GC content:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="readout_probe_GC_content_min"
                                       name="readout_probe_GC_content_min"
                                       value={formData.readout_probe_GC_content_min.value} onChange={handleChange}
                                       required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-gc-min">
                                            <Popover.Body>
                                                {formData.readout_probe_GC_content_min.comment}
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
                            <label htmlFor="readout_probe_GC_content_max" className="form-label">Maximum GC
                                content:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="readout_probe_GC_content_max"
                                       name="readout_probe_GC_content_max"
                                       value={formData.readout_probe_GC_content_max.value} onChange={handleChange}
                                       required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-gc-max">
                                            <Popover.Body>
                                                {formData.readout_probe_GC_content_max.comment}
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
                        <label htmlFor="readout_probe_homopolymeric_base_n_g" className="form-label">Minimum
                            number of Nucleotides:</label>
                        <div className="d-flex align-items-center">
                            <input type="number" className="form-control"
                                   id="readout_probe_homopolymeric_base_n_g"
                                   name="readout_probe_homopolymeric_base_n.G"
                                   value={formData.readout_probe_homopolymeric_base_n.G.value}
                                   onChange={handleChange}
                                   required/>
                            <OverlayTrigger
                                trigger="hover"
                                placement="top"
                                overlay={
                                    <Popover id="popover-n_jobs">
                                        <Popover.Body>
                                            {formData.readout_probe_homopolymeric_base_n.G.comment}
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
                        <label htmlFor="readout_probe_set_size" className="form-label">Total number of readout
                            probes:</label>
                        <div className="d-flex align-items-center">
                            <input type="number" className="form-control" id="readout_probe_set_size"
                                   name="readout_probe_set_size"
                                   value={formData.readout_probe_set_size.value} onChange={handleChange}
                                   required/>
                            <OverlayTrigger
                                trigger="hover"
                                placement="top"
                                overlay={
                                    <Popover id="popover-n_jobs">
                                        <Popover.Body>

                                            {formData.readout_probe_set_size.comment}
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
                            <label htmlFor="readout_probe_homogeneous_properties_weights_tmnn"
                                   className="form-label">Homogeneous Properties Weights (TmNN):</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control"

                                       id="readout_probe_homogeneous_properties_weights.TmNN"
                                       name="readout_probe_homogeneous_properties_weights.TmNN"
                                       value={formData.readout_probe_homogeneous_properties_weights.TmNN.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {formData.readout_probe_homogeneous_properties_weights.TmNN.comment}

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
                            <label htmlFor="readout_probe_homogeneous_properties_weights_GC_content"
                                   className="form-label">Homogeneous Properties Weights (GC Content):</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control"
                                       id="readout_probe_homogeneous_properties_weights.GC_content"
                                       name="readout_probe_homogeneous_properties_weights.GC_content"
                                       value={formData.readout_probe_homogeneous_properties_weights.GC_content.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {formData.readout_probe_homogeneous_properties_weights.GC_content.comment}

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
                            <label htmlFor="n_bits" className="form-label">Number of Bits:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="n_bits"
                                       name="n_bits"
                                       value={formData.n_bits.value} onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n-bits">
                                            <Popover.Body>
                                                {formData.n_bits.comment}
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
                            <label htmlFor="min_hamming_dist" className="form-label">Minimum Hamming Distance:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="min_hamming_dist"
                                       name="min_hamming_dist"
                                       value={formData.min_hamming_dist.value} onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-hamming-dist">
                                            <Popover.Body>
                                                {formData.min_hamming_dist.comment}
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
                            <label htmlFor="hamming_weight" className="form-label">Hamming Weight:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="hamming_weight"
                                       name="hamming_weight"
                                       value={formData.hamming_weight.value} onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-hamming-weight">
                                            <Popover.Body>
                                                {formData.hamming_weight.comment}
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
                            <label htmlFor="channels_ids" className="form-label">Channel IDs:</label>
                            <div className="d-flex align-items-center">
                                <input type="text" className="form-control" id="channels_ids"
                                       name="channels_ids"
                                       value={formData.channels_ids.value} onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Body>
                                                {formData.channels_ids.comment}
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

            case 'primer_parameters':
                return (
                    <div>
                        <div className="mb-4">

                            <div className="mb-3">
                                <label htmlFor="files_fasta_reference_database_primer" className="form-label">
                                    Fasta Probe Primer Reference Database:
                                </label>
                                <div className="d-flex align-items-center w-100">
                                    {/* Hidden file input */}
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
                                        className="btn btn-outline-primary d-block  me-2 w-100"
                                        style={{
                                            cursor: generateFastaFilesPrimer ? "not-allowed" : "pointer",
                                            opacity: generateFastaFilesPrimer ? 0.5 : 1,
                                            pointerEvents: generateFastaFilesPrimer ? "none" : "auto"
                                        }}
                                    >
                                        Choose Files
                                    </label>
                                    {/* Info icon with popover */}
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {formData.files_fasta_reference_database_primer.comment}
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
                                    {files.files_fasta_reference_database_primer.length > 0
                                        ? `Selected: ${files.files_fasta_reference_database_primer.map(f => f.name).join(', ')}`
                                        : "No files selected"}
                                </div>
                            </div>
                            <div className="row mb-3">
                                <div className="col-auto d-flex align-items-center">
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id="generateFastaToggle"
                                            checked={generateFastaFilesPrimer}
                                            onChange={(e) => setGenerateFastaFilesPrimer(e.target.checked)}
                                        />
                                        <label className="form-check-label ms-2" htmlFor="generateFastaToggle">
                                            Generate FASTA files
                                        </label>
                                    </div>
                                </div>

                                {generateFastaFilesPrimer && (<div className="col-auto d-flex align-items-center">
                                        <div className="form-check form-switch">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="sameFastaToggle2"
                                                checked={useSameFasta2}
                                                onChange={(e) => setUseSameFasta2(e.target.checked)}
                                            />
                                            <label className="form-check-label ms-2" htmlFor="sameFastaToggle">
                                                Use same FASTA as probe DB
                                            </label>
                                        </div>
                                    </div>
                                )}


                            </div>

                            {generateFastaFilesPrimer && !useSameFasta2 &&(

                                <>
                                    <div className="row mb-3">
                                        <div className="col-auto">
                                            <label htmlFor="source" className="form-label">Select Source</label>
                                            <select
                                                className="form-select"
                                                id="source"
                                                name="source"
                                                value={selectedSourcePrimer}
                                                onChange={handleSourceChangePrimer}
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
                                                {selectedSourcePrimer === "ncbi" && (
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
                                                                            onChange={handleChangeGenomicPrimer}
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
                                                                                        {formDataNcbiPrimer.source_params.taxon.comment}
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
                                                                        {formDataNcbiPrimer.source_params.taxon.value === "vertebrate_mammalian" ? (
                                                                            <select
                                                                                name="source_params.species"
                                                                                className="form-select"
                                                                                id="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {vertebrate_mammalianEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "archaea" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {archaeaEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "bacteria" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "fungi" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {fungiEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "invertebrate" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {invertebrateEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "mitochondrion" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {mitochondrionEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "plant" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {plantEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "plasmid" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                {plasmidEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "plastid" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {plastidEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "protozoa" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicReadout}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {protozoaEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "unknown" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {unknownEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "vertebrate_other" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                name="source_params.species"
                                                                                onChange={handleChangeGenomicPrimer}
                                                                            >
                                                                                <option value="">Select a species</option>
                                                                                {vertebrate_otherEntries.map((entry) => (
                                                                                    <option key={entry} value={entry}>{entry}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : formDataNcbiPrimer.source_params.taxon.value === "viral" ? (
                                                                            <select
                                                                                className="form-control"
                                                                                id="source_params.species"
                                                                                name="source_params.species"
                                                                                value={formDataNcbiPrimer.source_params.species.value}
                                                                                onChange={handleChangeGenomicPrimer}
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
                                                                                        {formDataNcbiPrimer.source_params.species.comment}
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
                                                                            value={formDataNcbiPrimer.source_params.annotation_release.value}
                                                                            onChange={handleChangeGenomicPrimer}
                                                                        />
                                                                        <OverlayTrigger
                                                                            trigger="hover"
                                                                            placement="top"
                                                                            overlay={
                                                                                <Popover id="dir_output">
                                                                                    <Popover.Body>
                                                                                        {formDataNcbiPrimer.source_params.annotation_release.comment}
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

                                                                {formDataNcbiPrimer.genomic_regions.exon_exon_junction.value === "true" && (
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
                                                                                value={formDataNcbiPrimer.exon_exon_junction_block_size.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                                placeholder="50"
                                                                            />
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formDataNcbiPrimer.exon_exon_junction_block_size.comment}
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
                                                                                    formDataNcbiPrimer.genomic_regions[region as keyof typeof formDataNcbiPrimer.genomic_regions]?.value === "true"
                                                                                }
                                                                                onChange={(e) =>
                                                                                    setFormDataNcbiPrimer((prev) => ({
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
                                                                                            {formDataNcbiPrimer.genomic_regions[region as keyof typeof formDataNcbiPrimer.genomic_regions].comment}
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

                                                {selectedSourcePrimer === "ensembl" && (
                                                    <div>
                                                        <form onSubmit={handleSubmit}>
                                                            <div className="row g-3">
                                                                <div className="col-md-6">
                                                                    <label htmlFor="species" className="form-label">Species</label>
                                                                    <div className="d-flex align-items-center">
                                                                        <select
                                                                            className="form-select"
                                                                            id="source_params.species"
                                                                            name="source_params.species"
                                                                            value={formDataEnsPrimer.source_params.species.value}
                                                                            onChange={handleChangeGenomicPrimer}
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
                                                                                        {formDataEnsPrimer.source_params.species.comment}
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
                                                                            value={formDataEnsPrimer.source_params.annotation_release.value}
                                                                            onChange={handleChangeGenomicPrimer}
                                                                            placeholder="current"
                                                                        />
                                                                        <OverlayTrigger
                                                                            trigger="hover"
                                                                            placement="top"
                                                                            overlay={
                                                                                <Popover id="dir_output">
                                                                                    <Popover.Body>
                                                                                        {formDataEnsPrimer.source_params.annotation_release.comment}
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

                                                                {formDataEnsPrimer.genomic_regions.exon_exon_junction.value === "true" && (
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
                                                                                value={formDataEnsPrimer.exon_exon_junction_block_size.value}
                                                                                onChange={handleChangeGenomicPrimer}
                                                                                placeholder="50"
                                                                            />
                                                                            <OverlayTrigger
                                                                                trigger="hover"
                                                                                placement="top"
                                                                                overlay={
                                                                                    <Popover id="dir_output">
                                                                                        <Popover.Body>
                                                                                            {formDataEnsPrimer.exon_exon_junction_block_size.comment}
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
                                                                                    formDataEnsPrimer.genomic_regions[region as keyof typeof formDataEnsPrimer.genomic_regions]?.value === "true"
                                                                                }
                                                                                onChange={(e) =>
                                                                                    setFormDataEnsPrimer((prev) => ({
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
                                                                                            {formDataEnsPrimer.genomic_regions[region as keyof typeof formDataEnsPrimer.genomic_regions].comment}
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
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="reverse_primer_sequence" className="form-label">Reverse Primer Sequence:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="reverse_primer_sequence"
                                            name="reverse_primer_sequence"
                                            value={formData.reverse_primer_sequence.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-reverse-primer">
                                                    <Popover.Body>
                                                        {formData.reverse_primer_sequence.comment}
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
                                    <label htmlFor="primer_length" className="form-label">Primer Length:</label>
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
                                                        {formData.primer_length.comment}
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
                                    <label htmlFor="primer_base_probabilities_a" className="form-label">Probability of Base A:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_base_probabilities.A"
                                            name="primer_base_probabilities.A"
                                            value={formData.primer_base_probabilities.A.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-a">
                                                    <Popover.Header as="h3">Base A Probability</Popover.Header>
                                                    <Popover.Body>
                                                        {formData.primer_base_probabilities.A.comment}
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
                                    <label htmlFor="primer_base_probabilities_c" className="form-label">Probability of Base C:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_base_probabilities.C"
                                            name="primer_base_probabilities.C"
                                            value={formData.primer_base_probabilities.C.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-c">
                                                    <Popover.Header as="h3">Base C Probability</Popover.Header>
                                                    <Popover.Body>
                                                        {formData.primer_base_probabilities.C.comment}
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
                                    <label htmlFor="primer_base_probabilities_g" className="form-label">Probability of Base G:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_base_probabilities.G"
                                            name="primer_base_probabilities.G"
                                            value={formData.primer_base_probabilities.G.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-g">
                                                    <Popover.Header as="h3">Base G Probability</Popover.Header>
                                                    <Popover.Body>
                                                        {formData.primer_base_probabilities.G.comment}
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
                                    <label htmlFor="primer_base_probabilities_t" className="form-label">Probability of Base T:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_base_probabilities.T"
                                            name="primer_base_probabilities.T"
                                            value={formData.primer_base_probabilities.T.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-t">
                                                    <Popover.Header as="h3">Base T Probability</Popover.Header>
                                                    <Popover.Body>
                                                        {formData.primer_base_probabilities.T.comment}
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
                                    <label htmlFor="primer_GC_content_min" className="form-label">Min GC
                                        Content:</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_GC_content_min"
                                        name="primer_GC_content_min"
                                        value={formData.primer_GC_content_min.value}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="col">
                                    <label htmlFor="primer_GC_content_max" className="form-label">Max GC
                                        Content:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_GC_content_max"
                                            name="primer_GC_content_max"
                                            value={formData.primer_GC_content_max.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.primer_GC_content_max.comment}
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
                                    <label htmlFor="primer_number_GC_GCclamp" className="form-label">GC Clamp (GC
                                        Count):</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_number_GC_GCclamp"
                                            name="primer_number_GC_GCclamp"
                                            value={formData.primer_number_GC_GCclamp.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.primer_number_GC_GCclamp.comment}
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
                                    <label htmlFor="primer_number_three_prime_base_GCclamp" className="form-label">3'
                                        Base
                                        GC Clamp Count:</label>
                                    <div className="d-flex align-items-center">
                                    <input
                                            type="number"
                                            className="form-control"
                                            id="primer_number_three_prime_base_GCclamp"
                                            name="primer_number_three_prime_base_GCclamp"
                                            value={formData.primer_number_three_prime_base_GCclamp.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.primer_number_three_prime_base_GCclamp.comment}
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
                                <div className="col-md-3">
                                    <label htmlFor="primer_homopolymeric_base_n_a" className="form-label">Homopolymeric A:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_homopolymeric_base_n.A"
                                            name="primer_homopolymeric_base_n.A"
                                            value={formData.primer_homopolymeric_base_n.A.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-a">
                                                    <Popover.Body>
                                                        {formData.primer_homopolymeric_base_n.A.comment}
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
                                <div className="col-md-3">
                                    <label htmlFor="primer_homopolymeric_base_n_t" className="form-label">Homopolymeric T:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_homopolymeric_base_n.T"
                                            name="primer_homopolymeric_base_n.T"
                                            value={formData.primer_homopolymeric_base_n.T.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-t">
                                                    <Popover.Body>
                                                        {formData.primer_homopolymeric_base_n.T.comment}
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
                                <div className="col-md-3">
                                    <label htmlFor="primer_homopolymeric_base_n_c" className="form-label">Homopolymeric C:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_homopolymeric_base_n.C"
                                            name="primer_homopolymeric_base_n.C"
                                            value={formData.primer_homopolymeric_base_n.C.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-c">
                                                    <Popover.Header as="h3">Homopolymeric C</Popover.Header>
                                                    <Popover.Body>
                                                        {formData.primer_homopolymeric_base_n.C.comment}
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
                                <div className="col-md-3">
                                    <label htmlFor="primer_homopolymeric_base_n_g" className="form-label">Homopolymeric G:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_homopolymeric_base_n.G"
                                            name="primer_homopolymeric_base_n.G"
                                            value={formData.primer_homopolymeric_base_n.G.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-base-g">
                                                    <Popover.Body>
                                                        {formData.primer_homopolymeric_base_n.G.comment}
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
                                    <label htmlFor="primer_max_len_selfcomplement" className="form-label">Max Self-Complementary Length:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_max_len_selfcomplement"
                                            name="primer_max_len_selfcomplement"
                                            value={formData.primer_max_len_selfcomplement.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-selfcomplement">
                                                    <Popover.Body>
                                                        {formData.primer_max_len_selfcomplement.comment}
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
                                    <label htmlFor="primer_max_len_complement_reverse_primer" className="form-label">Max
                                        Complement Reverse Primer Length:</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_max_len_complement_reverse_primer"
                                            name="primer_max_len_complement_reverse_primer"
                                            value={formData.primer_max_len_complement_reverse_primer.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-reverse-complement">
                                                    <Popover.Body>
                                                        {formData.primer_max_len_complement_reverse_primer.comment}
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
                                    <label htmlFor="primer_Tm_min" className="form-label">Min Primer Tm (°C):</label>
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
                                                        {formData.primer_Tm_min.comment}
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
                                    <label htmlFor="primer_Tm_max" className="form-label">Max Primer Tm (°C):</label>
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
                                                        {formData.primer_Tm_max.comment}
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
                            <div className="row g-3">
                                <div className="col">
                                    <label htmlFor="primer_T_secondary_structure" className="form-label">Secondary
                                        Structure
                                        Temperature (°C):</label>
                                    <div className="d-flex align-items-center">
                                        <input
                                            type="number"
                                            className="form-control"
                                            id="primer_T_secondary_structure"
                                            name="primer_T_secondary_structure"
                                            value={formData.primer_T_secondary_structure.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.primer_T_secondary_structure.comment}
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
                                    <label htmlFor="primer_secondary_structures_threshold_deltaG"
                                           className="form-label">Threshold
                                        Delta G:</label>
                                    <div className="d-flex align-items-center">
                                    <input
                                            type="number"
                                            className="form-control"
                                            id="primer_secondary_structures_threshold_deltaG"
                                            name="primer_secondary_structures_threshold_deltaG"
                                            value={formData.primer_secondary_structures_threshold_deltaG.value}
                                            onChange={handleChange}
                                        />
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-n_jobs">
                                                    <Popover.Body>
                                                        {formData.primer_secondary_structures_threshold_deltaG.comment}
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
                                    <input type="number" className="form-control" id="target_probe_specificity_blastn_search_parameters.word_size"
                                           name="target_probe_specificity_blastn_search_parameters.word_size"
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
                                    <input type="number" className="form-control" id="target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length"
                                           name="target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length"
                                           value={formData.target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length.value}
                                           onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length.comment}
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
                                           id="target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length" name="target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length"
                                           value={formData.target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Body>
                                                    {formData.target_probe_cross_hybridization_blastn_hit_parameters.min_alignment_length.comment}
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
                                    <input type="number" className="form-control" id="heuristic_n_attempts"
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
                                        <input type="number" className="form-control" id="target_probe_Tm_parameters.K."
                                               name="target_probe_Tm_parameters.K."
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
            case'readout':
                return (
                    <div>
                        <div className="mb-4">

                            <div className="row g-3">


                            <div className="col">
                                <label htmlFor="readout_probe_initial_num_sequences" className="form-label">Initial Number of Sequences:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="readout_probe_initial_num_sequences"
                                           name="readout_probe_initial_num_sequences"
                                           value={formData.readout_probe_initial_num_sequences.value} onChange={handleChange}
                                           required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-initial-sequences">
                                                <Popover.Body>
                                                    {formData.readout_probe_initial_num_sequences.comment}
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
                                    <label htmlFor="perc_identity" className="form-label">Percentage Identity:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="readout_probe_specificity_blastn_search_parameters.perc_identity"
                                               name="readout_probe_specificity_blastn_search_parameters.perc_identity"
                                               value={formData.readout_probe_specificity_blastn_search_parameters.perc_identity.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-perc-identity">
                                                    <Popover.Body>
                                                        {formData.readout_probe_specificity_blastn_search_parameters.perc_identity.comment}
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
                                    <label htmlFor="strand" className="form-label">Strand:</label>
                                    <div className="d-flex align-items-center">
                                        <select className="form-select" id="strand"
                                                name="readout_probe_specificity_blastn_search_parameters.strand"
                                                value={formData.readout_probe_specificity_blastn_search_parameters.strand.value}
                                                onChange={handleChange}>
                                            <option value="minus">Minus</option>
                                            <option value="plus">Plus</option>
                                        </select>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-strand">
                                                    <Popover.Body>
                                                        {formData.readout_probe_specificity_blastn_search_parameters.strand.comment}
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
                                    <label htmlFor="word_size" className="form-label">Word Size:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="word_size"
                                               name="readout_probe_specificity_blastn_search_parameters.word_size"
                                               value={formData.readout_probe_specificity_blastn_search_parameters.word_size.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-word-size">
                                                    <Popover.Body>
                                                        {formData.readout_probe_specificity_blastn_search_parameters.word_size.comment}
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
                                    <label htmlFor="dust" className="form-label">Dust:</label>
                                    <div className="d-flex align-items-center">
                                        <select className="form-select" id="readout_probe_specificity_blastn_search_parameters.dust"
                                                name="readout_probe_specificity_blastn_search_parameters.dust"
                                                value={formData.readout_probe_specificity_blastn_search_parameters.dust.value}
                                                onChange={handleChange}>
                                            <option value="no">No</option>
                                            <option value="yes">Yes</option>
                                        </select>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-dust">
                                                    <Popover.Header as="h3">Dust Filtering</Popover.Header>
                                                    <Popover.Body>
                                                        {formData.readout_probe_specificity_blastn_search_parameters.dust.comment}
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
                                    <label htmlFor="soft_masking" className="form-label">Soft Masking:</label>
                                    <div className="d-flex align-items-center">
                                        <select className="form-select" id="soft_masking"
                                                name="readout_probe_specificity_blastn_search_parameters.soft_masking"
                                                value={formData.readout_probe_specificity_blastn_search_parameters.soft_masking.value}
                                                onChange={handleChange}>
                                            <option value="false">False</option>
                                            <option value="true">True</option>
                                        </select>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-soft-masking">
                                                    <Popover.Body>
                                                        {formData.readout_probe_specificity_blastn_search_parameters.soft_masking.comment}
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
                                    <label htmlFor="max_target_seqs" className="form-label">Max Target
                                        Sequences:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="max_target_seqs"
                                               name="readout_probe_specificity_blastn_search_parameters.max_target_seqs"
                                               value={formData.readout_probe_specificity_blastn_search_parameters.max_target_seqs.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-max-target-seqs">
                                                    <Popover.Body>
                                                        {formData.readout_probe_specificity_blastn_search_parameters.max_target_seqs.comment}
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
                                    <label htmlFor="max_hsps" className="form-label">Max HSPs:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="number" className="form-control" id="max_hsps"
                                               name="readout_probe_specificity_blastn_search_parameters.max_hsps"
                                               value={formData.readout_probe_specificity_blastn_search_parameters.max_hsps.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-max-hsps">
                                                    <Popover.Header as="h3">Maximum HSPs</Popover.Header>
                                                    <Popover.Body>
                                                        {formData.readout_probe_specificity_blastn_search_parameters.max_hsps.comment}
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
                                <div>
                                    <h4>Readout Probe BLASTn Hit Parameters</h4>
                                    <div className="mb-3">
                                        <label htmlFor="min_alignment_length" className="form-label">Min Alignment
                                            Length:</label>
                                        <div className="d-flex align-items-center">
                                            <input type="number" className="form-control" id="readout_probe_specificity_blastn_hit_parameters.min_alignment_length"
                                                   name="readout_probe_specificity_blastn_hit_parameters.min_alignment_length"
                                                   value={formData.readout_probe_specificity_blastn_hit_parameters.min_alignment_length.value}
                                                   onChange={handleChange} required/>
                                            <OverlayTrigger
                                                trigger="hover"
                                                placement="top"
                                                overlay={
                                                    <Popover id="popover-min-alignment">

                                                        <Popover.Body>
                                                            {formData.readout_probe_specificity_blastn_hit_parameters.min_alignment_length.comment}
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
            case 'primerpro':
                return (
                    <div>
                        <div className="row g-3">


                        <div className="col">
                            <label htmlFor="primer_initial_num_sequences" className="form-label">Initial Number of
                                Sequences:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_initial_num_sequences"
                                       name="primer_initial_num_sequences"
                                       value={formData.primer_initial_num_sequences.value} onChange={handleChange}
                                       required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-initial-sequences">
                                            <Popover.Body>
                                                {formData.primer_initial_num_sequences.comment}
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
                        <div className="col">
                            <label htmlFor="perc_identity" className="form-label">Percentage Identity:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="perc_identity"
                                       name="primer_specificity_refrence_blastn_search_parameters.perc_identity"
                                       value={formData.primer_specificity_refrence_blastn_search_parameters.perc_identity.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-perc-identity">
                                            <Popover.Body>
                                                {formData.primer_specificity_refrence_blastn_search_parameters.perc_identity.comment}
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

                        <div className="col">
                            <label htmlFor="strand" className="form-label">Strand:</label>
                            <div className="d-flex align-items-center">
                                <select className="form-select" id="strand"
                                        name="primer_specificity_refrence_blastn_search_parameters.strand"
                                        value={formData.primer_specificity_refrence_blastn_search_parameters.strand.value}
                                        onChange={handleChange}>
                                    <option value="minus">Minus</option>
                                    <option value="plus">Plus</option>
                                </select>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-strand">
                                            <Popover.Body>
                                                {formData.primer_specificity_refrence_blastn_search_parameters.strand.comment}
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
                        <div className="row g-3">
                        <div className="col">
                            <label htmlFor="word_size" className="form-label">Word Size:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="word_size"
                                       name="primer_specificity_refrence_blastn_search_parameters.word_size"
                                       value={formData.primer_specificity_refrence_blastn_search_parameters.word_size.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-word-size">
                                            <Popover.Body>
                                                {formData.primer_specificity_refrence_blastn_search_parameters.word_size.comment}
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

                        <div className="col">
                            <label htmlFor="dust" className="form-label">Dust:</label>
                            <div className="d-flex align-items-center">
                                <select className="form-select" id="dust"
                                        name="primer_specificity_refrence_blastn_search_parameters.dust"
                                        value={formData.primer_specificity_refrence_blastn_search_parameters.dust.value}
                                        onChange={handleChange}>
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </select>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-dust">
                                            <Popover.Body>
                                                {formData.primer_specificity_refrence_blastn_search_parameters.dust.comment}
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
                        <div className="col">
                            <label htmlFor="soft_masking" className="form-label">Soft Masking:</label>
                            <div className="d-flex align-items-center">
                                <select className="form-select" id="soft_masking"
                                        name="primer_specificity_refrence_blastn_search_parameters.soft_masking"
                                        value={formData.primer_specificity_refrence_blastn_search_parameters.soft_masking.value}
                                        onChange={handleChange}>
                                    <option value="false">False</option>
                                    <option value="true">True</option>
                                </select>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-soft-masking">
                                            <Popover.Header as="h3">Soft Masking</Popover.Header>
                                            <Popover.Body>
                                                {formData.primer_specificity_refrence_blastn_search_parameters.soft_masking.comment}
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
                        <div className="row g-3">



                        <div className="col">
                            <label htmlFor="max_target_seqs" className="form-label">Max Target Sequences:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="max_target_seqs"
                                       name="primer_specificity_refrence_blastn_search_parameters.max_target_seqs"
                                       value={formData.primer_specificity_refrence_blastn_search_parameters.max_target_seqs.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-max-target-seqs">
                                            <Popover.Body>
                                                {formData.primer_specificity_refrence_blastn_search_parameters.max_target_seqs.comment}
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

                        <div className="col">
                            <label htmlFor="max_hsps" className="form-label">Max HSPs:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_specificity_refrence_blastn_search_parameters.max_hsps"
                                       name="primer_specificity_refrence_blastn_search_parameters.max_hsps"
                                       value={formData.primer_specificity_refrence_blastn_search_parameters.max_hsps.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-max-hsps">
                                            <Popover.Body>
                                                {formData.primer_specificity_refrence_blastn_search_parameters.max_hsps.comment}
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
                        <div className="col">
                            <label htmlFor="min_alignment_length" className="form-label">Min Alignment Length:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="min_alignment_length"
                                       name="primer_specificity_refrence_blastn_hit_parameters.min_alignment_length"
                                       value={formData.primer_specificity_refrence_blastn_hit_parameters.min_alignment_length.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-min-alignment-length">
                                            <Popover.Body>
                                                {formData.primer_specificity_refrence_blastn_hit_parameters.min_alignment_length.comment}
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
                        <div className="row g-3">

                        <div className="col">
                            <label htmlFor="perc_identity" className="form-label">Percentage Identity:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="perc_identity"
                                       name="primer_specificity_encoding_probes_blastn_search_parameters.perc_identity"
                                       value={formData.primer_specificity_encoding_probes_blastn_search_parameters.perc_identity.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-enc-perc-identity">
                                            <Popover.Body>
                                                {formData.primer_specificity_encoding_probes_blastn_search_parameters.perc_identity.comment}
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

                        <div className="col">
                            <label htmlFor="strand" className="form-label">Strand:</label>
                            <div className="d-flex align-items-center">
                                <select className="form-select" id="strand"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.strand"
                                        value={formData.primer_specificity_encoding_probes_blastn_search_parameters.strand.value}
                                        onChange={handleChange}>
                                    <option value="minus">Minus</option>
                                    <option value="plus">Plus</option>
                                </select>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-enc-strand">
                                            <Popover.Body>
                                                {formData.primer_specificity_encoding_probes_blastn_search_parameters.strand.comment}
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

                        <div className="col">
                            <label htmlFor="word_size" className="form-label">Word Size:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="word_size"
                                       name="primer_specificity_encoding_probes_blastn_search_parameters.word_size"
                                       value={formData.primer_specificity_encoding_probes_blastn_search_parameters.word_size.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-enc-word-size">
                                            <Popover.Body>
                                                {formData.primer_specificity_encoding_probes_blastn_search_parameters.word_size.comment}
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
                        <div className="row g-3">


                        <div className="col">
                            <label htmlFor="dust" className="form-label">Dust:</label>
                            <div className="d-flex align-items-center">
                                <select className="form-select" id="dust"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.dust"
                                        value={formData.primer_specificity_encoding_probes_blastn_search_parameters.dust.value}
                                        onChange={handleChange}>
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </select>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-enc-dust">
                                            <Popover.Body>
                                                {formData.primer_specificity_encoding_probes_blastn_search_parameters.dust.comment}
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

                        <div className="col">
                            <label htmlFor="soft_masking" className="form-label">Soft Masking:</label>
                            <div className="d-flex align-items-center">
                                <select className="form-select" id="soft_masking"
                                        name="primer_specificity_encoding_probes_blastn_search_parameters.soft_masking"
                                        value={formData.primer_specificity_encoding_probes_blastn_search_parameters.soft_masking.value}
                                        onChange={handleChange}>
                                    <option value="false">False</option>
                                    <option value="true">True</option>
                                </select>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-enc-soft-masking">
                                            <Popover.Body>
                                                {formData.primer_specificity_encoding_probes_blastn_search_parameters.soft_masking.comment}
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

                        <div className="col">
                            <label htmlFor="max_target_seqs" className="form-label">Max Target Sequences:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_specificity_encoding_probes_blastn_search_parameters.max_target_seqs"
                                       name="primer_specificity_encoding_probes_blastn_search_parameters.max_target_seqs"
                                       value={formData.primer_specificity_encoding_probes_blastn_search_parameters.max_target_seqs.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-enc-max-target-seqs">
                                            <Popover.Body>
                                                {formData.primer_specificity_encoding_probes_blastn_search_parameters.max_target_seqs.comment}
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

                        <div className="row g-3">


                        <div className="col">
                            <label htmlFor="max_hsps" className="form-label">Max HSPs:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="max_hsps"
                                       name="primer_specificity_encoding_probes_blastn_search_parameters.max_hsps"
                                       value={formData.primer_specificity_encoding_probes_blastn_search_parameters.max_hsps.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-enc-max-hsps">
                                            <Popover.Body>
                                                {formData.primer_specificity_encoding_probes_blastn_search_parameters.max_hsps.comment}
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
                        <div className="col">
                            <label htmlFor="min_alignment_length" className="form-label">Min Alignment Length:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_specificity_encoding_probes_blastn_hit_parameters.min_alignment_length"
                                       name="primer_specificity_encoding_probes_blastn_hit_parameters.min_alignment_length"
                                       value={formData.primer_specificity_encoding_probes_blastn_hit_parameters.min_alignment_length.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-nn-table">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.nn_table.comment}
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
                        <div className="col">
                            <label htmlFor="nn_table" className="form-label">NN Table:</label>
                            <div className="d-flex align-items-center">
                                <input type="text" className="form-control" id="primer_Tm_parameters.nn_table"
                                       name="primer_Tm_parameters.nn_table"
                                       value={formData.primer_Tm_parameters.nn_table.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-nn-table">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.nn_table.comment }
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
                        <div className="row g-3">


                            <div className="col">
                                <label htmlFor="tmm_table" className="form-label">TMM Table:</label>
                                <div className="d-flex align-items-center">
                                    <input type="text" className="form-control" id="primer_Tm_parameters.tmm_table"
                                           name="primer_Tm_parameters.tmm_table"
                                           value={formData.primer_Tm_parameters.tmm_table.value}
                                           onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-tmm-table">
                                                <Popover.Body>
                                                    {formData.primer_Tm_parameters.tmm_table.comment}
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

                            <div className="col">
                                <label htmlFor="imm_table" className="form-label">IMM Table:</label>
                                <div className="d-flex align-items-center">
                                    <input type="text" className="form-control" id="primer_Tm_parameters.imm_table"
                                           name="primer_Tm_parameters.imm_table"
                                           value={formData.primer_Tm_parameters.imm_table.value}
                                           onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-imm-table">
                                                <Popover.Body>
                                                    {formData.primer_Tm_parameters.imm_table.comment}
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

                            <div className="col">
                                    <label htmlFor="de_table" className="form-label">DE Table:</label>
                                    <div className="d-flex align-items-center">
                                        <input type="text" className="form-control" id="primer_Tm_parameters.de_table"
                                               name="primer_Tm_parameters.de_table"
                                               value={formData.primer_Tm_parameters.de_table.value}
                                               onChange={handleChange} required/>
                                        <OverlayTrigger
                                            trigger="hover"
                                            placement="top"
                                            overlay={
                                                <Popover id="popover-de-table">
                                                    <Popover.Body>
                                                        {formData.primer_Tm_parameters.de_table.comment}
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
                        <div className="row g-3">


                        <div className="col">
                            <label htmlFor="dnac1" className="form-label">DNA Concentration 1 (dnac1):</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_Tm_parameters.dnac1"
                                       name="primer_Tm_parameters.dnac1"
                                       value={formData.primer_Tm_parameters.dnac1.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-dnac1">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.dnac1.comment
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

                        <div className="col">
                            <label htmlFor="dnac2" className="form-label">DNA Concentration 2 (dnac2):</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_Tm_parameters.dnac2"
                                       name="primer_Tm_parameters.dnac2"
                                       value={formData.primer_Tm_parameters.dnac2.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-dnac2">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.dnac2.comment
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

                        <div className=" row g-3">


                        <div className="col">
                            <label htmlFor="saltcorr" className="form-label">Salt Correction (saltcorr):</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_Tm_parameters.saltcorr"
                                       name="primer_Tm_parameters.saltcorr"
                                       value={formData.primer_Tm_parameters.saltcorr.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-saltcorr">
                                            <Popover.Header as="h3">Salt Correction</Popover.Header>
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.saltcorr.comment}
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

                        <div className="col">
                            <label htmlFor="Na" className="form-label">Sodium Concentration (Na):</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_Tm_parameters.Na"
                                       name="primer_Tm_parameters.Na"
                                       value={formData.primer_Tm_parameters.Na.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-na-concentration">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.Na.comment}
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
                        <div className="col">
                            <label htmlFor="K" className="form-label">Potassium Concentration (K):</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_Tm_parameters.K"
                                       name="primer_Tm_parameters.K"
                                       value={formData.primer_Tm_parameters.K.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-k-concentration">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.K.comment}
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
                        <div className="row g-3">

                        <div className="col">
                            <label htmlFor="Tris" className="form-label">Tris Concentration:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_Tm_parameters.Tris"
                                       name="primer_Tm_parameters.Tris"
                                       value={formData.primer_Tm_parameters.Tris.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-tris-concentration">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.Tris.comment
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

                        <div className="col">
                            <label htmlFor="Mg" className="form-label">Magnesium Concentration (Mg):</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_Tm_parameters.Mg"
                                       name="primer_Tm_parameters.Mg"
                                       value={formData.primer_Tm_parameters.Mg.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-mg-concentration">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.Mg.comment
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

                        <div className="col">
                            <label htmlFor="dNTPs" className="form-label">dNTPs Concentration:</label>
                            <div className="d-flex align-items-center">
                                <input type="number" className="form-control" id="primer_Tm_parameters.dNTPs"
                                       name="primer_Tm_parameters.dNTPs"
                                       value={formData.primer_Tm_parameters.dNTPs.value}
                                       onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-dntps-concentration">
                                            <Popover.Body>
                                                {formData.primer_Tm_parameters.dNTPs.comment
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
    const handleSubmitGenomicReadout = async (e?: React.FormEvent): Promise<any | null> => {
        e?.preventDefault();
        let finalFormData;

        try {
            if (selectedSourceReadout === 'ncbi') {
                finalFormData = formDataNcbiReadout;
            } else if (selectedSourceReadout === 'ensembl') {
                finalFormData = formDataEnsReadout;
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
                `http://localhost:5000/api/genomic/${selectedSourceReadout}`,
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
    const handleSubmitGenomicPrimer = async (e?: React.FormEvent): Promise<any | null> => {
        e?.preventDefault();
        let finalFormData;

        try {
            if (selectedSourcePrimer === 'ncbi') {
                finalFormData = formDataNcbiPrimer;
            } else if (selectedSourcePrimer === 'ensembl') {
                finalFormData = formDataEnsPrimer;
            } else if (selectedSourcePrimer === 'custom') {
                if (!areAllFilesUploaded()) {
                    alert('Please upload all required files before submitting.');
                    setLoading(false);
                    return null;
                }

                const uploadedPaths = await uploadFiles();
                finalFormData = { ...formDataCustomPrimer };

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
                `http://localhost:5000/api/genomic/${selectedSourcePrimer}`,
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

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // First: submit genomic
        if (generateFastaFiles) {
            formData['files_fasta_target_probe_database']['value'] = await handleSubmitGenomic();
            formData['files_fasta_reference_database_target_probe']['value'] = await handleSubmitGenomicref();

        }
        if (useSameFasta){
            formData['files_fasta_reference_database_readout_probe']['value'] = formData['files_fasta_target_probe_database']['value']

        }
        else
        {
            formData['files_fasta_reference_database_readout_probe']['value']= await handleSubmitGenomicReadout();
        }
        if (useSameFasta2){
            formData['files_fasta_reference_database_primer']['value'] = formData['files_fasta_target_probe_database']['value']

        }
        else{
            formData['files_fasta_reference_database_primer']['value'] = await handleSubmitGenomicPrimer();
        }

        // Then: handle scrinshot
        if (!areAllFilesUploaded()) {
            alert('Please upload all required files before submitting.');
            setLoading(false);
            return;
        }
        const runid= await createRunId();

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

            const response = await axios.post('http://localhost:5000/api/merfish', {formdata:finalFormData,runid:runid} , {
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
                    <h2 className="text-center mb-4">Merfish Probe Designer</h2>
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

                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link ${activeTab === "readout" ? "active" : ""}`}
                                onClick={() => setActiveTab("readout")}
                            >
                                Readout Probe Parameters
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link ${activeTab === "primer_parameters" ? "active" : ""}`}
                                onClick={() => setActiveTab("primer_parameters")}
                            >
                                Primer Parameters
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
                                            className={`nav-link ${activetab2 === "readout" ? "active" : ""}`}
                                            onClick={() => setActivetab2("readout")}
                                        >
                                            Readout Parameters
                                        </button>
                                    </li>
                                    <li className="nav-item">
                                        <button
                                            type="button"
                                            className={`nav-link ${activetab2 === "primerpro" ? "active" : ""}`}
                                            onClick={() => setActivetab2("primerpro")}
                                        >
                                            Primer Parameters
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
                                disabled={isSubmitting}
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

export default Merfish;