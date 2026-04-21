import datetime
from typing import Any

from celery.utils.log import get_task_logger
from pymongo import MongoClient

from backend.config import CeleryConfig
from backend.genomic_databases import prefetch_dropdown_options
from backend.worker.celery import app
from backend.worker.genomic_region_generator_runner import GenomicRegionGeneratorRunner
from backend.worker.pipeline_runner import PipelineRunner

logger = get_task_logger(__name__)


@app.task()
def run_pipeline(
    generated_region_paths: list[tuple[str, list[str]]], pipeline_name: str, form_data: Any, output_path: str
) -> bool:
    runner = PipelineRunner(pipeline_name, logger=logger)
    return runner.run(form_data, output_path, generated_region_paths)


@app.task()
def run_genomic_region_generator(form_data: Any, id: str) -> tuple[str, list[str]]:
    runner = GenomicRegionGeneratorRunner(logger=logger)
    return id, runner.run(form_data)


@app.task()
def fetch_dropdown_options():
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
