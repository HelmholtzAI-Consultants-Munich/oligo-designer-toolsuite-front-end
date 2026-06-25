from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from pymongo import MongoClient
from pymongo.database import Database

from backend.config import Config


@contextmanager
def mongo_database() -> Generator[Database[dict[str, Any]], None, None]:
    """Yield the application database and close its client afterward."""
    client = MongoClient(Config.MONGO_URI)
    try:
        yield client["oligo_db"]
    finally:
        client.close()
