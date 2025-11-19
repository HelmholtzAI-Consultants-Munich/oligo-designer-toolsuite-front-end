import React, { useState } from "react";
import Navbar from "../modules/nav";
import { Collapse, OverlayTrigger, Popover } from "react-bootstrap";
import { ChevronDown, ChevronUp, InfoCircle } from "react-bootstrap-icons";
import merfish_form from "../forms/merfish_form";
import { FastaForm, FileState } from "../components/types";
import { allFilesUploaded, handleSubmit } from "../components/helpers";
import RunLocallyInfoBox from "../modules/RunLocallyInfoBox";
import merfishImage from "../images/pipeline_merfish_probes.webp";
import TargetFile from "../components/targetFile";
import {NumberInput, NumberInputAlt} from "../components/numberInput";
import { TextInput,TextInputAlt } from "../components/textInput";
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
  const [fastaFormsReadout, setFastaFormsReadout] = useState<Array<FastaForm>>(
    []
  );
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
  const [runStatus, setRunStatus] = useState<"idle" | "submitting" | "running">(
    "idle"
  );
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
              <TargetFile setFormData={setFormData} formData={formData} />
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
                fieldID="top_n_sets"
                formData={formData}
              />
            </div>

            <div className="row g-3 mb-3">
              <div className="col">
                <NumberInput
                    label="Min Probe Length:"
                    fieldID="target_probe_length_min"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInput
                        label="Max Probe Length:"
                        fieldID="target_probe_length_max"
                        formData={formData}
                />
              </div>

              <div className="col">
                <NumberInput
                        label="Isoform Consensus (%):"
                        fieldID="target_probe_isoform_consensus"
                        formData={formData}
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col">
                <NumberInput
                        label="Min GC Content (%):"
                        fieldID="target_probe_GC_content_min"
                        formData={formData}
                />
              </div>

              <div className="col">
              <NumberInput
                        label="Optimal GC Content (%):"
                        fieldID="target_probe_GC_content_opt"
                        formData={formData}
                />
              </div>

              <div className="col">
                <NumberInput
                        label="Max GC Content (%):"
                        fieldID="target_probe_GC_content_max"
                        formData={formData}
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col">
                <NumberInput
                        label="Min Tm(°C):"
                        fieldID="target_probe_Tm_min"
                        formData={formData}
                />
              </div>

              <div className="col">
                <NumberInput
                        label="Max Tm(°C):"
                        fieldID="target_probe_Tm_max"
                        formData={formData}
                />
              </div>

              <div className="col">
                <NumberInput
                        label="Opt Tm(°C):"
                        fieldID="target_probe_Tm_opt"
                        formData={formData}
                />
              </div>
            </div>

            <h6 className="pt-2">
              Minimum number of nucleotides to consider it a homopolymeric run
              per base{" "}
            </h6>

            <div className="row g-3 mb-3">
              <div className="col">
              <NumberInputAlt
                        label="A:"
                        fieldID="target_probe_homopolymeric_base_n"
                        subID= "A"
                        formData={formData}
                />
              </div>
              <div className="col">
              <NumberInputAlt
                        label="T:"
                        fieldID="target_probe_homopolymeric_base_n"
                        subID= "T"
                        formData={formData}
                />
              </div>
              <div className="col">
              <NumberInputAlt
                        label="C:"
                        fieldID="target_probe_homopolymeric_base_n"
                        subID= "C"
                        formData={formData}
                />
              </div>
              <div className="col">
              <NumberInputAlt
                        label="G:"
                        fieldID="target_probe_homopolymeric_base_n"
                        subID= "G"
                        formData={formData}
                />
              </div>
            </div>

            <div className="mb-3">
              <NumberInput
                label="Probe Isoform Weight:"
                fieldID="target_probe_isoform_weight"
                formData={formData}
              />
            </div>

            <div className="mb-3">
            <NumberInput
                label="GC Content Weight:"
                fieldID="target_probe_GC_weight"
                formData={formData}
              />
            </div>

            <div className="mb-3">
                <NumberInput
                    label="Tm Weight:"
                    fieldID="target_probe_Tm_weight"
                    formData={formData}
                />
            </div>

            <div className="row g-3">
              <div className="col">
                <NumberInput
                    label="Minimum Probe Set Size:"
                    fieldID="set_size_min"
                    formData={formData}
                />
              </div>
              
              <div className="col">
                <NumberInput
                    label="Optimal Probe Set Size:"
                    fieldID="set_size_opt"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInput
                    label="Distance Between Probes:"
                    fieldID="distance_between_target_probes"
                    formData={formData}
                />
              </div>
              
              <div className="col">
              <NumberInput
                    label="Maximum Number of Sets:"
                    fieldID="n_sets"
                    formData={formData}
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
                    fieldID="readout_probe_length"
                    formData={formData}
                />
            </div>

            <div className="row g-3">
              <div className="col">
                <NumberInputAlt
                    label="Probability of base A:"
                    fieldID="readout_probe_base_probabilities"
                    subID= "A"
                    formData={formData}
                />
              </div>

              <div className="col">
              <NumberInputAlt
                    label="Probability of base T:"
                    fieldID="readout_probe_base_probabilities"
                    subID= "T"
                    formData={formData}
                />
              </div>

              <div className="col">
              <NumberInputAlt
                    label="Probability of base C:"
                    fieldID="readout_probe_base_probabilities"
                    subID= "C"
                    formData={formData}
                />
              </div>

              <div className="col">
              <NumberInputAlt
                    label="Probability of base G:"
                    fieldID="readout_probe_base_probabilities"
                    subID= "G"
                    formData={formData}
                />
              </div>

            </div>
            <div className="row g-3">
              <div className="col">
                <NumberInput
                    label="Minimum GC content:"
                    fieldID="readout_probe_GC_content_min"
                    formData={formData}
                />
              </div>

              <div className="col">
              <NumberInput
                    label="Maximum GC content:"
                    fieldID="readout_probe_GC_content_max"
                    formData={formData}
                />
              </div>
            </div>

            <div className="mb-3">
            <NumberInputAlt
                    label="Minimum number of Nucleotides:"
                    fieldID="readout_probe_homopolymeric_base_n"
                    subID= "G"
                    formData={formData}
                />
            </div>

            <div className="mb-3">
                <NumberInput
                    label="Total number of readout probes:"
                    fieldID="readout_probe_set_size"
                    formData={formData}
                />
            </div>

            <div className="row g-3">
              <div className="col">
                <NumberInputAlt
                    label="Homogeneous Properties Weights (TmNN):"
                    fieldID="readout_probe_homogeneous_properties_weights"
                    subID= "TmNN"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="Homogeneous Properties Weights (GC Content):"
                    fieldID="readout_probe_homogeneous_properties_weights"
                    subID= "GC_content"
                    formData={formData}
                />
              </div>

            </div>
            <div className="row g-3">
              <div className="col">
                <NumberInput
                    label="Number of Bits:"
                    fieldID="n_bits"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInput
                    label="Minimum Hamming Distance:"
                    fieldID="min_hamming_dist"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInput
                    label="Hamming Weight:"
                    fieldID="hamming_weight"
                    formData={formData}
                />
              </div>

              <div className="col">
                <TextInput
                    label="Channel IDs:"
                    fieldID="channels_ids"
                    formData={formData}
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
                      fieldID="reverse_primer_sequence"
                      formData={formData}
                  />
                </div>

                <div className="col">
                  <NumberInput
                    label="Primer Length:"
                    fieldID="primer_length"
                    formData={formData}
                   />
                </div>

              </div>
              <div className="row g-3">
                <div className="col">
                  <NumberInputAlt
                      label="Probability of Base A:"
                      fieldID="primer_base_probabilities"
                      subID= "A"
                      formData={formData}
                  />
                </div>

                <div className="col">
                  <NumberInputAlt
                      label="Probability of Base T:"
                      fieldID="primer_base_probabilities"
                      subID= "T"
                      formData={formData}
                  />
                </div>

                <div className="col">
                  <NumberInputAlt
                      label="Probability of Base C:"
                      fieldID="primer_base_probabilities"
                      subID= "C"
                      formData={formData}
                  />
                </div>

                <div className="col">
                  <NumberInputAlt
                      label="Probability of Base G:"
                      fieldID="primer_base_probabilities"
                      subID= "G"
                      formData={formData}
                  />
                </div>
              </div>

              <div className="row g-3">
                <div className="col">
                <NumberInput
                    label="Min GC Content:"
                    fieldID="primer_GC_content_min"
                    formData={formData}
                />
                </div>


                <div className="col">
                <NumberInput
                    label="Max GC Content:"
                    fieldID="primer_GC_content_max"
                    formData={formData}
                /> 
                </div>
              </div>

              <div className="row g-3">
                <div className="col">
                  <NumberInput
                      label="GC Clamp (GC Count):"
                      fieldID="primer_number_GC_GCclamp"
                      formData={formData}
                  /> 
                </div>

                <div className="col">
                  <NumberInput
                      label="3' Base GC Clamp Count:"
                      fieldID="primer_number_three_prime_base_GCclamp"
                      formData={formData}
                  /> 
                </div>

              </div>

              <div className="row g-3">
                <div className="col-md-3">
                  <NumberInputAlt
                      label="Homopolymeric A:"
                      fieldID="primer_homopolymeric_base_n"
                      subID= "A"
                      formData={formData}
                  />
                </div>

                <div className="col-md-3">
                  <NumberInputAlt
                      label="Homopolymeric T:"
                      fieldID="primer_homopolymeric_base_n"
                      subID= "T"
                      formData={formData}
                  />
                </div>

                <div className="col-md-3">
                  <NumberInputAlt
                      label="Homopolymeric C:"
                      fieldID="primer_homopolymeric_base_n"
                      subID= "C"
                      formData={formData}
                  />
                </div>

                <div className="col-md-3">
                  <NumberInputAlt
                      label="Homopolymeric G:"
                      fieldID="primer_homopolymeric_base_n"
                      subID= "G"
                      formData={formData}
                  />
                </div>

              </div>

              <div className="row g-3">
                <div className="col">
                  <NumberInput
                      label="Max Self-Complementary Length:"
                      fieldID="primer_max_len_selfcomplement"
                      formData={formData}
                  />
                </div>

                <div className="col">
                  <NumberInput
                      label="Max Complement Reverse Primer Length:"
                      fieldID="primer_max_len_complement_reverse_primer"
                      formData={formData}
                  /> 
                </div>

                <div className="col">
                  <NumberInput
                      label="Min Primer Tm (°C):"
                      fieldID="primer_Tm_min"
                      formData={formData}
                  /> 
                </div>

                <div className="col">
                  <NumberInput
                      label="Max Primer Tm (°C):"
                      fieldID="primer_Tm_max"
                      formData={formData}
                  />
                </div>

              </div>
            </div>
            <div className="row g-3">
              <div className="col">
                <NumberInput
                    label="Secondary Structure Temperature (°C):"
                    fieldID="primer_T_secondary_structure"
                    formData={formData}
                /> 
              </div>

              <div className="col">
                <NumberInput
                    label="Threshold Delta G:"
                    fieldID="primer_secondary_structures_threshold_deltaG"
                    formData={formData}
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
                    fieldID="target_probe_specificity_blastn_search_parameters"
                    subID= "perc_identity"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                <TextInputAlt
                    label="Strand"
                    fieldID="target_probe_specificity_blastn_search_parameters"
                    subID= "strand"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                <NumberInputAlt
                    label="Word Size:"
                    fieldID="target_probe_specificity_blastn_search_parameters"
                    subID= "word_size"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                <TextInputAlt
                    label="Dust"
                    fieldID="target_probe_specificity_blastn_search_parameters"
                    subID= "dust"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                <TextInputAlt
                    label="Soft Masking:"
                    fieldID="target_probe_specificity_blastn_search_parameters"
                    subID= "soft_masking"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                <NumberInputAlt
                    label="Max Target Sequences:"
                    fieldID="target_probe_specificity_blastn_search_parameters"
                    subID= "max_target_seqs"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                <NumberInputAlt
                    label="Max HSPs:"
                    fieldID="target_probe_specificity_blastn_search_parameters"
                    subID= "max_hsps"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                <NumberInputAlt
                    label="Coverage: (Specificity_blastn_hit_parameter)"
                    fieldID="target_probe_cross_hybridization_blastn_hit_parameters"
                    subID= "min_alignment_length"
                    formData={formData}
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
                    fieldID="target_probe_cross_hybridization_blastn_search_parameters"
                    subID= "perc_identity"
                    formData={formData}
                /> 
              </div>

              <div className="col-md-6">
                <TextInputAlt
                    label="Strand:"
                    fieldID="target_probe_cross_hybridization_blastn_search_parameters"
                    subID= "strand"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                 <NumberInputAlt
                    label="Word Size:"
                    fieldID="target_probe_cross_hybridization_blastn_search_parameters"
                    subID= "word_size"
                    formData={formData}
                /> 
              </div>

              <div className="col-md-6">
              <TextInputAlt
                label="Dust:"
                fieldID="target_probe_cross_hybridization_blastn_search_parameters"
                subID= "dust"
                formData={formData}
                />
              </div>

              <div className="col-md-6">
                <TextInputAlt
                    label="Soft Masking:"
                    fieldID="target_probe_cross_hybridization_blastn_search_parameters"
                    subID= "soft_masking"
                    formData={formData}
                />
              </div>

              <div className="col-md-6">
                <NumberInputAlt
                    label="Max Target Sequences:"
                    fieldID="target_probe_cross_hybridization_blastn_search_parameters"
                    subID= "max_target_seqs"
                    formData={formData}
                /> 
              </div>

              <div className="col-md-6">
                <NumberInputAlt
                    label="Coverage:"
                    fieldID="target_probe_cross_hybridization_blastn_hit_parameters"
                    subID= "min_alignment_length"
                    formData={formData}
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
                    fieldID="max_graph_size"
                    formData={formData}
                /> 
              </div>

              <div className="col-md-6">
                <NumberInput
                    label="Number of Attempts:"
                    fieldID="n_attempts"
                    formData={formData}
                /> 
              </div>

              <div className="col-md-6">
                <label htmlFor="heuristic" className="form-label">
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
                <NumberInput
                    label="Heuristics number of Attempts:"
                    fieldID="heuristic_n_attempts"
                    formData={formData}
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
                      fieldID="target_probe_Tm_parameters"
                      subID= "nn_table"
                      formData={formData}
                  />
                </div>

                <div className="col-md-6">
                  <TextInputAlt
                      label="TMM Table:"
                      fieldID="target_probe_Tm_parameters"
                      subID= "tmm_table"
                      formData={formData}
                  />
                </div>

                <div className="col-md-6">
                  <TextInputAlt
                      label="IMM Table:"
                      fieldID="target_probe_Tm_parameters"
                      subID= "imm_table"
                      formData={formData}
                  />
                </div>

                <div className="col-md-6">
                  <TextInputAlt
                      label="DE Table:"
                      fieldID="target_probe_Tm_parameters"
                      subID= "de_table"
                      formData={formData}
                  />
                </div>

                <div className="col-md-6">
                   <NumberInputAlt
                      label="DNA Concentration 1 (nM):"
                      fieldID="target_probe_Tm_parameters"
                      subID= "dnac1"
                      formData={formData}
                    /> 
                </div>

                <div className="col-md-6">
                   <NumberInputAlt
                      label="DNA Concentration 2 (nM):"
                      fieldID="target_probe_Tm_parameters"
                      subID= "dnac2"
                      formData={formData}
                    />
                </div>

                <div className="col-md-6">
                   <NumberInputAlt
                      label="Salt Correction:"
                      fieldID="target_probe_Tm_parameters"
                      subID= "saltcorr"
                      formData={formData}
                  /> 
                </div>

                <div className="col-md-6">
                   <NumberInputAlt
                      label="Na Concentration (mM):"
                      fieldID="target_probe_Tm_parameters"
                      subID= "Na"
                      formData={formData}
                  /> 
                </div>

                <div className="col-md-6">
                  <NumberInputAlt
                      label="K Concentration (mM):"
                      fieldID="target_probe_Tm_parameters"
                      subID= "K"
                      formData={formData}
                  />
                </div>

                <div className="col-md-6">
                  <NumberInputAlt
                      label="Tris Concentration (mM):"
                      fieldID="target_probe_Tm_parameters"
                      subID= "Tris"
                      formData={formData}
                  />
                </div>

                <div className="col-md-6">
                   <NumberInputAlt
                      label="Mg Concentration (mM):"
                      fieldID="target_probe_Tm_parameters"
                      subID= "Mg"
                      formData={formData}
                  />
                </div>

                <div className="col-md-6">
                   <NumberInputAlt
                      label="dNTPs Concentration (mM):"
                      fieldID="target_probe_Tm_parameters"
                      subID= "dNTPs"
                      formData={formData}
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
                      fieldID="readout_probe_initial_num_sequences"
                      formData={formData}
                  /> 
                </div>

                <div className="col">
                  <NumberInputAlt
                      label="Percentage Identity:"
                      fieldID="readout_probe_specificity_blastn_search_parameters"
                      subID= "perc_identity"
                      formData={formData}
                  /> 
                </div>

              </div>
              <div className="row g-3">
                <div className="col">
                  <label htmlFor="strand" className="form-label">
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
                  <NumberInputAlt
                      label="Word Size:"
                      fieldID="readout_probe_specificity_blastn_search_parameters"
                      subID= "word_size"
                      formData={formData}
                  />
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
                  <label htmlFor="soft_masking" className="form-label">
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
                                .soft_masking.comment
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
                  <NumberInputAlt
                      label="Max Target Sequences:"
                      fieldID="readout_probe_specificity_blastn_search_parameters"
                      subID= "max_target_seqs"
                      formData={formData}
                  />
                </div>

                <div className="col">
                  <NumberInputAlt
                      label="Max HSPs:"
                      fieldID="readout_probe_specificity_blastn_search_parameters"
                      subID= "max_hsps"
                      formData={formData}
                  />
                </div>

              </div>
              <div>
                <h4>Readout Probe BLASTn Hit Parameters</h4>

                <div className="mb-3">
                   <NumberInputAlt
                      label="Min Alignment Length:"
                      fieldID="readout_probe_specificity_blastn_hit_parameters"
                      subID= "min_alignment_length"
                      formData={formData}
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
                    fieldID="primer_initial_num_sequences"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="Percentage Identity:"
                    fieldID="primer_specificity_refrence_blastn_search_parameters"
                    subID= "perc_identity"
                    formData={formData}
                />
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
                <NumberInputAlt
                    label="Word Size:"
                    fieldID="primer_specificity_refrence_blastn_search_parameters"
                    subID= "word_size"
                    formData={formData}
                />
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
                <label htmlFor="soft_masking" className="form-label">
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
                        <Popover.Header as="h3">Soft Masking</Popover.Header>
                        <Popover.Body>
                          {
                            formData
                              .primer_specificity_refrence_blastn_search_parameters
                              .soft_masking.comment
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
                <NumberInputAlt
                    label="Max Target Sequences:"
                    fieldID="primer_specificity_refrence_blastn_search_parameters"
                    subID= "max_target_seqs"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="Max HSPs:"
                    fieldID="primer_specificity_refrence_blastn_search_parameters"
                    subID= "max_hsps"
                    formData={formData}
                /> 
              </div>

              <div className="col">
                <NumberInputAlt
                    label="Min Alignment Length:"
                    fieldID="primer_specificity_refrence_blastn_hit_parameters"
                    subID= "min_alignment_length"
                    formData={formData}
                />
              </div>

            </div>
            <div className="row g-3">
              <div className="col">
                <NumberInputAlt
                    label="Percentage Identity:"
                    fieldID="primer_specificity_encoding_probes_blastn_search_parameters"
                    subID= "perc_identity"
                    formData={formData}
                />
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
                <NumberInputAlt
                    label="Word Size::"
                    fieldID="primer_specificity_encoding_probes_blastn_search_parameters"
                    subID= "word_size"
                    formData={formData}
                /> 
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
                <label htmlFor="soft_masking" className="form-label">
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
                              .soft_masking.comment
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
                <NumberInputAlt
                    label="Max Target Sequences:"
                    fieldID="primer_specificity_encoding_probes_blastn_search_parameters"
                    subID= "max_target_seqs"
                    formData={formData}
                />
              </div>
            </div>

            <div className="row g-3">
              <div className="col">
                <NumberInputAlt
                    label="Max HSPs:"
                    fieldID="primer_specificity_encoding_probes_blastn_search_parameters"
                    subID= "max_hsps"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="Min Alignment Length:"
                    fieldID="primer_specificity_encoding_probes_blastn_hit_parameters"
                    subID= "min_alignment_length"
                    formData={formData}
                />
              </div>

              <div className="col">
                <TextInputAlt
                    label="NN Table:"
                    fieldID="primer_Tm_parameters"
                    subID= "nn_table"
                    formData={formData}
                />
              </div>

            </div>
            <div className="row g-3">
              <div className="col">
                <TextInputAlt
                    label="TMM Table:"
                    fieldID="primer_Tm_parameters"
                    subID= "tmm_table"
                    formData={formData}
                />
              </div>

              <div className="col">
                <TextInputAlt
                    label="IMM Table:"
                    fieldID="primer_Tm_parameters"
                    subID= "imm_table"
                    formData={formData}
                />
              </div>

              <div className="col">
                <TextInputAlt
                    label="DE Table:"
                    fieldID="primer_Tm_parameters"
                    subID= "de_table"
                    formData={formData}
                />
              </div>

            </div>
            <div className="row g-3">
              <div className="col">
                <NumberInputAlt
                    label="DNA Concentration 1 (dnac1):"
                    fieldID="primer_Tm_parameters"
                    subID= "dnac1"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="DNA Concentration 2 (dnac1):"
                    fieldID="primer_Tm_parameters"
                    subID= "dnac2"
                    formData={formData}
                />
              </div>

            </div>

            <div className=" row g-3">
              <div className="col">
                <NumberInputAlt
                    label="Salt Correction (saltcorr):"
                    fieldID="primer_Tm_parameters"
                    subID= "saltcorr"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="Sodium Concentration (Na):"
                    fieldID="primer_Tm_parameters"
                    subID= "Na"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="Potassium Concentration (K):"
                    fieldID="primer_Tm_parameters"
                    subID= "K"
                    formData={formData}
                /> 
              </div>

            </div>
            <div className="row g-3">
              <div className="col">
                <NumberInputAlt
                    label="Tris Concentration:"
                    fieldID="primer_Tm_parameters"
                    subID= "Tris"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="Magnesium Concentration (Mg):"
                    fieldID="primer_Tm_parameters"
                    subID= "Mg"
                    formData={formData}
                />
              </div>

              <div className="col">
                <NumberInputAlt
                    label="dNTPs Concentration:"
                    fieldID="primer_Tm_parameters"
                    subID= "dNTPs"
                    formData={formData}
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
                {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>

            <Collapse in={expanded}>
              <div className="text-center mt-2">
                <p className="text-muted">
                  MERFISH (Multiplexed Error-Robust Fluorescence In Situ
                  Hybridization) probes are short DNA oligonucleotides designed
                  to label specific RNA molecules in cells. They incorporate
                  unique “barcodes” that enable simultaneous imaging and
                  identification of hundreds of different transcripts, all
                  within a single sample. This highly multiplexed approach
                  provides detailed, spatially resolved gene expression
                  information at the single-cell level. A MERFISH encoding probe
                  is a fluorescent probe that contains a 30-nt targeting
                  sequence which directs their binding to the specific RNA, two
                  20-nt barcode sequences, which are read out by fluorescent
                  secondary readout probes, single A-nucleotide spacers between
                  readout and gene-specific regions, and two 20-nt PCR primer
                  binding sites. The specific readout sequences contained by an
                  encoding probe are determined by the binary barcode assigned
                  to that RNA.
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
                  activeTab === "probe_sequences" ? "active" : ""
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
                  activeTab === "primer_parameters" ? "active" : ""
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
                            activeTabDevSettings === "specfblastn"
                              ? "active"
                              : ""
                          }`}
                          onClick={() => setActiveTabDevSettings("specfblastn")}
                        >
                          Specificity Filters BlastN
                        </button>
                      </li>
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link ${
                            activeTabDevSettings === "crossfilterblastn"
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            setActiveTabDevSettings("crossfilterblastn")
                          }
                        >
                          Cross-hybrid filters BlastN
                        </button>
                      </li>
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link ${
                            activeTabDevSettings === "oligosetselection"
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            setActiveTabDevSettings("oligosetselection")
                          }
                        >
                          Oligo Set Selection Parameters
                        </button>
                      </li>
                      <li className="nav-item">
                        <button
                          type="button"
                          className={`nav-link ${
                            activeTabDevSettings === "meltingtemp"
                              ? "active"
                              : ""
                          }`}
                          onClick={() => setActiveTabDevSettings("meltingtemp")}
                        >
                          Parameters for Melting Temperature
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
                            activeTabDevSettings === "readout" ? "active" : ""
                          }`}
                          onClick={() => setActiveTabDevSettings("readout")}
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
                            activeTabDevSettings === "primerpro" ? "active" : ""
                          }`}
                          onClick={() => setActiveTabDevSettings("primerpro")}
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
                Please upload all required files or fill the values before
                submitting.
              </div>
            )}
            {runId && (
              <RunIdAlert runId={runId} idCopySuccess={idCopySuccess} />
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
                  runStatus === "submitting" || runStatus === "running"
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
