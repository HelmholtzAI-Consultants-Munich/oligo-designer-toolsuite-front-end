import datetime
from datetime import timedelta
from typing import Any

from celery import Celery

from backend.config import CeleryConfig
from backend.constants import (
    GENOMIC_DROPDOWN_CACHE_KEY,
    PIPELINE_NAMES,
    PIPELINE_RUN_LIFECYCLE_COLLECTION,
    PIPELINE_TIMEOUTS_CACHE_KEY,
)
from backend.genomic_databases import prefetch_dropdown_options
from backend.utilities.timestamps import utc_now
from backend.worker.celery import app
from backend.worker.helpers import compute_percentile, get_worker_db
from backend.worker.pipeline_runner import PipelineRunner


@app.task(bind=True)
def run_pipeline(
    self: Celery.Task, pipeline_name: str, form_data: Any, upload_path: str, output_path: str
) -> bool:
    runner = PipelineRunner(pipeline_name, task=self)
    return runner.run(form_data, upload_path, output_path)


@app.task(bind=True)
def fetch_dropdown_options(self: Celery.Task):
    with get_worker_db() as db:
        if "cache" not in db.list_collection_names():
            db.create_collection("cache")
            print("setup cache collection")

        cache = db["cache"]

        doc = cache.find_one({"_id": GENOMIC_DROPDOWN_CACHE_KEY})
        if doc is None or (datetime.datetime.today() - doc["timestamp"]).days >= 1:
            cache.update_one(
                {"_id": GENOMIC_DROPDOWN_CACHE_KEY},
                {"$set": {"timestamp": datetime.datetime.today(), "data": prefetch_dropdown_options()}},
                upsert=True,
            )
            print("Inserted/ Updated outdated dropdown options")


@app.task(bind=True)
def refresh_pipeline_duration_stats(self: Celery.Task):
    """Compute and cache per-pipeline run-duration statistics.

    Used by heuristic timeout mode to automatically tune soft_time_limit values
    from worker-managed lifecycle records. Requires at least the configured
    minimum number of successful runs per pipeline; pipelines with fewer runs
    are skipped and will fall back to the fixed config values at enqueue time.
    """
    window = utc_now() - timedelta(days=CeleryConfig.pipeline_timeout_heuristic_window_days)
    duration_stats = {}

    with get_worker_db() as db:
        for pipeline in PIPELINE_NAMES:
            docs = list(
                db[PIPELINE_RUN_LIFECYCLE_COLLECTION].find(
                    {
                        "pipeline": pipeline,
                        "status": "success",
                        "started_at": {"$exists": True},
                        "finished_at": {"$exists": True, "$gte": window},
                        "gene_count": {"$exists": True, "$gt": 0},
                    }
                )
            )
            if len(docs) < CeleryConfig.pipeline_timeout_heuristic_min_runs:
                continue
            # Normalize duration by gene count to get seconds-per-gene rate.
            # This ensures the timeout scales correctly with input size rather than
            # being biased by the mix of small/large runs in the sample window.
            rates = [
                (doc["finished_at"] - doc["started_at"]).total_seconds() / doc["gene_count"]
                for doc in docs
                if doc["finished_at"] > doc["started_at"]
            ]
            if not rates:
                continue
            percentile_rate = compute_percentile(rates, CeleryConfig.pipeline_timeout_heuristic_percentile)
            duration_stats[pipeline] = {
                "seconds_per_gene": percentile_rate,
                "sample_count": len(rates),
            }

        db.cache.update_one(
            {"_id": PIPELINE_TIMEOUTS_CACHE_KEY},
            {"$set": {"data": duration_stats, "updated_at": utc_now()}},
            upsert=True,
        )
    print(f"Updated pipeline duration stats: {duration_stats}")
