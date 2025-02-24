import React, { useState, useEffect } from 'react';
import Navbar from "../modules/nav";
import axios from "axios";
import {OverlayTrigger, Popover} from "react-bootstrap";
import {InfoCircle} from "react-bootstrap-icons";
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
            files.file_regions !== null &&
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
                const formData = new FormData();
                // @ts-ignore
                if (Array.isArray(files[key])) {
                    console.log(`Processing multiple files for key: ${key}`);
                    let paths = []; // Temporary array to collect file paths
                    // @ts-ignore
                    for (const file of files[key]) { // Use for...of to iterate over the array
                        console.log(file);
                        const formData = new FormData();
                        formData.append("file", file);
                        // Perform upload logic here
                        try {
                            const response = await axios.post(
                                "http://localhost:5000/api/upload",
                                formData,
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
                    // @ts-ignore
                    formData.append("file", files[key]);
                    // @ts-ignore
                    try {
                        const response = await axios.post(
                            "http://localhost:5000/api/upload",
                            formData,
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
        // General Parameters
        n_jobs: "4",
        dir_output: "output_merfish_probe_designer",
        write_intermediate_steps: "true",
        top_n_sets: '3',

        // Probe Sequences Generation
        file_regions: "",
        files_fasta_target_probe_database: ``,
        files_fasta_reference_database_target_probe: '',
        probe_length_min: "40",
        probe_length_max: "45",
        target_probe_split_region: '4',
        target_probe_targeted_exons: '1', // also need to be string in the yaml
        probe_isoform_consensus: "50",

        // Probe Property Filters
        probe_GC_content_min: "40",
        probe_GC_content_opt: "50",
        probe_GC_content_max: "60",
        probe_Tm_min: "65",
        probe_Tm_opt: "70",
        probe_Tm_max: "75",
        target_probe_secondary_structures_T: '76',
        target_probe_secondary_structures_threshold_deltaG: '0',
        homopolymeric_A: "6",
        homopolymeric_T: "6",
        homopolymeric_C: "6",
        homopolymeric_G: "6",

        target_probe_max_len_selfcomplement: '10',
        target_probe_hybridization_probability_threshold: '0.001',
        target_probe_GC_weight: "1",
        target_probe_Tm_weight: "1",
        set_size_min: "50",
        set_size_opt: "50",
        distance_between_probes: "0",
        n_sets: "100",


        // DEVELOPER PARAMETERS
        // Target Probe Parameters
        target_probe_hybridization_probability_alignment_method: 'blastn', // another option bowtie
        target_probe_hybridization_probability_blastn_search_parameters_perc_identity: "80",
        target_probe_hybridization_probability_blastn_search_parameters_strand: "minus", // this parameter is fixed, if reference is whole genome, consider using "both"
        target_probe_hybridization_probability_blastn_search_parameters_word_size: "10",
        target_probe_hybridization_probability_blastn_hit_parameters_coverage: '50',
        target_probe_hybridization_probability_bowtie_search_parameters_nofw: '', //# this parameter is fixed, if reference is whole genome, consider using both strands (remove this parameter)
        target_probe_hybridization_probability_bowtie_search_parameters_v: '3',

        target_probe_cross_hybridization_alignment_method: 'blastn',


        target_probe_cross_hybridization_blastn_search_parameters_perc_identity: "80",
        target_probe_cross_hybridization_blastn_search_parameters_strand: "minus", // this parameter is fixed
        target_probe_cross_hybridization_blastn_search_parameters_word_size: "7",

        target_probe_cross_hybridization_blastn_search_parameters_coverage: '50',

        target_probe_cross_hybridization_bowtie_search_parameters_nofw: '', //# this parameter is fixed, if reference is whole genome, consider using both strands (remove this parameter)
        target_probe_cross_hybridization_bowtie_search_parameters_v: '3',

        max_graph_size: "5000", // maximum number of oligos considered
        pre_filter: "true", // whether pre-filtering is enabled
        n_attempts: "100000",
        heuristic: "true",
        heuristic_n_attempts: "100",

        Tm_probe_check: "true",
        Tm_probe_strict: "true",
        Tm_probe_c_seq: "null",
        Tm_probe_shift: "0",
        Tm_probe_nn_table: "DNA_NN4",
        Tm_probe_tmm_table: "DNA_TMM1",
        Tm_probe_imm_table: "DNA_IMM1",
        DE_probe_imm_table: "DNA_DE1",
        Tm_probe_dnac1: "5",
        Tm_probe_dnac2: "0",
        selfcomp: "false",
        Tm_probe_saltcorr: "5",
        Tm_probe_Na: "300",
        Tm_probe_K: "0",
        Tm_probe_Tris: "0",
        Tm_probe_Mg: "0",
        Tm_probe_dNTPs: "0",

        target_probe_Tm_chem_correction_parameters_DMSO: "0",
        target_probe_Tm_chem_correction_parameters_DMSOfactor: "0.75",
        target_probe_Tm_chem_correction_parameters_fmdfactor: "0.65",
        target_probe_Tm_chem_correction_parameters_fmdmethod: "1",
        target_probe_Tm_chem_correction_parameters_GC: "null",
        target_probe_Tm_chem_correction_parameters_fmd: "20",

        target_probe_Tm_salt_correction_parameters: "null",

        // Readout Probe Parameters

    });
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
                                        value={formData.n_jobs}
                                        onChange={handleChange}
                                        required
                                    />
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                                <Popover.Body>
                                                    Number of cores used to run the pipeline and 2*n_jobs +1 of regions that should be stored in cache. If memory consumption of pipeline is too high reduce this number, if a lot of RAM is available increase this number to decrease runtime

                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
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
                                       value={formData.dir_output} onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                            <Popover.Body>
                                                Name of the directory where the output files will be written
                                            </Popover.Body>
                                        </Popover>
                                    }
                                >
                                    <InfoCircle
                                        style={{
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
                                    value={formData.write_intermediate_steps}
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
                                            <Popover.Header as="h3">Write Intermediate Steps</Popover.Header>
                                            <Popover.Body>
                                                if true, writes the oligo sequences after each step of the pipeline into a csv file
                                            </Popover.Body>
                                        </Popover>
                                    }
                                >
                                    <InfoCircle
                                        style={{
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
                                       value={formData.top_n_sets} onChange={handleChange} required/>
                                <OverlayTrigger
                                    trigger="hover"
                                    placement="top"
                                    overlay={
                                        <Popover id="popover-n_jobs">
                                            <Popover.Header as="h3">Maximum Number of Sets</Popover.Header>
                                            <Popover.Body>
                                                maximum number of sets to report in padlock_probes.yaml and "padlock_probes_order.yaml"
                                            </Popover.Body>
                                        </Popover>
                                    }
                                >
                                    <InfoCircle
                                        style={{
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

                                        {/* Custom file input button spanning full width */}
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
                                                    <Popover.Header as="h3">Target File </Popover.Header>
                                                    <Popover.Body>
                                                        File with a list the genes used to generate the oligos
                                                        sequences,
                                                        leave empty if all the genes are used
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
                                                style={{
                                                    fontSize: "1.2rem",
                                                    cursor: "pointer",
                                                    color: "#0d6efd",
                                                    marginLeft: "10px"
                                                }}
                                            />
                                        </OverlayTrigger>
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
                                                    <Popover.Header as="h3">Target File </Popover.Header>
                                                    <Popover.Body>
                                                        Fasta file with sequences form which the probes should be
                                                        generated.
                                                        Use the genomic region generator to create fasta files
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
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
                                                    <Popover.Header as="h3">Target File </Popover.Header>
                                                    <Popover.Body>
                                                        Fasta file with sequences used as reference for the specificity
                                                        filters. Use the genomic region generator to create fasta files.
                                                    </Popover.Body>
                                                </Popover>
                                            }
                                        >
                                            <InfoCircle
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
                                <input type="number" className="form-control" id="probe_length_min"
                                       name="probe_length_min"
                                       value={formData.probe_length_min} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="probe_length_max" className="form-label">Max Probe Length:</label>
                                <input type="number" className="form-control" id="probe_length_max"
                                       name="probe_length_max"
                                       value={formData.probe_length_max} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="probe_isoform_consensus" className="form-label">Isoform Consensus
                                    (%):</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probe_isoform_consensus"
                                           name="probe_isoform_consensus"
                                           value={formData.probe_isoform_consensus} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                                <Popover.Body>
                                                    Number of cores used to run the pipeline and 2*n_jobs +1 of regions
                                                    that should be stored in cache. If memory consumption of pipeline is
                                                    too high reduce this number, if a lot of RAM is available increase
                                                    this number to decrease runtime

                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
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
                                <label htmlFor="target_probe_targeted_exons" className="form-label">Target Probe
                                    Exons:</label>
                                <select className="form-control" id="target_probe_targeted_exons"
                                        name="target_probe_targeted_exons"
                                        value={formData.target_probe_targeted_exons} onChange={handleChange}>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>

                                </select>
                            </div>
                            <div className="col">
                                <label htmlFor="target_probe_split_region" className="form-label">Minimum Exon Junction
                                    Coverage</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="target_probe_split_region"
                                           name="target_probe_split_region"
                                           value={formData.target_probe_split_region} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                                <Popover.Body>
                                                    Number of cores used to run the pipeline and 2*n_jobs +1 of regions
                                                    that should be stored in cache. If memory consumption of pipeline is
                                                    too high reduce this number, if a lot of RAM is available increase
                                                    this number to decrease runtime

                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
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
                                <input type="number" className="form-control" id="probe_GC_content_min"
                                       name="probe_GC_content_min"
                                       value={formData.probe_GC_content_min} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="probe_GC_content_opt" className="form-label">Optimal GC Content
                                    (%):</label>
                                <input type="number" className="form-control" id="probe_GC_content_opt"
                                       name="probe_GC_content_opt"
                                       value={formData.probe_GC_content_opt} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="probe_GC_content_max" className="form-label">Max GC Content
                                    (%):</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probe_GC_content_max"
                                           name="probe_GC_content_max"
                                           value={formData.probe_GC_content_max} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                                <Popover.Body>
                                                    Number of cores used to run the pipeline and 2*n_jobs +1 of regions
                                                    that should be stored in cache. If memory consumption of pipeline is
                                                    too high reduce this number, if a lot of RAM is available increase
                                                    this number to decrease runtime

                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
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
                                <input type="number" className="form-control" id="probe_Tm_min" name="probe_Tm_min"
                                       value={formData.probe_Tm_min} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="probe_Tm_max" className="form-label">Max Tm (°C):</label>
                                <input type="number" className="form-control" id="probe_Tm_max" name="probe_Tm_max"
                                       value={formData.probe_Tm_max} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="probe_Tm_opt" className="form-label">Opt Tm (°C):</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="probe_Tm_opt" name="probe_Tm_opt"
                                           value={formData.probe_Tm_opt} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                                <Popover.Body>
                                                    Number of cores used to run the pipeline and 2*n_jobs +1 of regions
                                                    that should be stored in cache. If memory consumption of pipeline is
                                                    too high reduce this number, if a lot of RAM is available increase
                                                    this number to decrease runtime

                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
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
                            <h6 className="pt-2">Minimum number of nucleotides to consider it a homopolymeric run per
                                base </h6>
                            <div className="col">
                                <label htmlFor="homopolymeric_A" className="form-label">A:</label>
                                <input type="number" className="form-control" id="homopolymeric_A"
                                       name="homopolymeric_A"
                                       value={formData.homopolymeric_A} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="homopolymeric_T" className="form-label">T:</label>
                                <input type="number" className="form-control" id="homopolymeric_T"
                                       name="homopolymeric_T"
                                       value={formData.homopolymeric_T} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="homopolymeric_C" className="form-label">C:</label>
                                <input type="number" className="form-control" id="homopolymeric_C"
                                       name="homopolymeric_C"
                                       value={formData.homopolymeric_C} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="homopolymeric_G" className="form-label">G:</label>
                                <input type="number" className="form-control" id="homopolymeric_G"
                                       name="homopolymeric_G"
                                       value={formData.homopolymeric_G} onChange={handleChange} required/>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <label htmlFor="target_probe_T_secondary_structure" className="form-label">Secondary
                                    Structure Temperature:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_T_secondary_structure"
                                       name="target_probe_T_secondary_structure"
                                       value={formData.target_probe_secondary_structures_T} onChange={handleChange}/>
                            </div>
                            <div className="col">
                                <label htmlFor="target_probe_secondary_structures_threshold_deltaG"
                                       className="form-label">Threshold for secondary structure:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control"
                                           id="target_probe_secondary_structures_threshold_deltaG"
                                           name="target_probe_secondary_structures_threshold_deltaG"
                                           value={formData.target_probe_secondary_structures_threshold_deltaG}
                                           onChange={handleChange}/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                                <Popover.Body>
                                                    Number of cores used to run the pipeline and 2*n_jobs +1 of
                                                    regions
                                                    that should be stored in cache. If memory consumption of
                                                    pipeline is
                                                    too high reduce this number, if a lot of RAM is available
                                                    increase
                                                    this number to decrease runtime

                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
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
                                <label htmlFor="target_probe_GC_weight" className="form-label">Weight of the GC
                                    content:</label>
                                <input type="number" className="form-control" id="target_probe_GC_weight"
                                       name="target_probe_GC_weight"
                                       value={formData.target_probe_GC_weight} onChange={handleChange}/>
                            </div>
                            <div className="col">
                                <label htmlFor="target_probe_Tm_weight" className="form-label">Weight of the temperature
                                    of the probe:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="target_probe_Tm_weight"
                                           name="target_probe_Tm_weight"
                                           value={formData.target_probe_Tm_weight} onChange={handleChange}/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                                <Popover.Body>
                                                    Number of cores used to run the pipeline and 2*n_jobs +1 of
                                                    regions
                                                    that should be stored in cache. If memory consumption of
                                                    pipeline is
                                                    too high reduce this number, if a lot of RAM is available
                                                    increase
                                                    this number to decrease runtime

                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
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
                                <input type="number" className="form-control" id="probeset_size_min"
                                       name="probeset_size_min"
                                       value={formData.set_size_min} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="probeset_size_opt" className="form-label">Optimal Probe Set
                                    Size:</label>
                                <input type="number" className="form-control" id="probeset_size_opt"
                                       name="probeset_size_opt"
                                       value={formData.set_size_opt} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="distance_between_probes" className="form-label">Distance Between
                                    Probes:</label>
                                <input type="number" className="form-control" id="distance_between_probes"
                                       name="distance_between_probes"
                                       value={formData.distance_between_probes} onChange={handleChange} required/>
                            </div>
                            <div className="col">
                                <label htmlFor="n_sets" className="form-label">Maximum Number of Sets:</label>
                                <div className="d-flex align-items-center">
                                    <input type="number" className="form-control" id="n_sets" name="n_sets"
                                           value={formData.n_sets} onChange={handleChange} required/>
                                    <OverlayTrigger
                                        trigger="hover"
                                        placement="top"
                                        overlay={
                                            <Popover id="popover-n_jobs">
                                                <Popover.Header as="h3">Number of Jobs</Popover.Header>
                                                <Popover.Body>
                                                    Number of cores used to run the pipeline and 2*n_jobs +1 of regions
                                                    that should be stored in cache. If memory consumption of pipeline is
                                                    too high reduce this number, if a lot of RAM is available increase
                                                    this number to decrease runtime

                                                </Popover.Body>
                                            </Popover>
                                        }
                                    >
                                        <InfoCircle
                                            style={{
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
                        <div className="mb-3">
                            <label htmlFor="target_probe_hybridization_probability_alignment_method"
                                   className="form-label">Alignment Method:</label>
                            <select className="form-select" id="target_probe_hybridization_probability_alignment_method"
                                    name="target_probe_hybridization_probability_alignment_method"
                                    value={formData.target_probe_hybridization_probability_alignment_method}
                                    onChange={handleChange}>
                                <option value="blastn">BlastN</option>
                                <option value="bowtie">Bowtie</option>
                            </select>
                        </div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_perc_identity"
                                       className="form-label">Percent
                                    Identity:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_specificity_blastn_search_parameters_perc_identity"
                                       name="target_probe_specificity_blastn_search_parameters_perc_identity"
                                       value={formData.target_probe_hybridization_probability_blastn_search_parameters_perc_identity}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_strand"
                                       className="form-label">Strand: if
                                    reference is whole genome, consider using "both"</label>
                                <input type="text" className="form-control"
                                       id="target_probe_specificity_blastn_search_parameters_strand"
                                       name="specificity_strand"
                                       value={formData.target_probe_hybridization_probability_blastn_search_parameters_strand}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_word_size"
                                       className="form-label">Word
                                    Size:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_specificity_blastn_search_parameters_word_size"
                                       name="target_probe_specificity_blastn_search_parameters_word_size"
                                       value={formData.target_probe_hybridization_probability_blastn_search_parameters_word_size}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_hybridization_probability_blastn_hit_parameters_coverage"
                                       className="form-label">Max
                                    Target Sequences:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_hybridization_probability_blastn_hit_parameters_coverage"
                                       name="target_probe_hybridization_probability_blastn_hit_parameters_coverage"
                                       value={formData.target_probe_hybridization_probability_blastn_hit_parameters_coverage}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_hybridization_probability_bowtie_search_parameters_v"
                                       className="form-label">Allowed Mismatches:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_hybridization_probability_bowtie_search_parameters_v"
                                       name="target_probe_hybridization_probability_bowtie_search_parameters_v"
                                       value={formData.target_probe_hybridization_probability_bowtie_search_parameters_v}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="mb-3 form-check">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                    name="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                    checked={formData.target_probe_hybridization_probability_bowtie_search_parameters_nofw === "true"}
                                    onChange={(e) =>
                                        setFormData((prev: any) => ({
                                            ...prev,
                                            target_probe_hybridization_probability_bowtie_search_parameters_nofw: e.target.checked ? "true" : "false",
                                        }))
                                    }
                                />
                                <label htmlFor="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                       className="form-check-label">
                                    No forward strand: Uncheck if the reference is whole genome
                                </label>
                            </div>
                            //CROSS HYBRID FİLTERS

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
                            <select className="form-select"
                                    id="target_probe_cross_hybridization_alignment_method"
                                    name="target_probe_cross_hybridization_alignment_method"
                                    value={formData.target_probe_cross_hybridization_alignment_method}
                                    onChange={handleChange}>
                                <option value="blastn">BlastN</option>
                                <option value="bowtie">Bowtie</option>
                            </select>
                        </div>
                        <div className="col-md-6">
                            <label htmlFor="target_probe_specificity_blastn_search_parameters_perc_identity"
                                   className="form-label">Percent
                                Identity:</label>
                            <input type="number" className="form-control"
                                   id="target_probe_cross_hybridization_blastn_search_parameters_perc_identity"
                                   name="target_probe_cross_hybridization_blastn_search_parameters_perc_identity"
                                   value={formData.target_probe_cross_hybridization_blastn_search_parameters_perc_identity}
                                   onChange={handleChange}
                                   required/>
                        </div>
                        <div className="col-md-6">
                            <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters"
                                   className="form-label">Strand: if
                                reference is whole genome, consider using "both"</label>
                            <input type="text" className="form-control"
                                   id="target_probe_cross_hybridization_blastn_search_parameters"
                                   name="specificity_strand"
                                   value={formData.target_probe_cross_hybridization_blastn_search_parameters_strand}
                                   onChange={handleChange}
                                   required/>
                        </div>
                        <div className="col-md-6">
                            <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_word_size"
                                   className="form-label">Word
                                Size:</label>
                            <input type="number" className="form-control"
                                   id="target_probe_cross_hybridization_blastn_search_parameters_word_size"
                                   name="target_probe_cross_hybridization_blastn_search_parameterss_word_size"
                                   value={formData.target_probe_cross_hybridization_blastn_search_parameters_word_size}
                                   onChange={handleChange}
                                   required/>
                        </div>
                        <div className="col-md-6">
                            <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_coverage"
                                   className="form-label">Max
                                Target Sequences:</label>
                            <input type="number" className="form-control"
                                   id="target_probe_cross_hybridization_blastn_search_parameters_coverage"
                                   name="target_probe_cross_hybridization_blastn_search_parameters_coverage"
                                   value={formData.target_probe_cross_hybridization_blastn_search_parameters_coverage}
                                   onChange={handleChange}
                                   required/>
                        </div>
                        <div className="col-md-6">
                            <label htmlFor="target_probe_cross_hybridization_bowtie_search_parameters_v"
                                   className="form-label">Allowed Mismatches:</label>
                            <input type="number" className="form-control"
                                   id="target_probe_cross_hybridization_bowtie_search_parameters_v"
                                   name="target_probe_cross_hybridization_bowtie_search_parameters_v"
                                   value={formData.target_probe_cross_hybridization_bowtie_search_parameters_v}
                                   onChange={handleChange}
                                   required/>
                        </div>
                        <div className="mb-3 form-check">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                name="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                checked={formData.target_probe_hybridization_probability_bowtie_search_parameters_nofw === "true"}
                                onChange={(e) =>
                                    setFormData((prev: any) => ({
                                        ...prev,
                                        target_probe_hybridization_probability_bowtie_search_parameters_nofw: e.target.checked ? "true" : "false",
                                    }))
                                }
                            />
                            <label htmlFor="target_probe_hybridization_probability_bowtie_search_parameters_nofw"
                                   className="form-check-label">
                                No forward strand: Uncheck if the reference is whole genome
                            </label>
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
                                <input type="number" className="form-control" id="max_graph_size"
                                       name="max_graph_size"
                                       value={formData.max_graph_size} onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="n_attempts" className="form-label">Number of
                                    Attempts:</label>
                                <input type="number" className="form-control" id="n_attempts"
                                       name="n_attempts"
                                       value={formData.n_attempts} onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="pre_filter" className="form-label">Pre-Filtering:</label>
                                <select className="form-control" id="pre_filter" name="pre_filter"
                                        value={formData.pre_filter} onChange={handleChange}>
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="heuristic" className="form-label">Heuristic:</label>
                                <select className="form-control" id="heuristic" name="heuristic"
                                        value={formData.heuristic} onChange={handleChange}>
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="heuristic_n_attempts" className="form-label"> Heuristics number of
                                    Attempts:</label>
                                <input type="number" className="form-control" id="n_attempts"
                                       name="heuristic_n_attempts"
                                       value={formData.heuristic_n_attempts} onChange={handleChange} required/>
                            </div>
                        </div>

                    </div>
                );
            case'meltingtemp':
                return (
                    <div>
                        <h4>Melting Temperature Parameters</h4>
                        {/* Target Probe Parameters */}
                        <h5>Target Probe Parameters</h5>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_check" className="form-label">Check:</label>
                                <select className="form-control" id="Tm_probe_check" name="Tm_probe_check"
                                        value={formData.Tm_probe_check} onChange={handleChange}>
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_strict" className="form-label">Strict:</label>
                                <select className="form-control" id="Tm_probe_strict" name="Tm_probe_strict"
                                        value={formData.Tm_probe_strict} onChange={handleChange}>
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_c_seq" className="form-label">Complementary
                                    Sequence:</label>
                                <input type="text" className="form-control" id="Tm_probe_c_seq"
                                       name="Tm_probe_c_seq"
                                       value={formData.Tm_probe_c_seq} onChange={handleChange}
                                       placeholder="null"/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_shift" className="form-label">Shift:</label>
                                <input type="number" className="form-control" id="Tm_probe_shift"
                                       name="Tm_probe_shift"
                                       value={formData.Tm_probe_shift} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_nn_table" className="form-label">Nearest Neighbor
                                    Table:</label>
                                <input type="text" className="form-control" id="Tm_probe_nn_table"
                                       name="Tm_probe_nn_table"
                                       value={formData.Tm_probe_nn_table} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_tmm_table" className="form-label">TMM
                                    Table:</label>
                                <input type="text" className="form-control" id="Tm_probe_tmm_table"
                                       name="Tm_probe_tmm_table"
                                       value={formData.Tm_probe_tmm_table} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_imm_table" className="form-label">IMM
                                    Table:</label>
                                <input type="text" className="form-control" id="Tm_probe_imm_table"
                                       name="Tm_probe_imm_table"
                                       value={formData.Tm_probe_imm_table} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="DE_probe_imm_table" className="form-label">DE Table:</label>
                                <input type="text" className="form-control" id="DE_probe_imm_table"
                                       name="DE_probe_imm_table"
                                       value={formData.DE_probe_imm_table} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_dnac1" className="form-label">DNA Concentration 1
                                    (nM):</label>
                                <input type="number" className="form-control" id="Tm_probe_dnac1"
                                       name="Tm_probe_dnac1"
                                       value={formData.Tm_probe_dnac1} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_dnac2" className="form-label">DNA Concentration 2
                                    (nM):</label>
                                <input type="number" className="form-control" id="Tm_probe_dnac2"
                                       name="Tm_probe_dnac2"
                                       value={formData.Tm_probe_dnac2} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="selfcomp" className="form-label">SelfComp:</label>
                                <select className="form-control" id="selfcomp" name="selfcomp"
                                        value={formData.selfcomp} onChange={handleChange}>
                                    <option value="true">True</option>
                                    <option value="false">False</option>
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_saltcorr" className="form-label">Salt
                                    Correction:</label>
                                <input type="number" className="form-control" id="Tm_probe_saltcorr"
                                       name="Tm_probe_saltcorr"
                                       value={formData.Tm_probe_saltcorr} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_Na" className="form-label">Na Concentration
                                    (mM):</label>
                                <input type="number" className="form-control" id="Tm_probe_Na"
                                       name="Tm_probe_Na"
                                       value={formData.Tm_probe_Na} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_K" className="form-label">K Concentration
                                    (mM):</label>
                                <input type="number" className="form-control" id="Tm_probe_K"
                                       name="Tm_probe_K"
                                       value={formData.Tm_probe_K} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_Tris" className="form-label">Tris Concentration
                                    (mM):</label>
                                <input type="number" className="form-control" id="Tm_probe_Tris"
                                       name="Tm_probe_Tris"
                                       value={formData.Tm_probe_Tris} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_Mg" className="form-label">Mg Concentration
                                    (mM):</label>
                                <input type="number" className="form-control" id="Tm_probe_Mg"
                                       name="Tm_probe_Mg"
                                       value={formData.Tm_probe_Mg} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_dNTPs" className="form-label">dNTPs Concentration
                                    (mM):</label>
                                <input type="number" className="form-control" id="Tm_probe_dNTPs"
                                       name="Tm_probe_dNTPs"
                                       value={formData.Tm_probe_dNTPs} onChange={handleChange}/>
                            </div>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_DMSO" className="form-label">DMSO
                                        (%):</label>
                                    <input type="number" className="form-control" id="Tm_probe_DMSO"
                                           name="Tm_probe_DMSO"
                                           value={formData.target_probe_Tm_chem_correction_parameters_DMSO} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_fmd" className="form-label">Formamide (fmd,
                                        %):</label>
                                    <input type="number" className="form-control" id="Tm_probe_fmd"
                                           name="Tm_probe_fmd"
                                           value={formData.target_probe_Tm_chem_correction_parameters_fmd} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_DMSOfactor" className="form-label">DMSO
                                        Factor:</label>
                                    <input type="number" className="form-control"
                                           id="Tm_probe_DMSOfactor" name="Tm_probe_DMSOfactor"
                                           value={formData.target_probe_Tm_chem_correction_parameters_DMSOfactor} step="0.01"
                                           onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_fmdfactor" className="form-label">Formamide
                                        Factor:</label>
                                    <input type="number" className="form-control"
                                           id="Tm_probe_fmdfactor" name="Tm_probe_fmdfactor"
                                           value={formData.target_probe_Tm_chem_correction_parameters_fmdfactor} step="0.01"
                                           onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_fmdmethod" className="form-label">Formamide
                                        Method:</label>
                                    <input type="number" className="form-control"
                                           id="Tm_probe_fmdmethod" name="Tm_probe_fmdmethod"
                                           value={formData.target_probe_Tm_chem_correction_parameters_fmdmethod} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_probe_GC" className="form-label">GC
                                        (optional):</label>
                                    <input type="text" className="form-control" id="Tm_probe_GC"
                                           name="Tm_probe_GC"
                                           value={formData.target_probe_Tm_chem_correction_parameters_GC} onChange={handleChange}
                                           placeholder="null"/>
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