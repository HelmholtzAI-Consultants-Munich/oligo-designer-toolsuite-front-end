from config import Config
import datetime
from typing import Any

from celery import Celery

from .celery import app
from .pipeline_runner import PipelineRunner

from genomic_databases import prefetch_dropdown_options
from pymongo import MongoClient


@app.task(bind=True)
def run_pipeline(
    self: Celery.Task, pipeline_name: str, form_data: Any, upload_path: str, output_path: str
) -> bool:
    runner = PipelineRunner(pipeline_name, task=self)
    return runner.run(form_data, upload_path, output_path)


@app.task(bind=True)
def fetch_dropdown_options(self: Celery.Task):
    client = MongoClient(Config.MONGO_URI)

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
