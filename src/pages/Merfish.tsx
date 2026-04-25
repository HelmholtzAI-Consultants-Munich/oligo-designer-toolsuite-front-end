import merfish_schema from "@schemas/merfish.schema.json";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import PipelineTemplate from "../components/forms/PipelineTemplate";
import { TabsLayout } from "../components/forms/TabsLayout";

const schema = merfish_schema as RJSFSchema;

const uiSchema: UiSchema = {
    "ui:ObjectFieldTemplate": TabsLayout,
    "ui:tabs": [
        {
            title: "Target Probe Parameters",
            fields: [
                "file_regions",
                "files_fasta_target_probe_database",
                "files_fasta_reference_database_target_probe",
                "top_n_sets",
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
        "ui:field": "fileSelection",
    },
    files_fasta_reference_database_target_probe: {
        "ui:field": "fileSelection",
    },
    files_fasta_reference_database_readout_probe: {
        "ui:field": "fileSelection",
    },
    files_fasta_reference_database_primer: {
        "ui:field": "fileSelection",
    },
};

const Merfish: React.FC = () => {
    return (
        <PipelineTemplate
            pipeline="merfish"
            title="Merfish Probe Designer"
            schema={schema}
            uiSchema={uiSchema}
        />
    );
};
export default Merfish;
