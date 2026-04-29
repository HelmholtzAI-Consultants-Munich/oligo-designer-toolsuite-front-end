"""Shared backend constants used by the Flask server and Celery worker."""

GENOMIC_DROPDOWN_CACHE_KEY: str = "genomic_dropdown_options"
MONGO_DB_NAME: str = "oligo_db"
PIPELINE_RUN_LIFECYCLE_COLLECTION: str = "pipeline_run_lifecycle"
PIPELINE_NAMES: frozenset[str] = frozenset({"scrinshot", "seqfish", "merfish", "oligoseq"})
PIPELINE_TIMEOUTS_CACHE_KEY: str = "pipeline_timeouts"
