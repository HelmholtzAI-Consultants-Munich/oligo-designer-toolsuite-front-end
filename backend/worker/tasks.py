import datetime
from typing import Any

from bson import ObjectId
from celery import Celery
from pymongo import MongoClient

from backend.config import CeleryConfig
from backend.genomic_databases import prefetch_dropdown_options
from backend.worker.celery import app
from backend.worker.pipeline_runner import PipelineRunner


@app.task(bind=True)
def run_pipeline(
    self: Celery.Task,
    pipeline_name: str,
    form_data: Any,
    upload_path: str,
    output_path: str,
    run_id_str: str,
) -> bool:
    runner = PipelineRunner(pipeline_name, task=self)
    ok, metrics = runner.run(form_data, upload_path, output_path)
    client = MongoClient(CeleryConfig.result_backend)
    db = client["oligo_db"]
    db.runs.update_one(
        {"_id": ObjectId(run_id_str)},
        {"$set": {"metrics": metrics.to_dict()}},
    )
    return ok


@app.task(bind=True)
def fetch_dropdown_options(self: Celery.Task):
    client = MongoClient(CeleryConfig.result_backend)

    db = client["oligo_db"]

    if "cache" not in db.list_collection_names():
        db.create_collection("cache")
        print("setup cache collection")

    cache = db["cache"]

    doc = cache.find_one({"_id": 1})
    if doc is None or (datetime.datetime.today() - doc["timestamp"]).days >= 1:
        cache.update_one(
            {"_id": 1},
            {"$set": {"timestamp": datetime.datetime.today(), "data": prefetch_dropdown_options()}},
            upsert=True,
        )
        print("Inserted/ Updated outdated dropdown options")
