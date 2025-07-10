import React, { useState,useEffect} from 'react';
import Navbar from "../modules/nav";
import axios from "axios";
import {OverlayTrigger, Popover} from "react-bootstrap";
import {InfoCircle} from "react-bootstrap-icons";
import oligoseq_form from "../forms/oligoseq_form";
import form_Data_Ncbi from "../forms/genomic_ncbi_form";
import form_Data_Ens from "../forms/genomic_ens_form";
import form_Data_Custom from "../forms/genomic_custom_form";
import {createRunId} from "../modules/helpers";
import FastaGenerateForm from "../modules/FastaGenerateForm";


const OligoSeq: React.FC = () => {
    const defaultFastaForm = {
          selectedSource: "ncbi",
          formDataNcbi: JSON.parse(JSON.stringify(form_Data_Ncbi)),
          formDataEns: JSON.parse(JSON.stringify(form_Data_Ens)),
        };
    const [fastaForms, setFastaForms] = useState([{ ...defaultFastaForm }]);
    const [fastaFormsReference, setFastaFormsReference] = useState([{ ...defaultFastaForm }]);
    const [fastaOption, setFastaOption] = useState("upload"); // "generate" or "upload"
    const [fastaOption2, setFastaOption2] = useState("upload"); // "generate" or "upload"
    const [loading, setLoading] = useState(false);
    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [status, setStatus] = useState("idle");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generateFastaFiles, setGenerateFastaFiles] = useState(false);
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

                                {fastaOption === "generate" && (
                                  <form
                                    onSubmit={handleSubmit}
                                  >
                                    <div className="mb-2">
                                      <button
                                        type="button"
                                        className="btn btn-outline-primary"
                                        onClick={() => setFastaForms(forms => [...forms, { ...defaultFastaForm }])}
                                      >
                                        + Add Species/Source
                                      </button>
                                    </div>
                                    {fastaForms.map((form, idx) => (
                                      <FastaGenerateForm
                                        key={idx}
                                        form={form}
                                        onChange={updatedForm =>
                                          setFastaForms(forms => forms.map((f, i) => (i === idx ? updatedForm : f)))
                                        }
                                        onRemove={() =>
                                          setFastaForms(forms => forms.length === 1 ? forms : forms.filter((_, i) => i !== idx))
                                        }
                                        disableRemove={fastaForms.length === 1}
                                      />
                                    ))}
                                  </form>
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

                                    <form
                                    onSubmit={handleSubmit}
                                  >
                                    <div className="mb-2">
                                      <button
                                        type="button"
                                        className="btn btn-outline-primary"
                                        onClick={() => setFastaFormsReference(forms => [...forms, { ...defaultFastaForm }])}
                                      >
                                        + Add Species/Source
                                      </button>
                                    </div>
                                    {fastaFormsReference.map((form, idx) => (
                                      <FastaGenerateForm
                                        key={idx}
                                        form={form}
                                        onChange={updatedForm =>
                                          setFastaFormsReference(forms => forms.map((f, i) => (i === idx ? updatedForm : f)))
                                        }
                                        onRemove={() =>
                                          setFastaFormsReference(forms => forms.length === 1 ? forms : forms.filter((_, i) => i !== idx))
                                        }
                                        disableRemove={fastaFormsReference.length === 1}
                                      />
                                    ))}
                                  </form>
                                )}
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
                        <h6 className="pt-2">Minimum number of nucleotides to consider it a homopolymeric run per
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
        ): Promise<string | null> => {
            e?.preventDefault();
            setLoadingFn?.(true);
            try {
                if (!Array.isArray(forms) || forms.length === 0) {
                    alert('No FASTA forms to submit.');
                    setLoadingFn?.(false);
                    return null;
                }
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
                return null;
            } finally {
                setLoadingFn?.(false);
            }
        };


    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const runid= await createRunId();

        // First: submit genomic
        if (fastaOption === 'generate') {
                // @ts-ignore
                formData['files_fasta_target_probe_database']['value'] = await handleSubmitGenomicAll(fastaForms,setLoading);
            }
       if (fastaOption2 === 'generate') {
                // f need to batch for reference, similar logic can be applied here
                // @ts-ignore
                formData['files_fasta_reference_database_target_probe']['value'] = await handleSubmitGenomicAll(fastaFormsReference,setLoading);
        }
       else if (fastaOption2 === 'usegenerated') {
            formData['files_fasta_reference_database_target_probe']['value'] = formData['files_fasta_target_probe_database']['value'];
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

            await axios.post('http://localhost:5000/api/oligoseq', {formdata:finalFormData,runid:runid}, {
                withCredentials: true,
                headers: { "Content-Type": "application/json" },
            });

            setStatus("running");
            alert('Both forms submitted successfully!');
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
                    <h2 className="text-center mb-4">Oligo-Seq Designer</h2>
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