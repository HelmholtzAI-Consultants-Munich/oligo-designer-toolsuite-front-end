from typing import Final

PIPELINE_GENOMIC_INPUT: Final[dict[str, list[str]]] = dict(
    **{
        pipeline: [
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
        ]
        for pipeline in ["scrinshot", "oligoseq"]
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
