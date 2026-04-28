import datetime
from datetime import timedelta
from typing import Any

from celery import Celery
from celery.exceptions import SoftTimeLimitExceeded

from backend.config import CeleryConfig
from backend.constants import PIPELINE_NAMES
from backend.genomic_databases import prefetch_dropdown_options
from backend.utilities.typed_values import utc_now
from backend.worker.celery import app
from backend.worker.helpers import TIMEOUT_ERROR_MESSAGE, compute_percentile, get_worker_db
from backend.worker.pipeline_runner import PipelineRunner


@app.task(bind=True)
def run_pipeline(
    self: Celery.Task, pipeline_name: str, form_data: Any, upload_path: str, output_path: str
) -> bool:
    runner = PipelineRunner(pipeline_name, task=self)
    try:
        return runner.run(form_data, upload_path, output_path)
    except SoftTimeLimitExceeded:
        # Write the error message directly from the worker — this is more reliable than
        # inferring the failure reason server-side via exception deserialization.
        with get_worker_db() as db:
            db.runs.update_one(
                {"task_id": self.request.id},
                {"$set": {"error_message": TIMEOUT_ERROR_MESSAGE}},
            )
        raise


@app.task(bind=True)
def fetch_dropdown_options(self: Celery.Task):
    with get_worker_db() as db:
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
    """Compute a percentile run-duration rate per pipeline and cache the results.

    Used by heuristic timeout mode to automatically tune soft_time_limit values.
    Requires at least 5 successful runs per pipeline; pipelines with fewer runs are skipped
    and will fall back to the fixed config values at enqueue time.
    """
    window = utc_now() - timedelta(days=CeleryConfig.pipeline_timeout_heuristic_window_days)
    timeouts = {}

    with get_worker_db() as db:
        for pipeline in PIPELINE_NAMES:
            docs = list(
                db.runs.find(
                    {
                        "pipeline": pipeline,
                        "status": "success",
                        "started_at": {"$exists": True},
                        "finished_at": {"$exists": True, "$gte": window},
                        "gene_count": {"$exists": True, "$gt": 0},
                    }
                )
            )
            if len(docs) < 5:
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
            # Store the raw percentile rate — the safety factor is applied at enqueue
            # time so it remains visible and configurable without re-running aggregation.
            timeouts[pipeline] = {
                "seconds_per_gene": percentile_rate,
                "sample_count": len(rates),
            }

        db.cache.update_one(
            {"_id": "pipeline_timeouts"},
            {"$set": {"data": timeouts, "updated_at": utc_now()}},
            upsert=True,
        )
    print(f"Updated pipeline timeout heuristics: {timeouts}")
