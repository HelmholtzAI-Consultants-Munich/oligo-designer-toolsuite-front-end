from collections.abc import Mapping

PIPELINE_GENOMIC_INPUT: Mapping[str, list[list[str]]] = dict(
    **{
        pipeline: [
            ["files_fasta_target_probe_database"],
            ["files_fasta_reference_database_target_probe"],
        ]
        for pipeline in ["scrinshot"]
    },
    **{
        pipeline: [
            [
                "target_probe",
                "oligo_generation",
                "files_fasta_probe_database",
            ],
            [
                "target_probe",
                "specificity_filters",
                "specificity_blastn_filter",
                "files_fasta_reference_database",
            ],
        ]
        for pipeline in ["oligoseq"]
    },
    **{
        pipeline: [
            ["files_fasta_target_probe_database"],
            ["files_fasta_reference_database_target_probe"],
            ["files_fasta_reference_database_readout_probe"],
            ["files_fasta_reference_database_primer"],
        ]
        for pipeline in ["merfish", "seqfish"]
    },
)

PIPELINE_FILE_INPUT: Mapping[str, list[list[str]]] = {
    "oligoseq": [["target_probe", "specificity_filters", "variant_filter", "files_vcf_reference_database"]]
}

PIPELINE_NON_EXPOSED_FIELDS = {
    "oligoseq": {
        "general": {
            "n_jobs": 1,
            "write_intermediate_steps": True,
            "dir_output": "output_oligo_seq_probe_designer",
        },
    },
}
