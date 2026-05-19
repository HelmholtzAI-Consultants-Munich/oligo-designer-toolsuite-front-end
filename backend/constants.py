from collections.abc import Mapping

PIPELINE_GENOMIC_INPUT: Mapping[str, list[str]] = dict(
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

"""Shared backend constants used by the Flask server and Celery worker."""

GENOMIC_DROPDOWN_CACHE_KEY: str = "genomic_dropdown_options"
MONGO_DB_NAME: str = "oligo_db"
PIPELINE_RUN_LIFECYCLE_COLLECTION: str = "pipeline_run_lifecycle"
PIPELINE_NAMES: frozenset[str] = frozenset({"scrinshot", "seqfish", "merfish", "oligoseq"})
PIPELINE_TIMEOUTS_CACHE_KEY: str = "pipeline_timeouts"
