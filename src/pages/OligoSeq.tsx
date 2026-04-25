import oligoseq_schema from "@schemas/oligoseq.schema.json";
import PipelineTemplate from "../components/forms/PipelineTemplate";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import { TabsLayout } from "../components/forms/TabsLayout";

const schema = oligoseq_schema as RJSFSchema;

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
                    "target_probe_split_region",
                    "target_probe_isoform_consensus",
                ],
                "target_probe_targeted_exons",
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
                [
                    "target_probe_secondary_structures_T",
                    "target_probe_secondary_structures_threshold_deltaG",
                    "target_probe_max_len_selfcomplement",
                    "target_probe_hybridization_probability_threshold",
                ],
                ["target_probe_Tm_weight", "target_probe_GC_weight"],
                [
                    "set_size_min",
                    "set_size_opt",
                    "distance_between_target_probes",
                    "n_sets",
                ],
            ],
        },
        {
            title: "Developer Settings",
            fields: [
                // not sorted
                "max_graph_size",
                "n_attempts",
                "heuristic",
                "heuristic_n_attempts",
                "target_probe_hybridization_probability_alignment_method",
                "target_probe_hybridization_probability_blastn_search_parameters",
                "target_probe_hybridization_probability_blastn_hit_parameters",
                "target_probe_hybridization_probability_bowtie_search_parameters",
                "target_probe_hybridization_probability_bowtie_hit_parameters",
                "target_probe_cross_hybridization_alignment_method",
                "target_probe_cross_hybridization_blastn_search_parameters",
                "target_probe_cross_hybridization_blastn_hit_parameters",
                "target_probe_cross_hybridization_bowtie_search_parameters",
                "target_probe_cross_hybridization_bowtie_hit_parameters",
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
};

const Oligoseq: React.FC = () => {
    return (
        <PipelineTemplate
            pipeline="oligoseq"
            title="OligoSeq Probe Designer"
            schema={schema}
            uiSchema={uiSchema}
        />
    );
};
export default Oligoseq;
