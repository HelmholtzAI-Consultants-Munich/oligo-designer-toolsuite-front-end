from collections.abc import Mapping

PIPELINE_GENOMIC_INPUT: Mapping[str, list[str]] = dict(
    **{
        pipeline: [
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
        ]
        for pipeline in ["scrinshot"]
    },
    **{
        pipeline: [
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
            "files_vcf_reference_database_target_probe",
        ]
        for pipeline in ["oligoseq"]
    },
    **{
        pipeline: [
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
            "files_fasta_reference_database_readout_probe",
            "files_fasta_reference_database_primer",
        ]
        for pipeline in ["merfish", "seqfish"]
    },
)
