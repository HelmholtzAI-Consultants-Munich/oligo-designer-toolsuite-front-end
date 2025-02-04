import React, { useState, useEffect } from 'react';
import Navbar from "../modules/nav";
import axios from "axios";
const Scrinshot: React.FC = () => {
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
                    console.log(files[key],key,'what it look like not array');
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
        dir_output: "output_scrinshot_probe_designer",
        write_intermediate_steps: "true",
        top_n_sets: '3',

        // Probe Sequences Generation
        file_regions: "",
        files_fasta_target_probe_database: ``,
        files_fasta_reference_database_target_probe: '',
        probe_length_min: "40",
        probe_length_max: "45",
        probe_isoform_consensus: "50",

        // Probe Property Filters
        probe_GC_content_min: "40",
        probe_GC_content_opt: "50",
        probe_GC_content_max: "60",
        probe_Tm_min: "65",
        probe_Tm_max: "75",
        homopolymeric_A: "5",
        homopolymeric_T: "5",
        homopolymeric_C: "5",
        homopolymeric_G: "5",

        // Padlock Arms
        arm_Tm_dif_max: "2",
        arm_length_min: "10",
        arm_Tm_min: "50",
        arm_Tm_max: "60",

        ligation_region_size: "5",

        // Set Selection Parameters
        probe_isoform_weight: "2",
        probe_GC_weight: "1",
        probe_Tm_opt: "70",
        probe_Tm_weight: "1",
        probeset_size_min: "3",
        probeset_size_opt: "5",
        distance_between_probes: "0",
        n_sets: "100",

        // Detection Oligo Properties
        min_thymines: "2",
        detect_oligo_length_min: "15",
        detect_oligo_length_max: "40",



        // Final Sequence Design
        U_distance: "5",
        detect_oligo_Tm_opt: "56",

        // Developer Parameters - Specificity Filters with BlastN
        specificity_perc_identity: "80",
        specificity_strand: "minus",
        specificity_word_size: "10",
        specificity_dust: "no",
        specificity_soft_masking: "false",
        specificity_max_target_seqs: "10",
        specificity_max_hsps: "1000",
        specificity_coverage: "50",

        // Cross-Hybridization Filters
        crosshybridization_perc_identity: "80",
        crosshybridization_strand: "minus",
        crosshybridization_word_size: "10",
        crosshybridization_dust: "no",
        crosshybridization_soft_masking: "false",
        crosshybridization_max_target_seqs: "10",
        crosshybridization_coverage: "80",

        // Oligo Set Selection
        max_graph_size: "5000",
        n_attempts: "10000",
        pre_filtering: "false",
        heuristic: 'True',
        heuristic_n_attempts: '100',

        // Target Probe Parameters
        Tm_probe_check: "true",
        Tm_probe_strict: "true",
        Tm_probe_c_seq: "",
        Tm_probe_shift: "0",
        Tm_probe_nn_table: "DNA_NN3",
        Tm_probe_tmm_table: "DNA_TMM1",
        Tm_probe_imm_table: "DNA_IMM1",
        DE_probe_imm_table: "DNA_DE1",
        Tm_probe_dnac1: "50",
        Tm_probe_dnac2: "0",
        selfcomp: "false",
        Tm_probe_saltcorr: "7",
        Tm_probe_Na: "39",
        Tm_probe_K: "75",
        Tm_probe_Tris: "20",
        Tm_probe_Mg: "10",
        Tm_probe_dNTPs: "0",
        Tm_probe_DMSO: "0",
        Tm_probe_fmd: "20",
        Tm_probe_DMSOfactor: "0.75",
        Tm_probe_fmdfactor: "0.65",
        Tm_probe_fmdmethod: "1",
        Tm_probe_GC: "",

        // Detection Oligo Parameters
        Tm_detection_check: "true",
        Tm_detection_strict: "true",
        Tm_detection_c_seq: "",
        Tm_detection_shift: "0",
        Tm_detection_nn_table: "DNA_NN3",
        Tm_detection_tmm_table: "DNA_TMM1",
        Tm_detection_imm_table: "DNA_IMM1",
        Tm_detection_de_table: "DNA_DE1",
        Tm_detection_dnac1: "50",
        Tm_detection_dnac2: "0",
        Tm_detection_selfcomp: "false",
        Tm_detection_saltcorr: "7",
        Tm_detection_Na: "39",
        Tm_detection_K: "0",
        Tm_detection_Tris: "0",
        Tm_detection_Mg: "0",
        Tm_detection_dNTPs: "0",
        Tm_detection_DMSO: "0",
        Tm_detection_fmd: "30",
        Tm_detection_DMSOfactor: "0.75",
        Tm_detection_fmdfactor: "0.65",
        Tm_detection_fmdmethod: "1",
        Tm_detection_GC: "",
    });
    const [activeTab, setActiveTab] = useState("general");
    const [activetab2, setActivetab2] = useState("specfblastn");

    const renderTabContent = () => {
        switch (activeTab) {
            case "general":
                return (
                    <div>
                        <h4>General Parameters</h4>
                        <div className="mb-3">
                            <label htmlFor="n_jobs" className="form-label">Number of Jobs:</label>
                            <input type="number" className="form-control" id="n_jobs" name="n_jobs"
                                   value={formData.n_jobs} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="dir_output" className="form-label">Output Directory:</label>
                            <input type="text" className="form-control" id="dir_output" name="dir_output"
                                   value={formData.dir_output} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="write_intermediate_steps" className="form-label">Write Intermediate
                                Steps:</label>
                            <select className="form-select" id="write_intermediate_steps"
                                    name="write_intermediate_steps"
                                    value={formData.write_intermediate_steps} onChange={handleChange}>
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="top_n_sets" className="form-label">Maximum Number of Sets:</label>
                            <input type="number" className="form-control" id="n_jobs" name="n_jobs"
                                   value={formData.top_n_sets} onChange={handleChange} required/>
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
                                    Regions File:
                                </label>
                                {/* Hide the default file input */}
                                <input
                                    type="file"
                                    className="form-control visually-hidden"
                                    id="file_regions"
                                    name="file_regions"
                                    onChange={handleFileChange}
                                />
                                {/* Custom file input button */}
                                <label
                                    htmlFor="file_regions"
                                    className="btn btn-outline-primary d-block"
                                    style={{cursor: 'pointer'}}
                                >
                                    Choose File
                                </label>
                                {/* Display selected file name */}
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
                                    className="btn btn-outline-primary d-block"
                                    style={{cursor: 'pointer'}}
                                >
                                    Choose Files
                                </label>
                                {/* Display selected file names */}
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
                                    className="btn btn-outline-primary d-block"
                                    style={{cursor: 'pointer'}}
                                >
                                    Choose Files
                                </label>
                                {/* Display selected file names */}
                                <div className="text-muted small mt-1">
                                    {files.files_fasta_reference_database_target_probe.length > 0
                                        ? `Selected: ${files.files_fasta_reference_database_target_probe.map(f => f.name).join(', ')}`
                                        : "No files selected"}
                                </div>
                            </div>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="probe_length_min" className="form-label">Min Probe Length:</label>
                            <input type="number" className="form-control" id="probe_length_min"
                                   name="probe_length_min"
                                   value={formData.probe_length_min} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="probe_length_max" className="form-label">Max Probe Length:</label>
                            <input type="number" className="form-control" id="probe_length_max"
                                   name="probe_length_max"
                                   value={formData.probe_length_max} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="probe_isoform_consensus" className="form-label">Isoform Consensus
                                (%):</label>
                            <input type="number" className="form-control" id="probe_isoform_consensus"
                                   name="probe_isoform_consensus"
                                   value={formData.probe_isoform_consensus} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="probe_GC_content_min" className="form-label">Min GC Content
                                (%):</label>
                            <input type="number" className="form-control" id="probe_GC_content_min"
                                   name="probe_GC_content_min"
                                   value={formData.probe_GC_content_min} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="probe_GC_content_opt" className="form-label">Optimal GC Content
                                (%):</label>
                            <input type="number" className="form-control" id="probe_GC_content_opt"
                                   name="probe_GC_content_opt"
                                   value={formData.probe_GC_content_opt} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="probe_GC_content_max" className="form-label">Max GC Content
                                (%):</label>
                            <input type="number" className="form-control" id="probe_GC_content_max"
                                   name="probe_GC_content_max"
                                   value={formData.probe_GC_content_max} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="probe_Tm_min" className="form-label">Min Tm (°C):</label>
                            <input type="number" className="form-control" id="probe_Tm_min" name="probe_Tm_min"
                                   value={formData.probe_Tm_min} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="probe_Tm_max" className="form-label">Max Tm (°C):</label>
                            <input type="number" className="form-control" id="probe_Tm_max" name="probe_Tm_max"
                                   value={formData.probe_Tm_max} onChange={handleChange} required/>
                        </div>
                        <div className="row g-3">
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
                            <div className="mb-3">
                                <label htmlFor="arm_Tm_dif_max" className="form-label">Max Tm Difference Between
                                    Arms:</label>
                                <input type="number" className="form-control" id="arm_Tm_dif_max"
                                       name="arm_Tm_dif_max"
                                       value={formData.arm_Tm_dif_max} onChange={handleChange}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="arm_length_min" className="form-label">Min Arm Length:</label>
                                <input type="number" className="form-control" id="arm_length_min"
                                       name="arm_length_min"
                                       value={formData.arm_length_min} onChange={handleChange}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="arm_Tm_min" className="form-label">Min Arm Tm:</label>
                                <input type="number" className="form-control" id="arm_Tm_min" name="arm_Tm_min"
                                       value={formData.arm_Tm_min} onChange={handleChange}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="arm_Tm_max" className="form-label">Max Arm Tm:</label>
                                <input type="number" className="form-control" id="arm_Tm_max" name="arm_Tm_max"
                                       value={formData.arm_Tm_max} onChange={handleChange}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="ligation_region_size" className="form-label">Litigation Region
                                    Size:</label>
                                <input type="number" className="form-control" id="ligation_region_size"
                                       name="ligation_region_size"
                                       value={formData.ligation_region_size} onChange={handleChange}/>
                            </div>
                        </div>
                        <div className="mb-4">
                            <h4>Set Selection Parameters</h4>
                            <div className="mb-3">
                                <label htmlFor="probe_isoform_weight" className="form-label">Probe Isoform
                                    Weight:</label>
                                <input type="number" className="form-control" id="probe_isoform_weight"
                                       name="probe_isoform_weight"
                                       value={formData.probe_isoform_weight} onChange={handleChange} required/>
                            </div>

                            <div className="mb-3">
                                <label htmlFor="probe_GC_weight" className="form-label">GC Content Weight:</label>
                                <input type="number" className="form-control" id="probe_GC_weight"
                                       name="probe_GC_weight"
                                       value={formData.probe_GC_weight} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="probe_Tm_opt" className="form-label">Optimal Tm (°C):</label>
                                <input type="number" className="form-control" id="probe_Tm_opt" name="probe_Tm_opt"
                                       value={formData.probe_Tm_opt} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="probe_Tm_weight" className="form-label">Tm Weight:</label>
                                <input type="number" className="form-control" id="probe_Tm_weight"
                                       name="probe_Tm_weight"
                                       value={formData.probe_Tm_weight} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="probeset_size_min" className="form-label">Minimum Probe Set
                                    Size:</label>
                                <input type="number" className="form-control" id="probeset_size_min"
                                       name="probeset_size_min"
                                       value={formData.probeset_size_min} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="probeset_size_opt" className="form-label">Optimal Probe Set
                                    Size:</label>
                                <input type="number" className="form-control" id="probeset_size_opt"
                                       name="probeset_size_opt"
                                       value={formData.probeset_size_opt} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="distance_between_probes" className="form-label">Distance Between
                                    Probes:</label>
                                <input type="number" className="form-control" id="distance_between_probes"
                                       name="distance_between_probes"
                                       value={formData.distance_between_probes} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="n_sets" className="form-label">Maximum Number of Sets:</label>
                                <input type="number" className="form-control" id="n_sets" name="n_sets"
                                       value={formData.n_sets} onChange={handleChange} required/>
                            </div>
                        </div>
                    </div>
                );

            case 'filters':
                return (
                    <div>
                        <div className="mb-4">
                            <h4>Probe Property Filters</h4>

                            <div className="mb-3">
                                <label className="form-label">Homopolymeric Base Run (min number of
                                    nucleotides):</label>

                            </div>
                        </div>
                    </div>
                );

            case 'padlock_arms':
                return (
                    <div>
                        <div className="mb-4">
                            <h4>Padlock Arms</h4>

                        </div>
                    </div>
                );
            case 'detection_oligos':
                return (
                    <div>

                        <div className="mb-4">
                            <h4>Detection Oligo Properties</h4>
                            <div className="mb-3">
                                <label htmlFor="min_thymines" className="form-label">Min Thymines:</label>
                                <input type="number" className="form-control" id="min_thymines" name="min_thymines"
                                       value={formData.min_thymines} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="detect_oligo_length_min" className="form-label">Min Length
                                    (bp):</label>
                                <input type="number" className="form-control" id="detect_oligo_length_min"
                                       name="detect_oligo_length_min"
                                       value={formData.detect_oligo_length_min} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="detect_oligo_length_max" className="form-label">Max Length
                                    (bp):</label>
                                <input type="number" className="form-control" id="detect_oligo_length_max"
                                       name="detect_oligo_length_max"
                                       value={formData.detect_oligo_length_max} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="U_distance" className="form-label">Preferred U Distance:</label>
                                <input type="number" className="form-control" id="U_distance" name="U_distance"
                                       value={formData.U_distance} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="detect_oligo_Tm_opt" className="form-label">Optimal Detection Oligo
                                    Tm (°C):</label>
                                <input type="number" className="form-control" id="detect_oligo_Tm_opt"
                                       name="detect_oligo_Tm_opt"
                                       value={formData.detect_oligo_Tm_opt} onChange={handleChange} required/>
                            </div>
                        </div>

                    </div>
                );
            case 'set_selection':
                return (
                    <div>


                    </div>
                )
            case 'final_seq':
                return (
                    <div>

                        <div className="mb-4">
                            <h4>Final Sequence Design</h4>

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
                                <input type="number" className="form-control" id="specificity_perc_identity"
                                       name="specificity_perc_identity"
                                       value={formData.specificity_perc_identity} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="specificity_strand" className="form-label">Strand: if
                                    reference is whole genome, consider using "both"</label>
                                <input type="text" className="form-control" id="specificity_strand"
                                       name="specificity_strand"
                                       value={formData.specificity_strand} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="specificity_word_size" className="form-label">Word
                                    Size:</label>
                                <input type="number" className="form-control" id="specificity_word_size"
                                       name="specificity_word_size"
                                       value={formData.specificity_word_size} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="specificity_dust" className="form-label">Dust:</label>
                                <input type="text" className="form-control" id="specificity_dust"
                                       name="specificity_dust"
                                       value={formData.specificity_dust} onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="specificity_soft_masking" className="form-label">Soft
                                    Masking:</label>
                                <input type="text" className="form-control" id="specificity_soft_masking"
                                       name="specificity_soft_masking"
                                       value={formData.specificity_soft_masking} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="specificity_max_target_seqs" className="form-label">Max
                                    Target Sequences:</label>
                                <input type="number" className="form-control"
                                       id="specificity_max_target_seqs" name="specificity_max_target_seqs"
                                       value={formData.specificity_max_target_seqs} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="specificity_max_hsps" className="form-label">Max
                                    HSPs:</label>
                                <input type="number" className="form-control" id="specificity_max_hsps"
                                       name="specificity_max_hsps"
                                       value={formData.specificity_max_hsps} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="specificity_coverage" className="form-label">Coverage:
                                    (Specificity_blastn_hit_parameter)</label>
                                <input type="number" className="form-control" id="specificity_coverage"
                                       name="specificity_coverage"
                                       value={formData.specificity_coverage} onChange={handleChange}
                                       required/>
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
                                <input type="number" className="form-control"
                                       id="crosshybridization_perc_identity"
                                       name="crosshybridization_perc_identity"
                                       value={formData.crosshybridization_perc_identity}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="crosshybridization_strand"
                                       className="form-label">Strand:</label>
                                <input type="text" className="form-control" id="crosshybridization_strand"
                                       name="crosshybridization_strand"
                                       value={formData.crosshybridization_strand} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="crosshybridization_word_size" className="form-label">Word
                                    Size:</label>
                                <input type="number" className="form-control"
                                       id="crosshybridization_word_size" name="crosshybridization_word_size"
                                       value={formData.crosshybridization_word_size} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="crosshybridization_dust"
                                       className="form-label">Dust:</label>
                                <input type="text" className="form-control" id="crosshybridization_dust"
                                       name="crosshybridization_dust"
                                       value={formData.crosshybridization_dust} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="crosshybridization_soft_masking" className="form-label">Soft
                                    Masking:</label>
                                <input type="text" className="form-control"
                                       id="crosshybridization_soft_masking"
                                       name="crosshybridization_soft_masking"
                                       value={formData.crosshybridization_soft_masking}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="crosshybridization_max_target_seqs" className="form-label">Max
                                    Target Sequences:</label>
                                <input type="number" className="form-control"
                                       id="crosshybridization_max_target_seqs"
                                       name="crosshybridization_max_target_seqs"
                                       value={formData.crosshybridization_max_target_seqs}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="crosshybridization_coverage"
                                       className="form-label">Coverage:</label>
                                <input type="number" className="form-control"
                                       id="crosshybridization_coverage" name="crosshybridization_coverage"
                                       value={formData.crosshybridization_coverage} onChange={handleChange}
                                       required/>
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
                                <label htmlFor="pre_filtering" className="form-label">Pre-Filtering:</label>
                                <select className="form-control" id="pre_filtering" name="pre_filtering"
                                        value={formData.pre_filtering} onChange={handleChange}>
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

                        </div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_DMSO" className="form-label">DMSO
                                    (%):</label>
                                <input type="number" className="form-control" id="Tm_probe_DMSO"
                                       name="Tm_probe_DMSO"
                                       value={formData.Tm_probe_DMSO} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_fmd" className="form-label">Formamide (fmd,
                                    %):</label>
                                <input type="number" className="form-control" id="Tm_probe_fmd"
                                       name="Tm_probe_fmd"
                                       value={formData.Tm_probe_fmd} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_DMSOfactor" className="form-label">DMSO
                                    Factor:</label>
                                <input type="number" className="form-control"
                                       id="Tm_probe_DMSOfactor" name="Tm_probe_DMSOfactor"
                                       value={formData.Tm_probe_DMSOfactor} step="0.01"
                                       onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_fmdfactor" className="form-label">Formamide
                                    Factor:</label>
                                <input type="number" className="form-control"
                                       id="Tm_probe_fmdfactor" name="Tm_probe_fmdfactor"
                                       value={formData.Tm_probe_fmdfactor} step="0.01"
                                       onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_fmdmethod" className="form-label">Formamide
                                    Method:</label>
                                <input type="number" className="form-control"
                                       id="Tm_probe_fmdmethod" name="Tm_probe_fmdmethod"
                                       value={formData.Tm_probe_fmdmethod} onChange={handleChange}/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="Tm_probe_GC" className="form-label">GC
                                    (optional):</label>
                                <input type="text" className="form-control" id="Tm_probe_GC"
                                       name="Tm_probe_GC"
                                       value={formData.Tm_probe_GC} onChange={handleChange}
                                       placeholder="null"/>
                            </div>
                        </div>


                    </div>
                );
            case'chemcorr':
                return (
                    <div>
                        <div className="mb-4">
                            <h5>Melting Temperature Parameters for Detection Oligo</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_check"
                                           className="form-label">Check:</label>
                                    <select className="form-control" id="Tm_detection_check"
                                            name="Tm_detection_check"
                                            value={formData.Tm_detection_check} onChange={handleChange}>
                                        <option value="true">True</option>
                                        <option value="false">False</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_strict"
                                           className="form-label">Strict:</label>
                                    <select className="form-control" id="Tm_detection_strict"
                                            name="Tm_detection_strict"
                                            value={formData.Tm_detection_strict} onChange={handleChange}>
                                        <option value="true">True</option>
                                        <option value="false">False</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_c_seq" className="form-label">Complementary
                                        Sequence:</label>
                                    <input type="text" className="form-control" id="Tm_detection_c_seq"
                                           name="Tm_detection_c_seq"
                                           value={formData.Tm_detection_c_seq} onChange={handleChange}
                                           placeholder="null"/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_shift"
                                           className="form-label">Shift:</label>
                                    <input type="number" className="form-control" id="Tm_detection_shift"
                                           name="Tm_detection_shift"
                                           value={formData.Tm_detection_shift} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_nn_table" className="form-label">Nearest
                                        Neighbor Table:</label>
                                    <input type="text" className="form-control" id="Tm_detection_nn_table"
                                           name="Tm_detection_nn_table"
                                           value={formData.Tm_detection_nn_table} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_tmm_table" className="form-label">TMM
                                        Table:</label>
                                    <input type="text" className="form-control" id="Tm_detection_tmm_table"
                                           name="Tm_detection_tmm_table"
                                           value={formData.Tm_detection_tmm_table} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_imm_table" className="form-label">IMM
                                        Table:</label>
                                    <input type="text" className="form-control" id="Tm_detection_imm_table"
                                           name="Tm_detection_imm_table"
                                           value={formData.Tm_detection_imm_table} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_de_table" className="form-label">DE
                                        Table:</label>
                                    <input type="text" className="form-control" id="Tm_detection_de_table"
                                           name="Tm_detection_de_table"
                                           value={formData.Tm_detection_de_table} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_dnac1" className="form-label">DNA
                                        Concentration 1 (nM):</label>
                                    <input type="number" className="form-control" id="Tm_detection_dnac1"
                                           name="Tm_detection_dnac1"
                                           value={formData.Tm_detection_dnac1} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_dnac2" className="form-label">DNA
                                        Concentration 2 (nM):</label>
                                    <input type="number" className="form-control" id="Tm_detection_dnac2"
                                           name="Tm_detection_dnac2"
                                           value={formData.Tm_detection_dnac2} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_selfcomp"
                                           className="form-label">Self-Complementarity:</label>
                                    <select className="form-control" id="Tm_detection_selfcomp"
                                            name="Tm_detection_selfcomp"
                                            value={formData.Tm_detection_selfcomp} onChange={handleChange}>
                                        <option value="true">True</option>
                                        <option value="false">False</option>
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_saltcorr" className="form-label">Salt
                                        Correction:</label>
                                    <input type="number" className="form-control" id="Tm_detection_saltcorr"
                                           name="Tm_detection_saltcorr"
                                           value={formData.Tm_detection_saltcorr} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_Na" className="form-label">Na Concentration
                                        (mM):</label>
                                    <input type="number" className="form-control" id="Tm_detection_Na"
                                           name="Tm_detection_Na"
                                           value={formData.Tm_detection_Na} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_K" className="form-label">K Concentration
                                        (mM):</label>
                                    <input type="number" className="form-control" id="Tm_detection_K"
                                           name="Tm_detection_K"
                                           value={formData.Tm_detection_K} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_Tris" className="form-label">Tris
                                        Concentration (mM):</label>
                                    <input type="number" className="form-control" id="Tm_detection_Tris"
                                           name="Tm_detection_Tris"
                                           value={formData.Tm_detection_Tris} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_Mg" className="form-label">Mg Concentration
                                        (mM):</label>
                                    <input type="number" className="form-control" id="Tm_detection_Mg"
                                           name="Tm_detection_Mg"
                                           value={formData.Tm_detection_Mg} onChange={handleChange}/>
                                </div>
                                <div className="col-md-6">
                                    <label htmlFor="Tm_detection_dNTPs" className="form-label">dNTPs
                                        Concentration (mM):</label>
                                    <input type="number" className="form-control" id="Tm_detection_dNTPs"
                                           name="Tm_detection_dNTPs"
                                           value={formData.Tm_detection_dNTPs} onChange={handleChange}/>
                                </div>
                            </div>
                            <div className="mb-4">
                                <h5>Chemical Correction Parameters for Detection Oligo</h5>
                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_DMSO" className="form-label">DMSO
                                            (%):</label>
                                        <input type="number" className="form-control" id="Tm_detection_DMSO"
                                               name="Tm_detection_DMSO"
                                               value={formData.Tm_detection_DMSO} onChange={handleChange}/>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_fmd" className="form-label">Formamide
                                            (fmd, %):</label>
                                        <input type="number" className="form-control" id="Tm_detection_fmd"
                                               name="Tm_detection_fmd"
                                               value={formData.Tm_detection_fmd} onChange={handleChange}/>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_DMSOfactor" className="form-label">DMSO
                                            Factor:</label>
                                        <input type="number" className="form-control"
                                               id="Tm_detection_DMSOfactor" name="Tm_detection_DMSOfactor"
                                               value={formData.Tm_detection_DMSOfactor} step="0.01"
                                               onChange={handleChange}/>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_fmdfactor" className="form-label">Formamide
                                            Factor:</label>
                                        <input type="number" className="form-control"
                                               id="Tm_detection_fmdfactor" name="Tm_detection_fmdfactor"
                                               value={formData.Tm_detection_fmdfactor} step="0.01"
                                               onChange={handleChange}/>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_fmdmethod" className="form-label">Formamide
                                            Method:</label>
                                        <input type="number" className="form-control"
                                               id="Tm_detection_fmdmethod" name="Tm_detection_fmdmethod"
                                               value={formData.Tm_detection_fmdmethod}
                                               onChange={handleChange}/>
                                    </div>
                                    <div className="col-md-6">
                                        <label htmlFor="Tm_detection_GC" className="form-label">GC
                                            (optional):</label>
                                        <input type="text" className="form-control" id="Tm_detection_GC"
                                               name="Tm_detection_GC"
                                               value={formData.Tm_detection_GC} onChange={handleChange}
                                               placeholder="null"/>
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

        try {
            // Send formData to the backend
            const uploadedPaths = await uploadFiles();
            const finalFormData = {
                ...formData,
                ...uploadedPaths, // Include uploaded file paths
            };
            const response = await axios.post('http://localhost:5000/api/scrinshot', finalFormData,
                {
                    headers: {"Content-Type": "application/json"},
                });
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

                    <div className="d-flex justify-content-center mt-3">
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Running..." : "Submit"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default Scrinshot;