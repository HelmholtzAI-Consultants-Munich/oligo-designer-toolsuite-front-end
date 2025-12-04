import React, { useState } from "react";
import Navbar from "../modules/nav";
import { Collapse, OverlayTrigger, Popover } from "react-bootstrap";
import { ChevronDown, ChevronUp, InfoCircle } from "react-bootstrap-icons";
import merfish_form from "../forms/merfish_form";
import type { FastaForm, FileState } from "../components/types";
import { allFilesUploaded, handleSubmit } from "../components/helpers";
import RunLocallyInfoBox from "../modules/RunLocallyInfoBox";
import merfishImage from "../images/pipeline_merfish_probes.webp";
import TargetFile from "../components/targetFile";
import { NumberInput, NumberInputAlt } from "../components/numberInput";
import { TextInput, TextInputAlt } from "../components/textInput";
import { SelectInput, SelectInputAlt } from "../components/selectInput";
import FileSelection from "../components/fileSelection";
import FastaGeneration from "../components/fastaGeneration";
import { RunLinkModal } from "../components/modal/RunLinkModal";
import { InfoModal } from "../components/modal/InfoModal";
import { RunIdAlert } from "../components/alert/RunIdAlert";

const Merfish: React.FC = () => {
    const [fastaForms, setFastaForms] = useState<Array<FastaForm>>([]);
    const [fastaFormsReference, setFastaFormsReference] = useState<
        Array<FastaForm>
    >([]);
    const [fastaFormsReadout, setFastaFormsReadout] = useState<
        Array<FastaForm>
    >([]);
    const [fastaFormsPrimer, setFastaFormsPrimer] = useState<Array<FastaForm>>(
        []
    );
    const [expanded, setExpanded] = useState(false);

    const [showDeveloperSettings, setShowDeveloperSettings] = useState(false);
    const [formData, setFormData] = useState(merfish_form);

    const [files, setFiles] = useState<FileState>({
        file_regions_file: null,
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
        files_fasta_reference_database_readout_probe: [],
        files_fasta_reference_database_primer: [],
    });

    const toggleDeveloperSettings = () => {
        setShowDeveloperSettings(!showDeveloperSettings);
    };
    const [activeTab, setActiveTab] = useState("probe_sequences");
    const [activeTabDevSettings, setActiveTabDevSettings] =
        useState("specfblastn");

    const [runId, setRunId] = useState<string | null>(null);
    // TODO type aus status machen
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

    const renderTabContent = () => {
        switch (activeTab) {
            case "probe_sequences":
                return (
                    <div className="mb-4">
                        <div className="d-flex align-items-end gap-3 mb-3">
                            <TargetFile
                                setFormData={setFormData}
                                formData={formData}
                            />
                            <FileSelection
                                formData={formData}
                                id="file_regions"
                                setFiles={setFiles}
                                files={files}
                            />
                        </div>
                        <div className="d-flex align-items-end gap-3 mb-3">
                            <FastaGeneration
                                name="Probe Database"
                                id="files_fasta_target_probe_database"
                                setFastaForms={setFastaForms}
                                fastaForms={fastaForms}
                            />
                            <FileSelection
                                formData={formData}
                                id="files_fasta_target_probe_database"
                                setFiles={setFiles}
                                files={files}
                            />
                        </div>
                        <div className="d-flex align-items-end gap-3 mb-3">
                            <FastaGeneration
                                name="Probe Reference Database"
                                id="files_fasta_reference_database_target_probe"
                                setFastaForms={setFastaFormsReference}
                                fastaForms={fastaFormsReference}
                            />
                            <FileSelection
                                formData={formData}
                                id="files_fasta_reference_database_target_probe"
                                setFiles={setFiles}
                                files={files}
                            />
                        </div>
                        <div className="mb-3">
                            <NumberInput
                                label="Maximum Number of Sets"
                                id="top_n_sets"
                                formData={formData}
                                setFormData={setFormData}
                            />
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col">
                                <NumberInput
                                    label="Min Probe Length:"
                                    id="target_probe_length_min"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Max Probe Length:"
                                    id="target_probe_length_max"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Isoform Consensus (%):"
                                    id="target_probe_isoform_consensus"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col">
                                <NumberInput
                                    label="Min GC Content (%):"
                                    id="target_probe_GC_content_min"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Optimal GC Content (%):"
                                    id="target_probe_GC_content_opt"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Max GC Content (%):"
                                    id="target_probe_GC_content_max"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col">
                                <NumberInput
                                    label="Min Tm(°C):"
                                    id="target_probe_Tm_min"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Max Tm(°C):"
                                    id="target_probe_Tm_max"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Opt Tm(°C):"
                                    id="target_probe_Tm_opt"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>

                        <h6 className="pt-2">
                            Minimum number of nucleotides to consider it a
                            homopolymeric run per base{" "}
                        </h6>

                        <div className="row g-3 mb-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="A:"
                                    id="target_probe_homopolymeric_base_n"
                                    subId="A"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                            <div className="col">
                                <NumberInputAlt
                                    label="T:"
                                    id="target_probe_homopolymeric_base_n"
                                    subId="T"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                            <div className="col">
                                <NumberInputAlt
                                    label="C:"
                                    id="target_probe_homopolymeric_base_n"
                                    subId="C"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                            <div className="col">
                                <NumberInputAlt
                                    label="G:"
                                    id="target_probe_homopolymeric_base_n"
                                    subId="G"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>

                        <div className="mb-3">
                            <NumberInput
                                label="Probe Isoform Weight:"
                                id="target_probe_isoform_weight"
                                formData={formData}
                                setFormData={setFormData}
                            />
                        </div>

                        <div className="mb-3">
                            <NumberInput
                                label="GC Content Weight:"
                                id="target_probe_GC_weight"
                                formData={formData}
                                setFormData={setFormData}
                            />
                        </div>

                        <div className="mb-3">
                            <NumberInput
                                label="Tm Weight:"
                                id="target_probe_Tm_weight"
                                formData={formData}
                                setFormData={setFormData}
                            />
                        </div>

                        <div className="row g-3">
                            <div className="col">
                                <NumberInput
                                    label="Minimum Probe Set Size:"
                                    id="set_size_min"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Optimal Probe Set Size:"
                                    id="set_size_opt"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Distance Between Probes:"
                                    id="distance_between_target_probes"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Maximum Number of Sets:"
                                    id="n_sets"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                    </div>
                );

            case "readout":
                return (
                    <div className="mb-4">
                        <div className="d-flex align-items-end gap-3 mb-3">
                            <FastaGeneration
                                name="Probe Readout Database:"
                                id="files_fasta_reference_database_readout_probe"
                                setFastaForms={setFastaFormsReadout}
                                fastaForms={fastaFormsReadout}
                            />
                            <FileSelection
                                formData={formData}
                                id="files_fasta_reference_database_readout_probe"
                                setFiles={setFiles}
                                files={files}
                            />
                        </div>
                        <div className="mb-3">
                            <NumberInput
                                label="Length of readout probes:"
                                id="readout_probe_length"
                                formData={formData}
                                setFormData={setFormData}
                            />
                        </div>

                        <div className="row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="Probability of base A:"
                                    id="readout_probe_base_probabilities"
                                    subId="A"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Probability of base T:"
                                    id="readout_probe_base_probabilities"
                                    subId="T"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Probability of base C:"
                                    id="readout_probe_base_probabilities"
                                    subId="C"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Probability of base G:"
                                    id="readout_probe_base_probabilities"
                                    subId="G"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <NumberInput
                                    label="Minimum GC content:"
                                    id="readout_probe_GC_content_min"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Maximum GC content:"
                                    id="readout_probe_GC_content_max"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>

                        <div className="mb-3">
                            <NumberInputAlt
                                label="Minimum number of Nucleotides:"
                                id="readout_probe_homopolymeric_base_n"
                                subId="G"
                                formData={formData}
                                setFormData={setFormData}
                            />
                        </div>

                        <div className="mb-3">
                            <NumberInput
                                label="Total number of readout probes:"
                                id="readout_probe_set_size"
                                formData={formData}
                                setFormData={setFormData}
                            />
                        </div>

                        <div className="row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="Homogeneous Properties Weights (TmNN):"
                                    id="readout_probe_homogeneous_properties_weights"
                                    subId="TmNN"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Homogeneous Properties Weights (GC Content):"
                                    id="readout_probe_homogeneous_properties_weights"
                                    subId="GC_content"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <NumberInput
                                    label="Number of Bits:"
                                    id="n_bits"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Minimum Hamming Distance:"
                                    id="min_hamming_dist"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Hamming Weight:"
                                    id="hamming_weight"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <TextInput
                                    label="Channel IDs:"
                                    id="channels_ids"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                    </div>
                );

            case "primer_parameters":
                return (
                    <div>
                        <div className="mb-4">
                            <div className="d-flex align-items-end gap-3 mb-3">
                                <FastaGeneration
                                    name="Probe Primer Reference Database:"
                                    id="files_fasta_reference_database_primer"
                                    setFastaForms={setFastaFormsPrimer}
                                    fastaForms={fastaFormsPrimer}
                                />
                                <FileSelection
                                    formData={formData}
                                    id="files_fasta_reference_database_primer"
                                    setFiles={setFiles}
                                    files={files}
                                />
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <TextInput
                                        label="Reverse Primer Sequence:"
                                        id="reverse_primer_sequence"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInput
                                        label="Primer Length:"
                                        id="primer_length"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <NumberInputAlt
                                        label="Probability of Base A:"
                                        id="primer_base_probabilities"
                                        subId="A"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInputAlt
                                        label="Probability of Base T:"
                                        id="primer_base_probabilities"
                                        subId="T"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInputAlt
                                        label="Probability of Base C:"
                                        id="primer_base_probabilities"
                                        subId="C"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInputAlt
                                        label="Probability of Base G:"
                                        id="primer_base_probabilities"
                                        subId="G"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col">
                                    <NumberInput
                                        label="Min GC Content:"
                                        id="primer_GC_content_min"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInput
                                        label="Max GC Content:"
                                        id="primer_GC_content_max"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col">
                                    <NumberInput
                                        label="GC Clamp (GC Count):"
                                        id="primer_number_GC_GCclamp"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInput
                                        label="3' Base GC Clamp Count:"
                                        id="primer_number_three_prime_base_GCclamp"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col-md-3">
                                    <NumberInputAlt
                                        label="Homopolymeric A:"
                                        id="primer_homopolymeric_base_n"
                                        subId="A"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-3">
                                    <NumberInputAlt
                                        label="Homopolymeric T:"
                                        id="primer_homopolymeric_base_n"
                                        subId="T"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-3">
                                    <NumberInputAlt
                                        label="Homopolymeric C:"
                                        id="primer_homopolymeric_base_n"
                                        subId="C"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-3">
                                    <NumberInputAlt
                                        label="Homopolymeric G:"
                                        id="primer_homopolymeric_base_n"
                                        subId="G"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col">
                                    <NumberInput
                                        label="Max Self-Complementary Length:"
                                        id="primer_max_len_selfcomplement"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInput
                                        label="Max Complement Reverse Primer Length:"
                                        id="primer_max_len_complement_reverse_primer"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInput
                                        label="Min Primer Tm (°C):"
                                        id="primer_Tm_min"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInput
                                        label="Max Primer Tm (°C):"
                                        id="primer_Tm_max"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <NumberInput
                                    label="Secondary Structure Temperature (°C):"
                                    id="primer_T_secondary_structure"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInput
                                    label="Threshold Delta G:"
                                    id="primer_secondary_structures_threshold_deltaG"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };
    const renderTabContentDevSettings = () => {
        switch (activeTabDevSettings) {
            case "specfblastn":
                return (
                    <div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Percent Identity:"
                                    id="target_probe_specificity_blastn_search_parameters"
                                    subId="perc_identity"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <SelectInputAlt
                                    label="Strand:"
                                    id="target_probe_specificity_blastn_search_parameters"
                                    subId="strand"
                                    options={[
                                        { value: "minus", label: "Minus" },
                                        { value: "plus", label: "Plus" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Word Size:"
                                    id="target_probe_specificity_blastn_search_parameters"
                                    subId="word_size"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <SelectInputAlt
                                    label="Dust:"
                                    id="target_probe_specificity_blastn_search_parameters"
                                    subId="dust"
                                    options={[
                                        { value: "no", label: "No" },
                                        { value: "yes", label: "Yes" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <SelectInputAlt
                                    label="Soft Masking:"
                                    id="target_probe_specificity_blastn_search_parameters"
                                    subId="soft_masking"
                                    options={[
                                        { value: "false", label: "False" },
                                        { value: "true", label: "True" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Max Target Sequences:"
                                    id="target_probe_specificity_blastn_search_parameters"
                                    subId="max_target_seqs"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Max HSPs:"
                                    id="target_probe_specificity_blastn_search_parameters"
                                    subId="max_hsps"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Coverage: (Specificity_blastn_hit_parameter)"
                                    id="target_probe_cross_hybridization_blastn_hit_parameters"
                                    subId="min_alignment_length"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                    </div>
                );
            case "crossfilterblastn":
                return (
                    <div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Percent Identity:"
                                    id="target_probe_cross_hybridization_blastn_search_parameters"
                                    subId="perc_identity"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <SelectInputAlt
                                    label="Strand:"
                                    id="target_probe_cross_hybridization_blastn_search_parameters"
                                    subId="strand"
                                    options={[
                                        { value: "minus", label: "Minus" },
                                        { value: "plus", label: "Plus" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Word Size:"
                                    id="target_probe_cross_hybridization_blastn_search_parameters"
                                    subId="word_size"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <SelectInputAlt
                                    label="Dust:"
                                    id="target_probe_cross_hybridization_blastn_search_parameters"
                                    subId="dust"
                                    options={[
                                        { value: "no", label: "No" },
                                        { value: "yes", label: "Yes" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <SelectInputAlt
                                    label="Soft Masking:"
                                    id="target_probe_cross_hybridization_blastn_search_parameters"
                                    subId="soft_masking"
                                    options={[
                                        { value: "false", label: "False" },
                                        { value: "true", label: "True" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Max Target Sequences:"
                                    id="target_probe_cross_hybridization_blastn_search_parameters"
                                    subId="max_target_seqs"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInputAlt
                                    label="Coverage:"
                                    id="target_probe_cross_hybridization_blastn_hit_parameters"
                                    subId="min_alignment_length"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                    </div>
                );
            case "oligosetselection":
                return (
                    <div>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <NumberInput
                                    label="Max Graph Size:"
                                    id="max_graph_size"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInput
                                    label="Number of Attempts:"
                                    id="n_attempts"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <SelectInput
                                    label="Heuristic:"
                                    id="heuristic"
                                    options={[
                                        { value: "true", label: "True" },
                                        { value: "false", label: "False" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col-md-6">
                                <NumberInput
                                    label="Heuristics number of Attempts:"
                                    id="heuristic_n_attempts"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                    </div>
                );
            case "meltingtemp":
                return (
                    <div>
                        <div className="mb-4">
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <TextInputAlt
                                        label="Nearest Neighbor Table:"
                                        id="target_probe_Tm_parameters"
                                        subId="nn_table"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <TextInputAlt
                                        label="TMM Table:"
                                        id="target_probe_Tm_parameters"
                                        subId="tmm_table"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <TextInputAlt
                                        label="IMM Table:"
                                        id="target_probe_Tm_parameters"
                                        subId="imm_table"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <TextInputAlt
                                        label="DE Table:"
                                        id="target_probe_Tm_parameters"
                                        subId="de_table"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <NumberInputAlt
                                        label="DNA Concentration 1 (nM):"
                                        id="target_probe_Tm_parameters"
                                        subId="dnac1"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <NumberInputAlt
                                        label="DNA Concentration 2 (nM):"
                                        id="target_probe_Tm_parameters"
                                        subId="dnac2"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <NumberInputAlt
                                        label="Salt Correction:"
                                        id="target_probe_Tm_parameters"
                                        subId="saltcorr"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <NumberInputAlt
                                        label="Na Concentration (mM):"
                                        id="target_probe_Tm_parameters"
                                        subId="Na"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <NumberInputAlt
                                        label="K Concentration (mM):"
                                        id="target_probe_Tm_parameters"
                                        subId="K"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <NumberInputAlt
                                        label="Tris Concentration (mM):"
                                        id="target_probe_Tm_parameters"
                                        subId="Tris"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <NumberInputAlt
                                        label="Mg Concentration (mM):"
                                        id="target_probe_Tm_parameters"
                                        subId="Mg"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col-md-6">
                                    <NumberInputAlt
                                        label="dNTPs Concentration (mM):"
                                        id="target_probe_Tm_parameters"
                                        subId="dNTPs"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
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
                                    <NumberInput
                                        label="Initial Number of Sequences:"
                                        id="readout_probe_initial_num_sequences"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInputAlt
                                        label="Percentage Identity:"
                                        id="readout_probe_specificity_blastn_search_parameters"
                                        subId="perc_identity"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <SelectInputAlt
                                        label="Strand:"
                                        id="readout_probe_specificity_blastn_search_parameters"
                                        subId="strand"
                                        options={[
                                            { value: "minus", label: "Minus" },
                                            { value: "plus", label: "Plus" },
                                        ]}
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInputAlt
                                        label="Word Size:"
                                        id="readout_probe_specificity_blastn_search_parameters"
                                        subId="word_size"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col">
                                    <SelectInputAlt
                                        label="Dust:"
                                        id="readout_probe_specificity_blastn_search_parameters"
                                        subId="dust"
                                        options={[
                                            { value: "no", label: "No" },
                                            { value: "yes", label: "Yes" },
                                        ]}
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <SelectInputAlt
                                        label="Soft Masking:"
                                        id="readout_probe_specificity_blastn_search_parameters"
                                        subId="soft_masking"
                                        options={[
                                            { value: "false", label: "False" },
                                            { value: "true", label: "True" },
                                        ]}
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>

                            <div className="row g-3">
                                <div className="col">
                                    <NumberInputAlt
                                        label="Max Target Sequences:"
                                        id="readout_probe_specificity_blastn_search_parameters"
                                        subId="max_target_seqs"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>

                                <div className="col">
                                    <NumberInputAlt
                                        label="Max HSPs:"
                                        id="readout_probe_specificity_blastn_search_parameters"
                                        subId="max_hsps"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
                                </div>
                            </div>
                            <div>
                                <h4>Readout Probe BLASTn Hit Parameters</h4>

                                <div className="mb-3">
                                    <NumberInputAlt
                                        label="Min Alignment Length:"
                                        id="readout_probe_specificity_blastn_hit_parameters"
                                        subId="min_alignment_length"
                                        formData={formData}
                                        setFormData={setFormData}
                                    />
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
                                <NumberInput
                                    label="Initial Number of Sequences:"
                                    id="primer_initial_num_sequences"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Percentage Identity:"
                                    id="primer_specificity_refrence_blastn_search_parameters"
                                    subId="perc_identity"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <SelectInputAlt
                                    label="Strand:"
                                    id="primer_specificity_refrence_blastn_search_parameters"
                                    subId="strand"
                                    options={[
                                        { value: "minus", label: "Minus" },
                                        { value: "plus", label: "Plus" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="Word Size:"
                                    id="primer_specificity_refrence_blastn_search_parameters"
                                    subId="word_size"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <SelectInputAlt
                                    label="Dust:"
                                    id="primer_specificity_refrence_blastn_search_parameters"
                                    subId="dust"
                                    options={[
                                        { value: "no", label: "No" },
                                        { value: "yes", label: "Yes" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                            <div className="col">
                                <SelectInputAlt
                                    label="Soft Masking:"
                                    id="primer_specificity_refrence_blastn_search_parameters"
                                    subId="soft_masking"
                                    options={[
                                        { value: "false", label: "False" },
                                        { value: "true", label: "True" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="Max Target Sequences:"
                                    id="primer_specificity_refrence_blastn_search_parameters"
                                    subId="max_target_seqs"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Max HSPs:"
                                    id="primer_specificity_refrence_blastn_search_parameters"
                                    subId="max_hsps"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Min Alignment Length:"
                                    id="primer_specificity_refrence_blastn_hit_parameters"
                                    subId="min_alignment_length"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="Percentage Identity:"
                                    id="primer_specificity_encoding_probes_blastn_search_parameters"
                                    subId="perc_identity"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <SelectInputAlt
                                    label="Strand:"
                                    id="primer_specificity_encoding_probes_blastn_search_parameters"
                                    subId="strand"
                                    options={[
                                        { value: "minus", label: "Minus" },
                                        { value: "plus", label: "Plus" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Word Size:"
                                    id="primer_specificity_encoding_probes_blastn_search_parameters"
                                    subId="word_size"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <SelectInputAlt
                                    label="Dust:"
                                    id="primer_specificity_encoding_probes_blastn_search_parameters"
                                    subId="dust"
                                    options={[
                                        { value: "no", label: "No" },
                                        { value: "yes", label: "Yes" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <SelectInputAlt
                                    label="Soft Masking:"
                                    id="primer_specificity_encoding_probes_blastn_search_parameters"
                                    subId="soft_masking"
                                    options={[
                                        { value: "false", label: "False" },
                                        { value: "true", label: "True" },
                                    ]}
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Max Target Sequences:"
                                    id="primer_specificity_encoding_probes_blastn_search_parameters"
                                    subId="max_target_seqs"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>

                        <div className="row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="Max HSPs:"
                                    id="primer_specificity_encoding_probes_blastn_search_parameters"
                                    subId="max_hsps"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Min Alignment Length:"
                                    id="primer_specificity_encoding_probes_blastn_hit_parameters"
                                    subId="min_alignment_length"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <TextInputAlt
                                    label="NN Table:"
                                    id="primer_Tm_parameters"
                                    subId="nn_table"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <TextInputAlt
                                    label="TMM Table:"
                                    id="primer_Tm_parameters"
                                    subId="tmm_table"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <TextInputAlt
                                    label="IMM Table:"
                                    id="primer_Tm_parameters"
                                    subId="imm_table"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <TextInputAlt
                                    label="DE Table:"
                                    id="primer_Tm_parameters"
                                    subId="de_table"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="DNA Concentration 1 (dnac1):"
                                    id="primer_Tm_parameters"
                                    subId="dnac1"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="DNA Concentration 2 (dnac1):"
                                    id="primer_Tm_parameters"
                                    subId="dnac2"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>

                        <div className=" row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="Salt Correction (saltcorr):"
                                    id="primer_Tm_parameters"
                                    subId="saltcorr"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Sodium Concentration (Na):"
                                    id="primer_Tm_parameters"
                                    subId="Na"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Potassium Concentration (K):"
                                    id="primer_Tm_parameters"
                                    subId="K"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                        <div className="row g-3">
                            <div className="col">
                                <NumberInputAlt
                                    label="Tris Concentration:"
                                    id="primer_Tm_parameters"
                                    subId="Tris"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="Magnesium Concentration (Mg):"
                                    id="primer_Tm_parameters"
                                    subId="Mg"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>

                            <div className="col">
                                <NumberInputAlt
                                    label="dNTPs Concentration:"
                                    id="primer_Tm_parameters"
                                    subId="dNTPs"
                                    formData={formData}
                                    setFormData={setFormData}
                                />
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
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
                <form
                    onSubmit={(e) =>
                        handleSubmit(
                            e,
                            runStatus,
                            setRunStatus,
                            setRunId,
                            fastaForms,
                            setModal,
                            files,
                            formData,
                            fastaFormsPrimer,
                            fastaFormsReadout,
                            fastaFormsReference,
                            setIdCopySuccess
                        )
                    }
                    id="merfishForm"
                >
                    <div className="mb-3">
                        <div className="d-flex justify-content-center align-items-center">
                            <h2 className="mb-0">Merfish Probe Designer</h2>

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
                                    MERFISH (Multiplexed Error-Robust
                                    Fluorescence In Situ Hybridization) probes
                                    are short DNA oligonucleotides designed to
                                    label specific RNA molecules in cells. They
                                    incorporate unique “barcodes” that enable
                                    simultaneous imaging and identification of
                                    hundreds of different transcripts, all
                                    within a single sample. This highly
                                    multiplexed approach provides detailed,
                                    spatially resolved gene expression
                                    information at the single-cell level. A
                                    MERFISH encoding probe is a fluorescent
                                    probe that contains a 30-nt targeting
                                    sequence which directs their binding to the
                                    specific RNA, two 20-nt barcode sequences,
                                    which are read out by fluorescent secondary
                                    readout probes, single A-nucleotide spacers
                                    between readout and gene-specific regions,
                                    and two 20-nt PCR primer binding sites. The
                                    specific readout sequences contained by an
                                    encoding probe are determined by the binary
                                    barcode assigned to that RNA.
                                </p>
                                <img
                                    src={merfishImage}
                                    alt="MERFISH Pipeline"
                                    className="img-fluid my-3"
                                />
                            </div>
                        </Collapse>
                    </div>
                    <ul className="nav nav-tabs">
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link ${
                                    activeTab === "probe_sequences"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() => {
                                    setActiveTab("probe_sequences");
                                    setActiveTabDevSettings("specfblastn");
                                }}
                            >
                                Target Probe Parameters
                            </button>
                        </li>

                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link ${
                                    activeTab === "readout" ? "active" : ""
                                }`}
                                onClick={() => {
                                    setActiveTabDevSettings("readout");
                                    setActiveTab("readout");
                                }}
                            >
                                Readout Probe Parameters
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                type="button"
                                className={`nav-link ${
                                    activeTab === "primer_parameters"
                                        ? "active"
                                        : ""
                                }`}
                                onClick={() => {
                                    setActiveTabDevSettings("primerpro");
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
                                                    className={`nav-link ${
                                                        activeTabDevSettings ===
                                                        "specfblastn"
                                                            ? "active"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        setActiveTabDevSettings(
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
                                                    className={`nav-link ${
                                                        activeTabDevSettings ===
                                                        "crossfilterblastn"
                                                            ? "active"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        setActiveTabDevSettings(
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
                                                    className={`nav-link ${
                                                        activeTabDevSettings ===
                                                        "oligosetselection"
                                                            ? "active"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        setActiveTabDevSettings(
                                                            "oligosetselection"
                                                        )
                                                    }
                                                >
                                                    Oligo Set Selection
                                                    Parameters
                                                </button>
                                            </li>
                                            <li className="nav-item">
                                                <button
                                                    type="button"
                                                    className={`nav-link ${
                                                        activeTabDevSettings ===
                                                        "meltingtemp"
                                                            ? "active"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        setActiveTabDevSettings(
                                                            "meltingtemp"
                                                        )
                                                    }
                                                >
                                                    Parameters for Melting
                                                    Temperature
                                                </button>
                                            </li>
                                        </>
                                    )}
                                    {activeTab === "readout" && (
                                        <>
                                            <li className="nav-item">
                                                <button
                                                    type="button"
                                                    className={`nav-link ${
                                                        activeTabDevSettings ===
                                                        "readout"
                                                            ? "active"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        setActiveTabDevSettings(
                                                            "readout"
                                                        )
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
                                                    className={`nav-link ${
                                                        activeTabDevSettings ===
                                                        "primerpro"
                                                            ? "active"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        setActiveTabDevSettings(
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
                                    {renderTabContentDevSettings()}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="container my-4">
                        {!allFilesUploaded(
                            files,
                            formData,
                            fastaForms,
                            fastaFormsReference,
                            fastaFormsReadout,
                            fastaFormsPrimer
                        ) && (
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
                                type="submit"
                                className="btn btn-primary"
                                disabled={
                                    runStatus === "submitting" ||
                                    runStatus === "running" ||
                                    !allFilesUploaded(
                                        files,
                                        formData,
                                        fastaForms,
                                        fastaFormsReference,
                                        fastaFormsReadout,
                                        fastaFormsPrimer
                                    )
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

export default Merfish;
