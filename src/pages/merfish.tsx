import { useState } from "react";
import Form from "@rjsf/react-bootstrap";
import validator from "@rjsf/validator-ajv8";
import Navbar from "../modules/nav";
import merfish_schema from "../../flask/routes/runners/schemas/merfish.schema.json";
import type { JSONSchema7 } from "json-schema";
import type { UiSchema } from "@rjsf/utils";
import FieldTemplate from "../components/fieldTemplate";
import merfish_form from "../forms/merfish_form";
import { TabsLayout } from "../components/tabs";
import type { FileState } from "../components/types";
import { handleSubmit } from "../components/helpers";
import FileSelection from "../components/fileSelection_rjsf";
import type { FastaForm } from "../components/types";

const schema = merfish_schema as JSONSchema7;

const uiSchema: UiSchema = {
    "ui:ObjectFieldTemplate": TabsLayout,
    "ui:tabs": [
        {
            title: "Target Probe Parameters",
            fields: [
                "file_regions",
                "files_fasta_target_probe_database",
                "files_fasta_reference_database_target_probe",
                "target_probe_length_min",
                "target_probe_length_max",
                "target_probe_isoform_consensus",
                [
                    "target_probe_GC_content_min",
                    "target_probe_GC_content_opt",
                    "target_probe_GC_content_max",
                ],
                [
                    "target_probe_Tm_min",
                    "target_probe_Tm_opt",
                    "target_probe_Tm_max",
                ],
                "target_probe_homopolymeric_base_n",
                "target_probe_T_secondary_structure",
                "target_probe_secondary_structures_threshold_deltaG",
                "target_probe_GC_weight",
                "target_probe_Tm_weight",
                "target_probe_isoform_weight",
                [
                    "set_size_min",
                    "set_size_opt",
                    "distance_between_target_probes",
                    "n_sets",
                ],
            ],
        },
        {
            title: "Readout Probe Parameters",
            fields: [
                "files_fasta_reference_database_readout_probe",
                "readout_probe_length",
                "readout_probe_base_probabilities",
                [
                    "readout_probe_GC_content_min",
                    "readout_probe_GC_content_max",
                ],
                "readout_probe_homopolymeric_base_n",
                "readout_probe_set_size",
                "readout_probe_homogeneous_properties_weights",
                [
                    "n_bits",
                    "min_hamming_dist",
                    "hamming_weight",
                    "channels_ids",
                ],
            ],
        },
        {
            title: "Primer Parameters",
            fields: [
                [
                    "files_fasta_reference_database_primer",
                    "reverse_primer_sequence",
                ],
                "primer_length",
                "primer_base_probabilities",
                ["primer_GC_content_min", "primer_GC_content_max"],
                [
                    "primer_number_GC_GCclamp",
                    "primer_number_three_prime_base_GCclamp",
                ],
                "primer_homopolymeric_base_n",
                [
                    "primer_max_len_selfcomplement",
                    "primer_max_len_complement_reverse_primer",
                    "primer_Tm_min",
                    "primer_Tm_max",
                ],
                [
                    "primer_T_secondary_structure",
                    "primer_secondary_structures_threshold_deltaG",
                ],
            ],
        },
        {
            title: "Developer Settings",
            fields: [
                "target_probe_specificity_blastn_search_parameters",
                "target_probe_specificity_blastn_hit_parameters",
                "max_graph_size",
                "n_attempts",
                "heuristic",
                "heuristic_n_attempts",
                "target_probe_Tm_parameters",
                "target_probe_Tm_chem_correction_parameters",
                "target_probe_Tm_salt_correction_parameters",
            ],
        },
    ],
    files_fasta_target_probe_database: {
        "ui:widget": "fileSelection",
    },
    files_fasta_reference_database_target_probe: {
        "ui:widget": "fileSelection",
    },
    files_fasta_reference_database_readout_probe: {
        "ui:widget": "fileSelection",
    },
    files_fasta_reference_database_primer: {
        "ui:widget": "fileSelection",
    },
};

const Merfish: React.FC = () => {
    const [formData, setFormData] = useState<any>(merfish_form);

    const [files, setFiles] = useState<FileState>({
        file_regions_file: null,
        files_fasta_target_probe_database: [],
        files_fasta_reference_database_target_probe: [],
        files_fasta_reference_database_readout_probe: [],
        files_fasta_reference_database_primer: [],
    });
    const [fastaFormsTarget, setfastaFormsTarget] = useState<Array<FastaForm>>(
        []
    );
    const [fastaFormsReference, setFastaFormsReference] = useState<
        Array<FastaForm>
    >([]);
    const [fastaFormsReadout, setFastaFormsReadout] = useState<
        Array<FastaForm>
    >([]);
    const [fastaFormsPrimer, setFastaFormsPrimer] = useState<Array<FastaForm>>(
        []
    );
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
    const widgets = {
        fileSelection: FileSelection,
    };

    return (
        <>
            <Navbar />
            <div className="mb-3">
                <div className="d-flex justify-content-center align-items-center mt-3">
                    <h2 className="mb-0">Example</h2>
                </div>
                <div className="container my-4">
                    <Form
                        schema={schema}
                        uiSchema={uiSchema}
                        formContext={{
                            files,
                            setFiles,
                        }}
                        formData={formData}
                        fields={{ fileSelection: FileSelection }}
                        templates={{
                            FieldTemplate: FieldTemplate,
                            ObjectFieldTemplate: TabsLayout,
                        }}
                        widgets={widgets}
                        validator={validator}
                        onChange={(e) => setFormData(e.formData)}
                        onSubmit={() =>
                            handleSubmit(
                                runStatus,
                                setRunStatus,
                                setRunId,
                                setModal,
                                files,
                                formData,
                                fastaFormsTarget,
                                fastaFormsPrimer,
                                fastaFormsReadout,
                                fastaFormsReference,
                                setIdCopySuccess
                            )
                        }
                    />
                </div>
            </div>
        </>
    );
};
export default Merfish;
