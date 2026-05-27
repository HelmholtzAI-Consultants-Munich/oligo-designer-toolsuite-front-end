import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import TabsLayout from "../components/forms/TabsLayout";
import TabLayout from "../components/forms/TabLayout";
import SectionLayout from "../components/forms/SectionLayout";

export const merfishUiSchema: UiSchema = {
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
};

export const uiSchemaFromJsonSchema = (jsonSchema: RJSFSchema): UiSchema => {
    const uiSchema: UiSchema = {};
    return uiSchema;
};

export const oligoseqUiSchema: UiSchema = {
    "ui:ObjectFieldTemplate": TabsLayout,
    "ui:hiddenTabs": ["schema_version", "general"],
    target_probe: {
        "ui:ObjectFieldTemplate": TabLayout,
        oligo_generation: {
            "ui:ObjectFieldTemplate": SectionLayout,
            files_fasta_probe_database: {
                "ui:field": "genomicInput",
            },
        },
        property_filters: {
            "ui:ObjectFieldTemplate": SectionLayout,
        },
        specificity_filters: {
            "ui:ObjectFieldTemplate": SectionLayout,
            specificity_blastn_filter: {
                files_fasta_reference_database: {
                    "ui:field": "genomicInput",
                },
            },
            variant_filter: {
                files_vcf_reference_database: {
                    "ui:field": "fileUpload",
                },
            },
        },
        probe_set_selection: {
            "ui:ObjectFieldTemplate": SectionLayout,
        },
        global_parameters: {
            "ui:ObjectFieldTemplate": SectionLayout,
        },
    },
};

export const scrinshotUiSchema: UiSchema = {
    "ui:ObjectFieldTemplate": TabsLayout,
    "ui:tabs": [
        {
            title: "Target Probe Parameters",
            fields: [
                "file_regions",
                "files_fasta_target_probe_database",
                "files_fasta_reference_database_target_probe",
                "top_n_sets",
                [
                    "target_probe_length_min",
                    "target_probe_length_max",
                    "target_probe_isoform_consensus",
                ],
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
                "target_probe_padlock_arm_Tm_dif_max",
                [
                    "target_probe_padlock_arm_length_min",
                    "target_probe_padlock_arm_Tm_min",
                    "target_probe_padlock_arm_Tm_max",
                ],
                "target_probe_ligation_region_size",
                "target_probe_isoform_weight",
                "target_probe_GC_weight",
                "target_probe_Tm_weight",
                [
                    "set_size_min",
                    "set_size_opt",
                    "distance_between_target_probes",
                    "n_sets",
                ],
            ],
        },
        {
            title: "Detection Oligo Parameters",
            fields: [
                [
                    "detection_oligo_min_thymines",
                    "detection_oligo_length_min",
                    "detection_oligo_length_max",
                ],
                "detection_oligo_U_distance",
                "detection_oligo_Tm_opt",
            ],
        },
        {
            title: "Developer Settings",
            fields: [
                //not sorted
                "max_graph_size",
                "n_attempts",
                "heuristic",
                "heuristic_n_attempts",
                "target_probe_specificity_blastn_search_parameters",
                "target_probe_specificity_blastn_hit_parameters",
                "target_probe_cross_hybridization_blastn_search_parameters",
                "target_probe_cross_hybridization_blastn_hit_parameters",
                "target_probe_Tm_parameters",
                "target_probe_Tm_chem_correction_parameters",
                "target_probe_Tm_salt_correction_parameters",
                "detection_oligo_Tm_parameters",
                "detection_oligo_Tm_chem_correction_parameters",
                "detection_oligo_Tm_salt_correction_parameters",
            ],
        },
    ],
};

export const seqfishUiSchema: UiSchema = {
    "ui:ObjectFieldTemplate": TabsLayout,
    "ui:tabs": [
        {
            title: "Target Probe Parameters",
            fields: [
                "file_regions",
                "files_fasta_target_probe_database",
                "files_fasta_reference_database_target_probe",
                "top_n_sets",
                [
                    "target_probe_length_min",
                    "target_probe_length_max",
                    "target_probe_isoform_consensus",
                ],
                [
                    "target_probe_GC_content_min",
                    "target_probe_GC_content_opt",
                    "target_probe_GC_content_max",
                ],
                "target_probe_homopolymeric_base_n",

                "target_probe_GC_weight",
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
                "n_barcode_rounds",
                "n_pseudocolors",
                "channels_ids",
            ],
        },
        {
            title: "Primer Parameters",
            fields: [
                "files_fasta_reference_database_primer",
                ["reverse_primer_sequence", "primer_length"],
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
                // not yet sorted by tabs
                "max_graph_size",
                "n_attempts",
                "heuristic",
                "heuristic_n_attempts",
                "target_probe_T_secondary_structure",
                "target_probe_secondary_structures_threshold_deltaG",
                "target_probe_UTR_weight",
                "target_probe_specificity_blastn_search_parameters",
                "target_probe_specificity_blastn_hit_parameters",
                "target_probe_cross_hybridization_blastn_search_parameters",
                "target_probe_cross_hybridization_blastn_hit_parameters",
                "readout_probe_initial_num_sequences",
                "readout_probe_specificity_blastn_search_parameters",
                "readout_probe_specificity_blastn_hit_parameters",
                "readout_probe_cross_hybridization_blastn_search_parameters",
                "readout_probe_cross_hybridization_blastn_hit_parameters",
                "primer_initial_num_sequences",
                "primer_specificity_refrence_blastn_search_parameters",
                "primer_specificity_refrence_blastn_hit_parameters",
                "primer_specificity_encoding_probes_blastn_search_parameters",
                "primer_specificity_encoding_probes_blastn_hit_parameters",
                "primer_Tm_parameters",
                "primer_Tm_chem_correction_parameters",
                "primer_Tm_salt_correction_parameters",
            ],
        },
    ],
};
