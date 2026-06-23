"""Worker file for MongoDB interaction and related utility functions."""

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient
from pymongo.results import UpdateResult

from backend.config import Config


def _parse_run_id(run_id_str: str) -> ObjectId | None:
    try:
        return ObjectId(run_id_str)
    except InvalidId:
        return None


def _update_run(run_id: ObjectId, data: dict[Any, Any]) -> UpdateResult:
    with MongoClient(Config.MONGO_URI) as client:
        db = client["oligo_db"]
        return db.runs.update_one({"_id": run_id}, {"$set": data})
