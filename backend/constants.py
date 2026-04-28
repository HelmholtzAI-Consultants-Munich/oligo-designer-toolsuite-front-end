"""Shared backend constants used by the Flask server and Celery worker."""

MONGO_DB_NAME: str = "oligo_db"
PIPELINE_NAMES: frozenset[str] = frozenset({"scrinshot", "seqfish", "merfish", "oligoseq"})
