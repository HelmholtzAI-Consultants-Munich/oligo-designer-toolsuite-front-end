import datetime
from datetime import timedelta
from typing import Any

from celery import Celery
from pymongo import MongoClient

from backend.config import CeleryConfig
from backend.genomic_databases import prefetch_dropdown_options
from backend.worker.celery import app
from backend.worker.pipeline_runner import PipelineRunner


@app.task(bind=True)
def run_pipeline(
    self: Celery.Task, pipeline_name: str, form_data: Any, upload_path: str, output_path: str
) -> bool:
    runner = PipelineRunner(pipeline_name, task=self)
    return runner.run(form_data, upload_path, output_path)


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


@app.task(bind=True)
def refresh_pipeline_timeouts(self: Celery.Task):
    """Compute p95 run duration per pipeline from recent successful runs and cache the results.

    Used by heuristic timeout mode to automatically tune soft_time_limit values.
    Requires at least 5 successful runs per pipeline; pipelines with fewer runs are skipped
    and will fall back to the fixed config values at enqueue time.
    """
    client = MongoClient(CeleryConfig.result_backend)
    db = client["oligo_db"]
    runs = db["runs"]

    window = datetime.datetime.utcnow() - timedelta(days=CeleryConfig.pipeline_timeout_heuristic_window_days)
    pipelines = ["merfish", "seqfish", "scrinshot", "oligoseq"]
    timeouts = {}

    for pipeline in pipelines:
        docs = list(
            runs.find(
                {
                    "pipeline": pipeline,
                    "status": "success",
                    "started_at": {"$exists": True},
                    "finished_at": {"$exists": True, "$gte": window},
                }
            )
        )
        if len(docs) < 5:
            continue
        durations = [
            (doc["finished_at"] - doc["started_at"]).total_seconds()
            for doc in docs
            if doc["finished_at"] > doc["started_at"]
        ]
        if not durations:
            continue
        p = CeleryConfig.pipeline_timeout_heuristic_percentile
        percentile_val = sorted(durations)[int(len(durations) * p / 100)]
        timeouts[pipeline] = int(percentile_val * CeleryConfig.pipeline_timeout_heuristic_factor)

    if timeouts:
        cache = db["cache"]
        cache.update_one(
            {"_id": "pipeline_timeouts"},
            {"$set": {"data": timeouts, "updated_at": datetime.datetime.utcnow()}},
            upsert=True,
        )
        print(f"Updated pipeline timeout heuristics: {timeouts}")
