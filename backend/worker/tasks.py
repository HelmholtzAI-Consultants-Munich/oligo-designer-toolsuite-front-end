import calendar
import datetime
from datetime import timedelta
from logging import Logger
from typing import Any

from bson import ObjectId
from celery.utils.log import get_task_logger
from pymongo import MongoClient

from backend.config import CeleryConfig, Config
from backend.constants import (
    GENOMIC_DROPDOWN_CACHE_KEY,
    PIPELINE_NAMES,
    PIPELINE_RUN_LIFECYCLE_COLLECTION,
    PIPELINE_TIMEOUTS_CACHE_KEY,
)
from backend.genomic_databases import fetch_dropdown_options
from backend.utilities.timestamps import utc_now
from backend.worker.celery import app
from backend.worker.genomic_region_generator_runner import GenomicRegionGeneratorRunner
from backend.worker.handlers import PipelineTask
from backend.worker.helpers import compute_percentile, get_worker_db

logger: Logger = get_task_logger(__name__)


@app.task(base=PipelineTask)
def run_pipeline(
    generated_region_paths: list[tuple[str, list[str]]], pipeline_name: str, form_data: Any, output_path: str
) -> None:
    from backend.worker.pipeline_runner import PipelineRunner  # lazy: avoids Bio at import time

    runner = PipelineRunner(pipeline_name, logger=logger)
    runner.run(form_data, output_path, generated_region_paths)


@app.task()
def run_genomic_region_generator(form_data: Any, id: str) -> tuple[str, list[str]]:
    runner = GenomicRegionGeneratorRunner(logger=logger)
    return id, runner.run(form_data)


@app.task(bind=True)
def update_dropdown_options_cache(self):
    with get_worker_db() as db:
        if "cache" not in db.list_collection_names():
            db.create_collection("cache")
            print("setup cache collection")

        cache = db["cache"]

        doc = cache.find_one({"_id": GENOMIC_DROPDOWN_CACHE_KEY})
        if doc is None or (datetime.datetime.today() - doc["timestamp"]).days >= 1:
            cache.update_one(
                {"_id": GENOMIC_DROPDOWN_CACHE_KEY},
                {"$set": {"timestamp": datetime.datetime.today(), "data": fetch_dropdown_options()}},
                upsert=True,
            )
            print("Inserted/ Updated outdated dropdown options")


@app.task()
def trigger_dropdown_options_fetching():
    logger.debug("Updating genomic dropdown options cache")
    # Ignore results since we only want to update the function's cache
    _ = fetch_dropdown_options()


@app.task(bind=True)
def refresh_pipeline_duration_stats(self):
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


@app.task()
def generate_monthly_report(target_year: int | None = None, target_month: int | None = None) -> None:
    client = MongoClient(Config.MONGO_URI)
    try:
        db = client["oligo_db"]

        today = datetime.date.today()
        if target_year is None or target_month is None:
            first_of_this_month = today.replace(day=1)
            prev = first_of_this_month - datetime.timedelta(days=1)
            target_year = prev.year
            target_month = prev.month
            triggered_by = "scheduled"
        else:
            triggered_by = "manual"

        period_id = f"{target_year}-{target_month:02d}"
        start_dt = datetime.datetime(target_year, target_month, 1, 0, 0, 0)
        last_day = calendar.monthrange(target_year, target_month)[1]
        end_dt = datetime.datetime(target_year, target_month, last_day, 23, 59, 59) + datetime.timedelta(
            seconds=1
        )

        # New user registrations via ObjectId range
        start_oid = ObjectId.from_datetime(start_dt)
        end_oid = ObjectId.from_datetime(end_dt)
        new_users = db.users.count_documents({"_id": {"$gte": start_oid, "$lt": end_oid}})

        # Runs aggregation
        runs_pipeline = [
            {"$match": {"created_at": {"$gte": start_dt, "$lt": end_dt}}},
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "pending": {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}},
                    "started": {"$sum": {"$cond": [{"$eq": ["$status", "started"]}, 1, 0]}},
                    "success": {"$sum": {"$cond": [{"$eq": ["$status", "success"]}, 1, 0]}},
                    "failure": {"$sum": {"$cond": [{"$eq": ["$status", "failure"]}, 1, 0]}},
                    "scrinshot": {"$sum": {"$cond": [{"$eq": ["$pipeline", "scrinshot"]}, 1, 0]}},
                    "seqfish": {"$sum": {"$cond": [{"$eq": ["$pipeline", "seqfish"]}, 1, 0]}},
                    "merfish": {"$sum": {"$cond": [{"$eq": ["$pipeline", "merfish"]}, 1, 0]}},
                    "oligoseq": {"$sum": {"$cond": [{"$eq": ["$pipeline", "oligoseq"]}, 1, 0]}},
                    "anonymous": {"$sum": {"$cond": [{"$in": ["$user_id", [None, ""]]}, 1, 0]}},
                    "converted": {"$sum": {"$cond": [{"$eq": ["$transferred_from_anon", True]}, 1, 0]}},
                }
            },
        ]
        runs_result = list(db.runs.aggregate(runs_pipeline))
        r = runs_result[0] if runs_result else {}

        total_runs = r.get("total", 0)
        success = r.get("success", 0)
        failure = r.get("failure", 0)
        anonymous = r.get("anonymous", 0)
        converted = r.get("converted", 0)

        decided = success + failure
        success_rate = round(success / decided, 4) if decided > 0 else None
        failure_rate = round(failure / decided, 4) if decided > 0 else None
        conversion_rate = round(converted / anonymous, 4) if anonymous > 0 else None

        active_users = len(
            db.runs.distinct(
                "user_id", {"created_at": {"$gte": start_dt, "$lt": end_dt}, "user_id": {"$nin": [None, ""]}}
            )
        )

        feedback_count = db.feedback.count_documents({"created_at": {"$gte": start_dt, "$lt": end_dt}})

        # Deltas vs previous month
        prev_first = start_dt - datetime.timedelta(days=1)
        prev_id = f"{prev_first.year}-{prev_first.month:02d}"
        prev = db.monthly_reports.find_one({"_id": prev_id})

        def _delta(current, prev_doc, *keys):
            if prev_doc is None:
                return None
            val = prev_doc
            for k in keys:
                val = val.get(k) if isinstance(val, dict) else None
                if val is None:
                    return None
            return current - val

        prev_sr = prev.get("runs", {}).get("success_rate") if prev else None
        prev_cr = prev.get("conversions", {}).get("conversion_rate") if prev else None

        report = {
            "_id": period_id,
            "year": target_year,
            "month": target_month,
            "generated_at": datetime.datetime.utcnow(),
            "generated_by": triggered_by,
            "users": {
                "new_registrations": new_users,
                "active": active_users,
                "delta_new_registrations": _delta(new_users, prev, "users", "new_registrations"),
                "delta_active": _delta(active_users, prev, "users", "active"),
            },
            "runs": {
                "total": total_runs,
                "by_status": {
                    "pending": r.get("pending", 0),
                    "started": r.get("started", 0),
                    "success": success,
                    "failure": failure,
                },
                "by_pipeline": {
                    "scrinshot": r.get("scrinshot", 0),
                    "seqfish": r.get("seqfish", 0),
                    "merfish": r.get("merfish", 0),
                    "oligoseq": r.get("oligoseq", 0),
                },
                "anonymous": anonymous,
                "authenticated": total_runs - anonymous,
                "success_rate": success_rate,
                "failure_rate": failure_rate,
                "delta_total": _delta(total_runs, prev, "runs", "total"),
                "delta_success_rate": (
                    round(success_rate - prev_sr, 4)
                    if success_rate is not None and prev_sr is not None
                    else None
                ),
            },
            "conversions": {
                "anon_to_registered": converted,
                "conversion_rate": conversion_rate,
                "delta_anon_to_registered": _delta(converted, prev, "conversions", "anon_to_registered"),
                "delta_conversion_rate": (
                    round(conversion_rate - prev_cr, 4)
                    if conversion_rate is not None and prev_cr is not None
                    else None
                ),
            },
            "feedback": {
                "total": feedback_count,
                "delta_total": _delta(feedback_count, prev, "feedback", "total"),
            },
        }

        db.monthly_reports.replace_one({"_id": period_id}, report, upsert=True)
        print(f"Monthly report generated: {period_id} (triggered_by={triggered_by})")
    finally:
        client.close()
