import scrinshot_schema from "../../flask/routes/runners/schemas/scrinshot.schema.json";
import type { JSONSchema7 } from "json-schema";
import type { UiSchema } from "@rjsf/utils";
import { TabsLayout } from "../components/tabs";
import Pipeline_Template from "./pipelineTemplate";

const schema = scrinshot_schema as JSONSchema7;

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

    files_fasta_target_probe_database: {
        "ui:widget": "fileSelection",
    },
    files_fasta_reference_database_target_probe: {
        "ui:widget": "fileSelection",
    },
};

const Scrinshot: React.FC = () => {
    return (
        <>
            <Pipeline_Template
                pipeline="scrinshot"
                title="Scrinshot Probe Designer"
                schema={schema}
                uiSchema={uiSchema}
            />
        </>
    );
};
export default Scrinshot;
