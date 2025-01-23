import React, { useState, useEffect } from 'react';
import {Link} from "react-router-dom";
import { io } from "socket.io-client";
import Navbar from "../modules/nav";
import axios from "axios";
const Merfish: React.FC = () => {
    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [progress, setProgress] = useState(0);
    //const [output, setOutput] = useState("");
    const [status, setStatus] = useState("idle");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [files, setFiles] = useState({
        file_regions: null,
        files_fasta_target_probe_database: null,
        files_fasta_reference_database_target_probe : null,
        files_fasta_reference_database_readout_probe: null,
        files_fasta_reference_database_primer: null,
    });
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files: selectedFiles } = e.target;

        if (!selectedFiles) return;

        // @ts-ignore
        setFiles((prevFiles) => {
            // Check if the input field should support multiple files
            if (name === "files_fasta_target_probe_database" || name === "files_fasta_reference_database_target_probe") {
                return {
                    ...prevFiles,
                    [name]: [...(prevFiles[name] || []), ...Array.from(selectedFiles)], // Append new files to existing ones
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
        dir_output: "output_merfish_probe_designer",
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
        probe_Tm_opt: "70",
        probe_Tm_max: "75",
        homopolymeric_A: "6",
        homopolymeric_T: "6",
        homopolymeric_C: "6",
        homopolymeric_G: "6",

        target_probe_T_secondary_structure: '76',
        target_probe_secondary_structures_threshold_deltaG: '0',
        target_probe_GC_weight: "1",
        target_probe_Tm_weight: "1",


        // Set Selection Parameters
        target_probe_isoform_weight: "2",

        set_size_min: "50",
        set_size_opt: "50",
        distance_between_probes: "0",
        n_sets: "100",

        // Readout Probe Parameters
        files_fasta_reference_database_readout_probe: '', //fasta file with sequences used as reference for the specificity filters. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest
        readout_probe_length: '20',
        readout_probe_base_prob_a: '0.25',
        readout_probe_base_prob_c: '0.00',
        readout_probe_base_prob_g: '0.50',
        readout_probe_base_prob_t: '0.25',

        readout_probe_GC_content_min: '40',
        readout_probe_GC_content_max: '50',
        readout_probe_homopolymeric_base_n_g:'3',
        readout_probe_set_size: '16',
        readout_probe_homogeneous_properties_weights_tmnn: '1',
        readout_probe_homogeneous_properties_weights_GC_content:'1',
        n_bits: '16',
        min_hamming_dist: '4',
        hamming_weight: '4',
        channels_ids: 'Cy3b',

        //Primer Parameters,

        files_fasta_reference_database_primer: '',
        reverse_primer_sequence: 'CCCTATAGTGAGTCGTATTA',
        primer_length: '20',
        primer_base_probabilities_a: '0.25',
        primer_base_probabilities_c: '0.25',
        primer_base_probabilities_g: '0.25',
        primer_base_probabilities_t: '0.25',
        primer_GC_content_min: '50',
        primer_GC_content_max: '65',
        primer_number_GC_GCclamp: '1',
        primer_number_three_prime_base_GCclamp: '2',
        primer_homopolymeric_base_n_a: '4',
        primer_homopolymeric_base_n_t: '4',
        primer_homopolymeric_base_n_c: '4',
        primer_homopolymeric_base_n_g: '4',
        primer_max_len_selfcomplement: '6',
        primer_max_len_complement_reverse_primer: '5',
        primer_Tm_min: '60',
        primer_Tm_max: '75',
        primer_T_secondary_structure: '76',  // Temperature at which the free energy is calculated
        primer_secondary_structures_threshold_deltaG: '0', // threshold for the secondary structure free energy -> oligo rejected if it presents a structure with a negative free energy at the defined temperature

        // DEVELOPER PARAMETERS
        // Target Probe Parameters
        target_probe_specificity_blastn_search_parameters_perc_identity: "80",
        target_probe_specificity_blastn_search_parameters_strand: "minus", // this parameter is fixed, if reference is whole genome, consider using "both"
        target_probe_specificity_blastn_search_parameters_word_size: "10",
        target_probe_specificity_blastn_search_parameters_dust: "no",
        target_probe_specificity_blastn_search_parameters_soft_masking: "false",
        target_probe_specificity_blastn_search_parameters_max_target_seqs: "10",
        target_probe_specificity_blastn_search_parameters_max_hsps: "1000",

        target_probe_specificity_blastn_hit_parameters_min_alignment_length: "17",

        target_probe_cross_hybridization_blastn_search_parameters_perc_identity: "80",
        target_probe_cross_hybridization_blastn_search_parameters_strand: "minus", // this parameter is fixed
        target_probe_cross_hybridization_blastn_search_parameters_word_size: "7",
        target_probe_cross_hybridization_blastn_search_parameters_dust: "no",
        target_probe_cross_hybridization_blastn_search_parameters_soft_masking: "false",
        target_probe_cross_hybridization_blastn_search_parameters_max_target_seqs: "10",

        target_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length: "17",

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

        target_probe_Tm_chem_correction_parameters: "null",
        target_probe_Tm_salt_correction_parameters: "null",

        // Readout Probe Parameters
        readout_probe_initial_num_sequences: "100000",

        readout_probe_specificity_blastn_search_parameters_perc_identity: "100",
        readout_probe_specificity_blastn_search_parameters_strand: "minus",
        readout_probe_specificity_blastn_search_parameters_word_size: "7",
        readout_probe_specificity_blastn_search_parameters_dust: "no",
        readout_probe_specificity_blastn_search_parameters_soft_masking: "false",
        readout_probe_specificity_blastn_search_parameters_max_target_seqs: "10",
        readout_probe_specificity_blastn_search_parameters_max_hsps: "1000",

        readout_probe_specificity_blastn_hit_parameters_min_alignment_length: "11",

        readout_probe_cross_hybridization_blastn_search_parameters_perc_identity: "100",
        readout_probe_cross_hybridization_blastn_search_parameters_strand: "minus",
        readout_probe_cross_hybridization_blastn_search_parameters_word_size: "7",
        readout_probe_cross_hybridization_blastn_search_parameters_dust: "no",
        readout_probe_cross_hybridization_blastn_search_parameters_soft_masking: "false",
        readout_probe_cross_hybridization_blastn_search_parameters_max_target_seqs: "10",

        readout_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length: "11",

        readout_probe_Tm_parameters_check: "true",
        readout_probe_Tm_parameters_strict: "true",
        readout_probe_Tm_parameters_c_seq: "null",
        readout_probe_Tm_parameters_shift: "0",
        readout_probe_Tm_parameters_nn_table: "DNA_NN4",
        readout_probe_Tm_parameters_tmm_table: "DNA_TMM1",
        readout_probe_Tm_parameters_imm_table: "DNA_IMM1",
        readout_probe_Tm_parameters_de_table: "DNA_DE1",
        readout_probe_Tm_parameters_dnac1: "25",
        readout_probe_Tm_parameters_dnac2: "25",
        readout_probe_Tm_parameters_selfcomp: "false",
        readout_probe_Tm_parameters_saltcorr: "5",
        readout_probe_Tm_parameters_Na: "300",
        readout_probe_Tm_parameters_K: "0",
        readout_probe_Tm_parameters_Tris: "0",
        readout_probe_Tm_parameters_Mg: "0",
        readout_probe_Tm_parameters_dNTPs: "0",

        readout_probe_Tm_chem_correction_parameters: "null",
        readout_probe_Tm_salt_correction_parameters: "null",

        readout_probe_n_combinations: "100000",

        // Primer Parameters
        primer_initial_num_sequences: "1000000",

        primer_specificity_reference_blastn_search_parameters_perc_identity: "100",
        primer_specificity_reference_blastn_search_parameters_strand: "minus",
        primer_specificity_reference_blastn_search_parameters_word_size: "7",
        primer_specificity_reference_blastn_search_parameters_dust: "no",
        primer_specificity_reference_blastn_search_parameters_soft_masking: "false",
        primer_specificity_reference_blastn_search_parameters_max_target_seqs: "10",
        primer_specificity_reference_blastn_search_parameters_max_hsps: "1000",

        primer_specificity_reference_blastn_hit_parameters_min_alignment_length: "14",

        primer_specificity_encoding_probes_blastn_search_parameters_perc_identity: "100",
        primer_specificity_encoding_probes_blastn_search_parameters_strand: "minus",
        primer_specificity_encoding_probes_blastn_search_parameters_word_size: "7",
        primer_specificity_encoding_probes_blastn_search_parameters_dust: "no",
        primer_specificity_encoding_probes_blastn_search_parameters_soft_masking: "false",
        primer_specificity_encoding_probes_blastn_search_parameters_max_target_seqs: "10",
        primer_specificity_encoding_probes_blastn_search_parameters_max_hsps: "1000",

        primer_specificity_encoding_probes_blastn_hit_parameters_min_alignment_length: "11",

        primer_Tm_parameters_check: "true",
        primer_Tm_parameters_strict: "true",
        primer_Tm_parameters_c_seq: "null",
        primer_Tm_parameters_shift: "0",
        primer_Tm_parameters_nn_table: "DNA_NN4",
        primer_Tm_parameters_tmm_table: "DNA_TMM1",
        primer_Tm_parameters_imm_table: "DNA_IMM1",
        primer_Tm_parameters_de_table: "DNA_DE1",
        primer_Tm_parameters_dnac1: "500",
        primer_Tm_parameters_dnac2: "25",
        primer_Tm_parameters_selfcomp: "false",
        primer_Tm_parameters_saltcorr: "5",
        primer_Tm_parameters_Na: "300",
        primer_Tm_parameters_K: "0",
        primer_Tm_parameters_Tris: "0",
        primer_Tm_parameters_Mg: "0",
        primer_Tm_parameters_dNTPs: "0",

        primer_Tm_chem_correction_parameters: "null",
        primer_Tm_salt_correction_parameters: "null",
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
                                <label htmlFor="file_regions" className="form-label">Regions File:</label>
                                <input
                                    type="file"
                                    className="form-control"
                                    id="file_regions"
                                    name="file_regions"
                                    onChange={handleFileChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="files_fasta_target_probe_database" className="form-label">Fasta Probe
                                    Database:</label>
                                <input
                                    type="file"
                                    className="form-control"
                                    id="files_fasta_target_probe_database"
                                    name="files_fasta_target_probe_database"
                                    onChange={handleFileChange}
                                    multiple
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="files_fasta_reference_database_target_probe" className="form-label">Fasta
                                    Probe Reference
                                    Database:</label>
                                <input
                                    type="file"
                                    className="form-control"
                                    id="files_fasta_reference_database_target_probe"
                                    name="files_fasta_reference_database_target_probe"
                                    onChange={handleFileChange}
                                    multiple
                                />
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
                            <label htmlFor="probe_Tm_opt" className="form-label">Max Tm (°C):</label>
                            <input type="number" className="form-control" id="probe_Tm_opt" name="probe_Tm_opt"
                                   value={formData.probe_Tm_opt} onChange={handleChange} required/>
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
                                <label htmlFor="target_probe_T_secondary_structure" className="form-label">Secondary
                                    Structure Temperature:</label>
                                <input type="number" className="form-control" id="target_probe_T_secondary_structure"
                                       name="target_probe_T_secondary_structure"
                                       value={formData.target_probe_T_secondary_structure} onChange={handleChange}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="target_probe_secondary_structures_threshold_deltaG"
                                       className="form-label">Threshold for secondary structure:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_secondary_structures_threshold_deltaG"
                                       name="target_probe_secondary_structures_threshold_deltaG"
                                       value={formData.target_probe_secondary_structures_threshold_deltaG}
                                       onChange={handleChange}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="target_probe_GC_weight" className="form-label">Weight of the GC
                                    content:</label>
                                <input type="number" className="form-control" id="target_probe_GC_weight"
                                       name="target_probe_GC_weight"
                                       value={formData.target_probe_GC_weight} onChange={handleChange}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="target_probe_Tm_weight" className="form-label">Weight of the temperature
                                    of the probe:</label>
                                <input type="number" className="form-control" id="target_probe_Tm_weight"
                                       name="target_probe_Tm_weight"
                                       value={formData.target_probe_Tm_weight} onChange={handleChange}/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="set_size_min" className="form-label">Minimum Probe Set
                                    Size:</label>
                                <input type="number" className="form-control" id="set_size_min"
                                       name="set_size_min"
                                       value={formData.set_size_min} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="set_size_opt" className="form-label">Optimal Probe Set
                                    Size:</label>
                                <input type="number" className="form-control" id="set_size_opt"
                                       name="probeset_size_opt"
                                       value={formData.set_size_opt} onChange={handleChange} required/>
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

            case 'readout':
                return (
                    <div>
                        <div className="mb-4">
                            <h4>Readout Probe Parameters</h4>

                            <div className="mb-3">
                                <label htmlFor="files_fasta_reference_database_readout_probe" className="form-label">Fasta
                                    Readout Probe Reference
                                    Database:</label>
                                <input
                                    type="file"
                                    className="form-control"
                                    id="files_fasta_reference_database_readout_probe"
                                    name="files_fasta_reference_database_readout_probe"
                                    onChange={handleFileChange}
                                    multiple
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_length" className="form-label">Length of readout
                                    probes:</label>
                                <input type="number" className="form-control" id="readout_probe_length"
                                       name="readout_probe_length"
                                       value={formData.readout_probe_length} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_base_prob_a" className="form-label">Probability of base
                                    A:</label>
                                <input type="number" className="form-control" id="readout_probe_base_prob_a"
                                       name="readout_probe_base_prob_a"
                                       value={formData.readout_probe_base_prob_a} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_base_prob_c" className="form-label">Probability of base
                                    C:</label>
                                <input type="number" className="form-control" id="readout_probe_base_prob_c"
                                       name="readout_probe_base_prob_c"
                                       value={formData.readout_probe_base_prob_c} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_base_prob_g" className="form-label">Probability of base
                                    A:</label>
                                <input type="number" className="form-control" id="readout_probe_base_prob_g"
                                       name="readout_probe_base_prob_g"
                                       value={formData.readout_probe_base_prob_g} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_base_prob_t" className="form-label">Probability of base
                                    A:</label>
                                <input type="number" className="form-control" id="readout_probe_base_prob_t"
                                       name="readout_probe_base_prob_t"
                                       value={formData.readout_probe_base_prob_t} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_GC_content_min" className="form-label">Minimum GC
                                    content:</label>
                                <input type="number" className="form-control" id="readout_probe_GC_content_min"
                                       name="readout_probe_GC_content_min"
                                       value={formData.readout_probe_GC_content_min} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_GC_content_max" className="form-label">Maximum GC
                                    content:</label>
                                <input type="number" className="form-control" id="readout_probe_GC_content_max"
                                       name="readout_probe_GC_content_max"
                                       value={formData.readout_probe_GC_content_max} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_homopolymeric_base_n_g" className="form-label">Minimum
                                    number of Nucleotides:</label>
                                <input type="number" className="form-control" id="readout_probe_homopolymeric_base_n_g"
                                       name="readout_probe_homopolymeric_base_n_g"
                                       value={formData.readout_probe_homopolymeric_base_n_g} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_set_size" className="form-label">Total number of readout
                                    probes:</label>
                                <input type="number" className="form-control" id="readout_probe_set_size"
                                       name="readout_probe_set_size"
                                       value={formData.readout_probe_set_size} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_homogeneous_properties_weights_tmnn"
                                       className="form-label">Homogeneous Properties Weights (TmNN):</label>
                                <input type="number" className="form-control"
                                       id="readout_probe_homogeneous_properties_weights_tmnn"
                                       name="readout_probe_homogeneous_properties_weights_tmnn"
                                       value={formData.readout_probe_homogeneous_properties_weights_tmnn}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_homogeneous_properties_weights_GC_content"
                                       className="form-label">Homogeneous Properties Weights (GC Content):</label>
                                <input type="number" className="form-control"
                                       id="readout_probe_homogeneous_properties_weights_GC_content"
                                       name="readout_probe_homogeneous_properties_weights_GC_content"
                                       value={formData.readout_probe_homogeneous_properties_weights_GC_content}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="n_bits" className="form-label">Number of Bits:</label>
                                <input type="number" className="form-control" id="n_bits"
                                       name="n_bits"
                                       value={formData.n_bits} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="min_hamming_dist" className="form-label">Minimum Hamming
                                    Distance:</label>
                                <input type="number" className="form-control" id="min_hamming_dist"
                                       name="min_hamming_dist"
                                       value={formData.min_hamming_dist} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="hamming_weight" className="form-label">Hamming Weight:</label>
                                <input type="number" className="form-control" id="hamming_weight"
                                       name="hamming_weight"
                                       value={formData.hamming_weight} onChange={handleChange} required/>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="channels_ids" className="form-label">Channel IDs:</label>
                                <input type="text" className="form-control" id="channels_ids"
                                       name="channels_ids"
                                       value={formData.channels_ids} onChange={handleChange} required/>
                            </div>

                        </div>
                    </div>
                );

            case 'primer_parameters':
                return (
                    <div>
                        <div className="mb-4">
                            <h4>Primer Parameters</h4>

                            <div className="mb-3">
                                <label htmlFor="files_fasta_reference_database_primer" className="form-label">Fasta Reference Database:</label>
                                <input
                                    type="file"
                                    className="form-control"
                                    id="files_fasta_reference_database_primer"
                                    name="files_fasta_reference_database_primer"
                                    onChange={handleFileChange}
                                    multiple
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="reverse_primer_sequence" className="form-label">Reverse Primer Sequence:</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    id="reverse_primer_sequence"
                                    name="reverse_primer_sequence"
                                    value={formData.reverse_primer_sequence}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_length" className="form-label">Primer Length:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_length"
                                    name="primer_length"
                                    value={formData.primer_length}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_base_probabilities_a" className="form-label">Probability of Base A:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_base_probabilities_a"
                                    name="primer_base_probabilities_a"
                                    value={formData.primer_base_probabilities_a}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_base_probabilities_c" className="form-label">Probability of Base C:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_base_probabilities_c"
                                    name="primer_base_probabilities_c"
                                    value={formData.primer_base_probabilities_c}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_base_probabilities_g" className="form-label">Probability of Base G:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_base_probabilities_g"
                                    name="primer_base_probabilities_g"
                                    value={formData.primer_base_probabilities_g}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_base_probabilities_t" className="form-label">Probability of Base T:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_base_probabilities_t"
                                    name="primer_base_probabilities_t"
                                    value={formData.primer_base_probabilities_t}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_GC_content_min" className="form-label">Min GC Content:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_GC_content_min"
                                    name="primer_GC_content_min"
                                    value={formData.primer_GC_content_min}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_GC_content_max" className="form-label">Max GC Content:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_GC_content_max"
                                    name="primer_GC_content_max"
                                    value={formData.primer_GC_content_max}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_number_GC_GCclamp" className="form-label">GC Clamp (GC Count):</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_number_GC_GCclamp"
                                    name="primer_number_GC_GCclamp"
                                    value={formData.primer_number_GC_GCclamp}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_number_three_prime_base_GCclamp" className="form-label">3' Base GC Clamp Count:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_number_three_prime_base_GCclamp"
                                    name="primer_number_three_prime_base_GCclamp"
                                    value={formData.primer_number_three_prime_base_GCclamp}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="row g-3">
                                <div className="col-md-3">
                                    <label htmlFor="primer_homopolymeric_base_n_a" className="form-label">Homopolymeric A:</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_homopolymeric_base_n_a"
                                        name="primer_homopolymeric_base_n_a"
                                        value={formData.primer_homopolymeric_base_n_a}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="col-md-3">
                                    <label htmlFor="primer_homopolymeric_base_n_t" className="form-label">Homopolymeric T:</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_homopolymeric_base_n_t"
                                        name="primer_homopolymeric_base_n_t"
                                        value={formData.primer_homopolymeric_base_n_t}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="col-md-3">
                                    <label htmlFor="primer_homopolymeric_base_n_c" className="form-label">Homopolymeric C:</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_homopolymeric_base_n_c"
                                        name="primer_homopolymeric_base_n_c"
                                        value={formData.primer_homopolymeric_base_n_c}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="col-md-3">
                                    <label htmlFor="primer_homopolymeric_base_n_g" className="form-label">Homopolymeric G:</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="primer_homopolymeric_base_n_g"
                                        name="primer_homopolymeric_base_n_g"
                                        value={formData.primer_homopolymeric_base_n_g}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_max_len_selfcomplement" className="form-label">Max Self-Complementary Length:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_max_len_selfcomplement"
                                    name="primer_max_len_selfcomplement"
                                    value={formData.primer_max_len_selfcomplement}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_max_len_complement_reverse_primer" className="form-label">Max Complement Reverse Primer Length:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_max_len_complement_reverse_primer"
                                    name="primer_max_len_complement_reverse_primer"
                                    value={formData.primer_max_len_complement_reverse_primer}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_Tm_min" className="form-label">Min Primer Tm (°C):</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_Tm_min"
                                    name="primer_Tm_min"
                                    value={formData.primer_Tm_min}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_Tm_max" className="form-label">Max Primer Tm (°C):</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_Tm_max"
                                    name="primer_Tm_max"
                                    value={formData.primer_Tm_max}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_T_secondary_structure" className="form-label">Secondary Structure Temperature (°C):</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_T_secondary_structure"
                                    name="primer_T_secondary_structure"
                                    value={formData.primer_T_secondary_structure}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="mb-3">
                                <label htmlFor="primer_secondary_structures_threshold_deltaG" className="form-label">Threshold Delta G:</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    id="primer_secondary_structures_threshold_deltaG"
                                    name="primer_secondary_structures_threshold_deltaG"
                                    value={formData.primer_secondary_structures_threshold_deltaG}
                                    onChange={handleChange}
                                />
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
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_perc_identity"
                                       className="form-label">Percent
                                    Identity:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_specificity_blastn_search_parameters_perc_identity"
                                       name="target_probe_specificity_blastn_search_parameters_perc_identity"
                                       value={formData.target_probe_specificity_blastn_search_parameters_perc_identity}
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
                                       value={formData.target_probe_specificity_blastn_search_parameters_strand}
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
                                       value={formData.target_probe_specificity_blastn_search_parameters_word_size}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_dust"
                                       className="form-label">Dust:</label>
                                <input type="text" className="form-control"
                                       id="target_probe_specificity_blastn_search_parameters_dust"
                                       name="target_probe_specificity_blastn_search_parameters_dust"
                                       value={formData.target_probe_specificity_blastn_search_parameters_dust}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_soft_masking"
                                       className="form-label">Soft
                                    Masking:</label>
                                <input type="text" className="form-control"
                                       id="target_probe_specificity_blastn_search_parameters_soft_masking"
                                       name="target_probe_specificity_blastn_search_parameters_soft_masking"
                                       value={formData.target_probe_specificity_blastn_search_parameters_soft_masking}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_max_target_seqs"
                                       className="form-label">Max
                                    Target Sequences:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_specificity_blastn_search_parameters_max_target_seqs"
                                       name="target_probe_specificity_blastn_search_parameters_max_target_seqs"
                                       value={formData.target_probe_specificity_blastn_search_parameters_max_target_seqs}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_search_parameters_max_hsps"
                                       className="form-label">Max
                                    HSPs:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_specificity_blastn_search_parameters_max_hsps"
                                       name="target_probe_specificity_blastn_search_parameters_max_hsps"
                                       value={formData.target_probe_specificity_blastn_search_parameters_max_hsps}
                                       onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_specificity_blastn_hit_parameters_min_alignment_length"
                                       className="form-label">Max
                                    HSPs:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_specificity_blastn_hit_parameters_min_alignment_length"
                                       name="target_probe_specificity_blastn_hit_parameters_min_alignment_length"
                                       value={formData.target_probe_specificity_blastn_hit_parameters_min_alignment_length}
                                       onChange={handleChange}
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
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_perc_identity" className="form-label">Percent
                                    Identity:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_cross_hybridization_blastn_search_parameters_perc_identity"
                                       name="target_probe_cross_hybridization_blastn_search_parameters_perc_identity"
                                       value={formData.target_probe_cross_hybridization_blastn_search_parameters_perc_identity}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_strand"
                                       className="form-label">Strand:</label>
                                <input type="text" className="form-control" id="target_probe_cross_hybridization_blastn_search_parameters_strand"
                                       name="target_probe_cross_hybridization_blastn_search_parameters_strand"
                                       value={formData.target_probe_cross_hybridization_blastn_search_parameters_strand} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_word_size" className="form-label">Word
                                    Size:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_cross_hybridization_blastn_search_parameters_word_size" name="target_probe_cross_hybridization_blastn_search_parameters_word_size"
                                       value={formData.target_probe_cross_hybridization_blastn_search_parameters_word_size} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_dust"
                                       className="form-label">Dust:</label>
                                <input type="text" className="form-control" id="target_probe_cross_hybridization_blastn_search_parameters_dust"
                                       name="target_probe_cross_hybridization_blastn_search_parameters_dust"
                                       value={formData.target_probe_cross_hybridization_blastn_search_parameters_dust} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_soft_masking" className="form-label">Soft
                                    Masking:</label>
                                <input type="text" className="form-control"
                                       id="target_probe_cross_hybridization_blastn_search_parameters_soft_masking"
                                       name="target_probe_cross_hybridization_blastn_search_parameters_soft_masking"
                                       value={formData.target_probe_cross_hybridization_blastn_search_parameters_soft_masking}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_cross_hybridization_blastn_search_parameters_max_target_seqs" className="form-label">Max
                                    Target Sequences:</label>
                                <input type="number" className="form-control"
                                       id="target_probe_cross_hybridization_blastn_search_parameters_max_target_seqs"
                                       name="target_probe_cross_hybridization_blastn_search_parameters_max_target_seqs"
                                       value={formData.target_probe_cross_hybridization_blastn_search_parameters_max_target_seqs}
                                       onChange={handleChange} required/>
                            </div>
                            <div className="col-md-6">
                                <label htmlFor="target_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length"
                                       className="form-label">Minimum alignment Length</label>
                                <input type="number" className="form-control"
                                       id="target_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length" name="target_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length"
                                       value={formData.target_probe_cross_hybridization_blastn_hit_parameters_min_alignment_length} onChange={handleChange}
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

                        </div>
                    </div>
                );
            case'readout':
                return (
                    <div>
                        <div className="mb-4">
                            <h5>Readout Probe Parameters</h5>
                            <div className="mb-3">
                                <label htmlFor="readout_probe_initial_num_sequences" className="form-label">Initial
                                    Number of Sequences:</label>
                                <input type="number" className="form-control" id="readout_probe_initial_num_sequences"
                                       name="readout_probe_initial_num_sequences"
                                       value={formData.readout_probe_initial_num_sequences} onChange={handleChange}
                                       required/>
                            </div>
                            <div className="row g-3">
                                <div className="mb-3">
                                    <label htmlFor="perc_identity" className="form-label">Percentage Identity:</label>
                                    <input type="number" className="form-control" id="perc_identity"
                                           name="readout_probe_specificity_blastn_search_parameters_perc_identity"
                                           value={formData.readout_probe_specificity_blastn_search_parameters_perc_identity}
                                           onChange={handleChange} required/>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="strand" className="form-label">Strand:</label>
                                    <select className="form-select" id="strand"
                                            name="readout_probe_specificity_blastn_search_parameters_strand"
                                            value={formData.readout_probe_specificity_blastn_search_parameters_strand}
                                            onChange={handleChange}>
                                        <option value="minus">Minus</option>
                                        <option value="plus">Plus</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="word_size" className="form-label">Word Size:</label>
                                    <input type="number" className="form-control" id="word_size"
                                           name="readout_probe_specificity_blastn_search_parameters_word_size"
                                           value={formData.readout_probe_specificity_blastn_search_parameters_word_size}
                                           onChange={handleChange} required/>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="dust" className="form-label">Dust:</label>
                                    <select className="form-select" id="dust"
                                            name="readout_probe_specificity_blastn_search_parameters_dust"
                                            value={formData.readout_probe_specificity_blastn_search_parameters_dust}
                                            onChange={handleChange}>
                                        <option value="no">No</option>
                                        <option value="yes">Yes</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="soft_masking" className="form-label">Soft Masking:</label>
                                    <select className="form-select" id="soft_masking"
                                            name="readout_probe_specificity_blastn_search_parameters_soft_masking"
                                            value={formData.readout_probe_specificity_blastn_search_parameters_soft_masking}
                                            onChange={handleChange}>
                                        <option value="false">False</option>
                                        <option value="true">True</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="max_target_seqs" className="form-label">Max Target
                                        Sequences:</label>
                                    <input type="number" className="form-control" id="max_target_seqs"
                                           name="readout_probe_specificity_blastn_search_parameters_max_target_seqs"
                                           value={formData.readout_probe_specificity_blastn_search_parameters_max_target_seqs}
                                           onChange={handleChange} required/>
                                </div>
                                <div className="mb-3">
                                    <label htmlFor="max_hsps" className="form-label">Max HSPs:</label>
                                    <input type="number" className="form-control" id="max_hsps"
                                           name="readout_probe_specificity_blastn_search_parameters_max_hsps"
                                           value={formData.readout_probe_specificity_blastn_search_parameters_max_hsps}
                                           onChange={handleChange} required/>
                                </div>
                                <div>
                                    <h4>Readout Probe BLASTn Hit Parameters</h4>
                                    <div className="mb-3">
                                        <label htmlFor="min_alignment_length" className="form-label">Min Alignment
                                            Length:</label>
                                        <input type="number" className="form-control" id="min_alignment_length"
                                               name="readout_probe_specificity_blastn_hit_parameters_min_alignment_length"
                                               value={formData.readout_probe_specificity_blastn_hit_parameters_min_alignment_length}
                                               onChange={handleChange} required/>
                                    </div>
                                </div>


                            </div>
                        </div>

                    </div>
                );
            case 'primerpro':
                return (
                    <div>
                        <div className="mb-3">
                            <label htmlFor="primer_initial_num_sequences" className="form-label">Initial Number of
                                Sequences:</label>
                            <input type="number" className="form-control" id="primer_initial_num_sequences"
                                   name="primer_initial_num_sequences"
                                   value={formData.primer_initial_num_sequences} onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="perc_identity" className="form-label">Percentage Identity:</label>
                            <input type="number" className="form-control" id="perc_identity"
                                   name="primer_specificity_reference_blastn_search_parameters_perc_identity"
                                   value={formData.primer_specificity_reference_blastn_search_parameters_perc_identity}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="strand" className="form-label">Strand:</label>
                            <select className="form-select" id="strand"
                                    name="primer_specificity_reference_blastn_search_parameters_strand"
                                    value={formData.primer_specificity_reference_blastn_search_parameters_strand}
                                    onChange={handleChange}>
                                <option value="minus">Minus</option>
                                <option value="plus">Plus</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="word_size" className="form-label">Word Size:</label>
                            <input type="number" className="form-control" id="word_size"
                                   name="primer_specificity_reference_blastn_search_parameters_word_size"
                                   value={formData.primer_specificity_reference_blastn_search_parameters_word_size}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="dust" className="form-label">Dust:</label>
                            <select className="form-select" id="dust"
                                    name="primer_specificity_reference_blastn_search_parameters_dust"
                                    value={formData.primer_specificity_reference_blastn_search_parameters_dust}
                                    onChange={handleChange}>
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="soft_masking" className="form-label">Soft Masking:</label>
                            <select className="form-select" id="soft_masking"
                                    name="primer_specificity_reference_blastn_search_parameters_soft_masking"
                                    value={formData.primer_specificity_reference_blastn_search_parameters_soft_masking}
                                    onChange={handleChange}>
                                <option value="false">False</option>
                                <option value="true">True</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="max_target_seqs" className="form-label">Max Target Sequences:</label>
                            <input type="number" className="form-control" id="max_target_seqs"
                                   name="primer_specificity_reference_blastn_search_parameters_max_target_seqs"
                                   value={formData.primer_specificity_reference_blastn_search_parameters_max_target_seqs}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="max_hsps" className="form-label">Max HSPs:</label>
                            <input type="number" className="form-control" id="max_hsps"
                                   name="primer_specificity_reference_blastn_search_parameters_max_hsps"
                                   value={formData.primer_specificity_reference_blastn_search_parameters_max_hsps}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="min_alignment_length" className="form-label">Min Alignment Length:</label>
                            <input type="number" className="form-control" id="min_alignment_length"
                                   name="primer_specificity_reference_blastn_hit_parameters_min_alignment_length"
                                   value={formData.primer_specificity_reference_blastn_hit_parameters_min_alignment_length}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="perc_identity" className="form-label">Percentage Identity:</label>
                            <input type="number" className="form-control" id="perc_identity"
                                   name="primer_specificity_encoding_probes_blastn_search_parameters_perc_identity"
                                   value={formData.primer_specificity_encoding_probes_blastn_search_parameters_perc_identity}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="strand" className="form-label">Strand:</label>
                            <select className="form-select" id="strand"
                                    name="primer_specificity_encoding_probes_blastn_search_parameters_strand"
                                    value={formData.primer_specificity_encoding_probes_blastn_search_parameters_strand}
                                    onChange={handleChange}>
                                <option value="minus">Minus</option>
                                <option value="plus">Plus</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="word_size" className="form-label">Word Size:</label>
                            <input type="number" className="form-control" id="word_size"
                                   name="primer_specificity_encoding_probes_blastn_search_parameters_word_size"
                                   value={formData.primer_specificity_encoding_probes_blastn_search_parameters_word_size}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="dust" className="form-label">Dust:</label>
                            <select className="form-select" id="dust"
                                    name="primer_specificity_encoding_probes_blastn_search_parameters_dust"
                                    value={formData.primer_specificity_encoding_probes_blastn_search_parameters_dust}
                                    onChange={handleChange}>
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="soft_masking" className="form-label">Soft Masking:</label>
                            <select className="form-select" id="soft_masking"
                                    name="primer_specificity_encoding_probes_blastn_search_parameters_soft_masking"
                                    value={formData.primer_specificity_encoding_probes_blastn_search_parameters_soft_masking}
                                    onChange={handleChange}>
                                <option value="false">False</option>
                                <option value="true">True</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="max_target_seqs" className="form-label">Max Target Sequences:</label>
                            <input type="number" className="form-control" id="max_target_seqs"
                                   name="primer_specificity_encoding_probes_blastn_search_parameters_max_target_seqs"
                                   value={formData.primer_specificity_encoding_probes_blastn_search_parameters_max_target_seqs}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="max_hsps" className="form-label">Max HSPs:</label>
                            <input type="number" className="form-control" id="max_hsps"
                                   name="primer_specificity_encoding_probes_blastn_search_parameters_max_hsps"
                                   value={formData.primer_specificity_encoding_probes_blastn_search_parameters_max_hsps}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="min_alignment_length" className="form-label">Min Alignment Length:</label>
                            <input type="number" className="form-control" id="min_alignment_length"
                                   name="primer_specificity_encoding_probes_blastn_hit_parameters_min_alignment_length"
                                   value={formData.primer_specificity_encoding_probes_blastn_hit_parameters_min_alignment_length}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="check" className="form-label">Check Tm Parameters:</label>
                            <select className="form-select" id="check"
                                    name="primer_Tm_parameters_check"
                                    value={formData.primer_Tm_parameters_check}
                                    onChange={handleChange}>
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="strict" className="form-label">Strict Tm Parameters:</label>
                            <select className="form-select" id="strict"
                                    name="primer_Tm_parameters_strict"
                                    value={formData.primer_Tm_parameters_strict}
                                    onChange={handleChange}>
                                <option value="true">True</option>
                                <option value="false">False</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="c_seq" className="form-label">C Sequence:</label>
                            <input type="text" className="form-control" id="c_seq"
                                   name="primer_Tm_parameters_c_seq"
                                   value={formData.primer_Tm_parameters_c_seq || ""}
                                   onChange={handleChange}/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="shift" className="form-label">Shift:</label>
                            <input type="number" className="form-control" id="shift"
                                   name="primer_Tm_parameters_shift"
                                   value={formData.primer_Tm_parameters_shift}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="nn_table" className="form-label">NN Table:</label>
                            <input type="text" className="form-control" id="nn_table"
                                   name="primer_Tm_parameters_nn_table"
                                   value={formData.primer_Tm_parameters_nn_table}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="tmm_table" className="form-label">TMM Table:</label>
                            <input type="text" className="form-control" id="tmm_table"
                                   name="primer_Tm_parameters_tmm_table"
                                   value={formData.primer_Tm_parameters_tmm_table}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="imm_table" className="form-label">IMM Table:</label>
                            <input type="text" className="form-control" id="imm_table"
                                   name="primer_Tm_parameters_imm_table"
                                   value={formData.primer_Tm_parameters_imm_table}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="de_table" className="form-label">DE Table:</label>
                            <input type="text" className="form-control" id="de_table"
                                   name="primer_Tm_parameters_de_table"
                                   value={formData.primer_Tm_parameters_de_table}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="dnac1" className="form-label">DNA Concentration 1 (dnac1):</label>
                            <input type="number" className="form-control" id="dnac1"
                                   name="primer_Tm_parameters_dnac1"
                                   value={formData.primer_Tm_parameters_dnac1}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="dnac2" className="form-label">DNA Concentration 2 (dnac2):</label>
                            <input type="number" className="form-control" id="dnac2"
                                   name="primer_Tm_parameters_dnac2"
                                   value={formData.primer_Tm_parameters_dnac2}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="selfcomp" className="form-label">Self-Complementarity:</label>
                            <select className="form-select" id="selfcomp"
                                    name="primer_Tm_parameters_selfcomp"
                                    value={formData.primer_Tm_parameters_selfcomp}
                                    onChange={handleChange}>
                                <option value="false">False</option>
                                <option value="true">True</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="saltcorr" className="form-label">Salt Correction (saltcorr):</label>
                            <input type="number" className="form-control" id="saltcorr"
                                   name="primer_Tm_parameters_saltcorr"
                                   value={formData.primer_Tm_parameters_saltcorr}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="Na" className="form-label">Sodium Concentration (Na):</label>
                            <input type="number" className="form-control" id="Na"
                                   name="primer_Tm_parameters_Na"
                                   value={formData.primer_Tm_parameters_Na}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="K" className="form-label">Potassium Concentration (K):</label>
                            <input type="number" className="form-control" id="K"
                                   name="primer_Tm_parameters_K"
                                   value={formData.primer_Tm_parameters_K}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="Tris" className="form-label">Tris Concentration:</label>
                            <input type="number" className="form-control" id="Tris"
                                   name="primer_Tm_parameters_Tris"
                                   value={formData.primer_Tm_parameters_Tris}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="Mg" className="form-label">Magnesium Concentration (Mg):</label>
                            <input type="number" className="form-control" id="Mg"
                                   name="primer_Tm_parameters_Mg"
                                   value={formData.primer_Tm_parameters_Mg}
                                   onChange={handleChange} required/>
                        </div>
                        <div className="mb-3">
                            <label htmlFor="dNTPs" className="form-label">dNTPs Concentration:</label>
                            <input type="number" className="form-control" id="dNTPs"
                                   name="primer_Tm_parameters_dNTPs"
                                   value={formData.primer_Tm_parameters_dNTPs}
                                   onChange={handleChange} required/>
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
                    <h2 className="text-center mb-4">Merfish Probe Designer</h2>
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

                    <div className="d-flex justify-content-center mt-3">
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Running..." : "Submit"}
                        </button>
                    </div>

                </form>
                <div className="mt-4">
                    <p>Status: {status}</p>
                    <progress value={progress} max="100"></progress>
                    <p>{progress}%</p>
                </div>
            </div>
        </div>
    );
};

export default Merfish;