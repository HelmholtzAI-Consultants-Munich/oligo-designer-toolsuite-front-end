"""Shared helpers for Celery worker tasks.

The worker has no Flask application context, so utilities here must be
framework-agnostic and rely only on PyMongo and stdlib.
"""

from contextlib import contextmanager

from pymongo import MongoClient
from pymongo.database import Database

from backend.config import CeleryConfig
from backend.constants import MONGO_DB_NAME

TIMEOUT_ERROR_MESSAGE = (
    "This pipeline run exceeded the maximum allowed runtime and was stopped. "
    "Please reduce the input size or contact support."
)


@contextmanager
def get_worker_db() -> Database:
    """Open a MongoDB connection and yield the database, closing it on exit."""
    client = MongoClient(CeleryConfig.result_backend)
    try:
        yield client[MONGO_DB_NAME]
    finally:
        client.close()


def compute_percentile(values: list[float], p: int) -> float:
    """Return the p-th percentile of a non-empty sorted list of values.

    Args:
        values: Non-empty list of numeric values.
        p: Percentile to compute (0 to 100).

    Returns:
        The value at the p-th percentile.
    """
    if not values:
        raise ValueError("Cannot compute percentile of an empty list")
    if not 0 <= p <= 100:
        raise ValueError(f"Percentile must be between 0 and 100, got {p}")
    sorted_values = sorted(values)
    index = int(len(sorted_values) * p / 100)
    # Clamp to last index in case p == 100
    return sorted_values[min(index, len(sorted_values) - 1)]
