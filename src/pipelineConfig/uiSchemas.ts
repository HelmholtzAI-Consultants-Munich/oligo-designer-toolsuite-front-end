import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import TabsLayout from "../components/forms/TabsLayout";
import TabLayout from "../components/forms/TabLayout";
import SectionLayout from "../components/forms/SectionLayout";
import { findSchemaDefinition, mergeObjects } from "@rjsf/utils";

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
    return uiSchemaFromJsonSchemaRecursive(jsonSchema, jsonSchema, 0);
};
/**
 * Generates an RJSF UiSchema based on a JSON Schema. Therefore it recursively iterates each level of the JSON Schema
 * and applies the appropriate components and ui options
 *
 * @param baseSchema - the full JSON Schema of the pipeline
 * @param localSchema - the schema of the current level the function is inside of the pipeline schema
 * @param level - the current depth of recursion
 * @returns A RJSF UiSchema which is filled with the necessary fields to match our UI style
 *
 * {@label JSON_TO_UI_FUNCTION}
 */
const uiSchemaFromJsonSchemaRecursive = (
    baseSchema: RJSFSchema,
    localSchema: RJSFSchema,
    level: number
): UiSchema => {
    let uiSchema: UiSchema = {};

    if (localSchema.$ref) {
        try {
            const refSchema = findSchemaDefinition(
                localSchema.$ref,
                baseSchema
            );
            return uiSchemaFromJsonSchemaRecursive(
                baseSchema,
                refSchema,
                level
            );
        } catch (error) {
            console.error(
                `Error resolving reference: ${localSchema.$ref}`,
                error
            );
            return uiSchema;
        }
    }

    if (localSchema.oneOf || localSchema.anyOf) {
        // we deeply merge the uiSchemas of all options, to ensure all possible fields are covered
        for (const option of localSchema.oneOf || localSchema.anyOf || []) {
            const optionSchema = option as RJSFSchema;
            const optionUiSchema = uiSchemaFromJsonSchemaRecursive(
                baseSchema,
                optionSchema,
                level
            );
            uiSchema = mergeObjects(uiSchema, optionUiSchema);
        }
    }
    if (localSchema.properties) {
        const fields = Object.keys(localSchema.properties);
        if (level === 0) {
            // root -> TabsLayout
            uiSchema["ui:ObjectFieldTemplate"] = TabsLayout;
        } else if (level === 1) {
            // first level -> TabLayout
            uiSchema["ui:ObjectFieldTemplate"] = TabLayout;
        } else if (level === 2) {
            // second level -> SectionLayout
            uiSchema["ui:ObjectFieldTemplate"] = SectionLayout;
        }

        for (const field of fields) {
            const propertySchema = localSchema.properties[field] as RJSFSchema;
            if (field === "file_region_ids") {
                // file_region_ids (any level) -> txtUploadInput
                uiSchema[field] = {
                    "ui:field": "txtUploadInput",
                    "ui:fieldReplacesAnyOrOneOf": true,
                };
            } else if (field.startsWith("files_fasta_")) {
                // files_fasta_* (any level) -> genomicInput
                uiSchema[field] = { "ui:field": "genomicInput" };
            } else if (field.startsWith("files_vcf_")) {
                // files_vcf_* (any level) -> fileUpload
                uiSchema[field] = { "ui:field": "fileUpload" };
            } else {
                uiSchema[field] = uiSchemaFromJsonSchemaRecursive(
                    baseSchema,
                    propertySchema,
                    level + 1
                );
            }
        }
    }

    return uiSchema;
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
