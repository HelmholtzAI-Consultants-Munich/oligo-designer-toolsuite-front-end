"""Worker file for MongoDB interaction and related utility functions."""

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.results import UpdateResult

from backend.database import mongo_database


def _parse_run_id(run_id_str: str) -> ObjectId | None:
    try:
        return ObjectId(run_id_str)
    except InvalidId:
        return None


def _update_run(run_id: ObjectId, data: dict[Any, Any]) -> UpdateResult:
    with mongo_database() as db:
        return db.runs.update_one({"_id": run_id}, {"$set": data})
