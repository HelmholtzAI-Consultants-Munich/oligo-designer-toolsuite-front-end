import calendar
import datetime
import os
import shutil
from logging import Logger
from pathlib import Path
from typing import Any

from bson import ObjectId
from celery.utils.log import get_task_logger
from pymongo import MongoClient

from backend.config import CeleryConfig, Config
from backend.genomic_databases import fetch_dropdown_options
from backend.worker.celery import app
from backend.worker.genomic_region_generator_runner import GenomicRegionGeneratorRunner
from backend.worker.handlers import PipelineTask

logger: Logger = get_task_logger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

ANONYMOUS_SESSIONS_COLLECTION = "anonymous_sessions"


def _get_data_roots() -> tuple[Path, Path]:
    backend_root = Path(__file__).resolve().parent.parent
    data_access_root = backend_root / os.environ.get(
        "FLASK_RELATIVE_DATA_ACCESS_PATH",
        Config.RELATIVE_DATA_ACCESS_PATH,
    )
    upload_root = data_access_root / os.environ.get(
        "FLASK_RELATIVE_UPLOAD_PATH",
        Config.RELATIVE_UPLOAD_PATH,
    )
    userdata_root = data_access_root / os.environ.get(
        "FLASK_RELATIVE_USERDATA_PATH",
        Config.RELATIVE_USERDATA_PATH,
    )
    return upload_root.resolve(strict=False), userdata_root.resolve(strict=False)


def _deserialize_path(path_value: Any) -> Path | None:
    if isinstance(path_value, Path):
        return path_value

    if isinstance(path_value, str):
        return Path(path_value) if path_value else None

    if isinstance(path_value, dict):
        parts = path_value.get("parts")
        if not isinstance(parts, list) or not parts or not all(isinstance(part, str) for part in parts):
            return None
        return Path(*parts)

    return None


def _resolve_path_under_root(path_value: Any, root: Path) -> Path | None:
    path = _deserialize_path(path_value)
    if path is None:
        return None

    path = path.resolve(strict=False)
    if not path.is_relative_to(root):
        return None

    return path


def _delete_file_if_under_root(path_value: Any, root: Path) -> tuple[bool, bool]:
    """
    Returns (can_delete_record, did_delete_file).

    can_delete_record is True when the DB record is safe to remove: either the path
    is already gone or was never valid. False when the path points to something that
    isn't a file (e.g. a directory), so the record must be kept to avoid data loss.
    """
    file_path = _resolve_path_under_root(path_value, root)
    if file_path is None:
        return False, False  # path outside root or invalid — don't touch the DB record

    if not file_path.exists():
        return True, False  # file already gone — safe to delete the DB record, nothing deleted on disk
    if not file_path.is_file():
        return False, False  # unexpected type (e.g. directory) — retain the DB record to avoid data loss

    file_path.unlink()
    return True, True  # file deleted from disk and DB record is safe to remove


def _delete_directory_if_under_root(path_value: Any, root: Path) -> tuple[bool, bool]:
    """
    Returns (can_delete_record, did_delete_directory).

    Same semantics as _delete_file_if_under_root: can_delete_record is False only
    when the path exists but is not a directory, meaning something unexpected occupies
    that path and the record should be retained.
    """
    directory = _resolve_path_under_root(path_value, root)
    if directory is None:
        return False, False  # path outside root or invalid — don't touch the DB record

    if not directory.exists():
        return True, False  # directory already gone — safe to delete the DB record, nothing deleted on disk
    if not directory.is_dir():
        return False, False  # unexpected type (e.g. a file) — retain the DB record to avoid data loss

    shutil.rmtree(directory)
    return True, True  # directory deleted from disk and DB record is safe to remove


def _partition_records_for_deletion(
    records: list[dict[str, Any]],
    path_key: str,
    root: Path,
    delete_path,
) -> tuple[list[Any], int, int]:
    """
    Returns (deletable_ids, deleted_paths, retained_records).

    Iterates records, deletes each associated path via delete_path, and separates
    records into those safe to remove from the DB (deletable_ids) and those that
    must be kept because their path couldn't be safely deleted (retained_records).
    deleted_paths counts how many files/directories were actually removed from disk.
    """
    deletable_ids: list[Any] = []
    deleted_paths = 0
    retained_records = 0

    for record in records:
        can_delete_record, deleted_path = delete_path(record.get(path_key), root)
        if can_delete_record:
            deletable_ids.append(record["_id"])
        else:
            retained_records += 1
        if deleted_path:
            deleted_paths += 1

    return deletable_ids, deleted_paths, retained_records


def _has_remaining_session_data(db, session_id: str) -> bool:
    return (
        db.runs.count_documents({"session_id": session_id}) > 0
        or db.uploads.count_documents({"session_id": session_id}) > 0
        or db.legal_acceptances.count_documents({"session_id": session_id}) > 0
    )


def _cleanup_expired_anonymous_data(db, upload_root: Path, userdata_root: Path, cutoff: datetime.datetime):
    anon_root = userdata_root / "anon"
    expired_sessions = list(
        db[ANONYMOUS_SESSIONS_COLLECTION].find(
            {"last_activity_at": {"$lt": cutoff}},
            {"_id": 1, "session_id": 1},
        )
    )

    deleted_runs = 0
    deleted_output_dirs = 0
    retained_runs = 0
    deleted_uploads = 0
    deleted_upload_files = 0
    retained_uploads = 0
    deleted_acceptances = 0
    deleted_session_dirs = 0
    deleted_sessions = 0
    retained_sessions = 0

    for session_doc in expired_sessions:
        session_id = session_doc.get("session_id")
        if not session_id:
            continue

        session_runs = list(
            db.runs.find(
                {"session_id": session_id},
                {"_id": 1, "output_path": 1},
            )
        )
        run_ids_to_delete, session_deleted_output_dirs, session_retained_runs = (
            _partition_records_for_deletion(
                session_runs,
                path_key="output_path",
                root=userdata_root,
                delete_path=_delete_directory_if_under_root,
            )
        )
        if run_ids_to_delete:
            db.runs.delete_many({"_id": {"$in": run_ids_to_delete}})

        session_uploads = list(
            db.uploads.find(
                {"session_id": session_id},
                {"_id": 1, "path": 1},
            )
        )
        upload_ids_to_delete, session_deleted_upload_files, session_retained_uploads = (
            _partition_records_for_deletion(
                session_uploads,
                path_key="path",
                root=upload_root,
                delete_path=_delete_file_if_under_root,
            )
        )
        if upload_ids_to_delete:
            db.uploads.delete_many({"_id": {"$in": upload_ids_to_delete}})

        session_acceptances = list(
            db.legal_acceptances.find(
                {"session_id": session_id},
                {"_id": 1},
            )
        )
        if session_acceptances:
            db.legal_acceptances.delete_many({"_id": {"$in": [doc["_id"] for doc in session_acceptances]}})

        deleted_runs += len(run_ids_to_delete)
        deleted_output_dirs += session_deleted_output_dirs
        retained_runs += session_retained_runs
        deleted_uploads += len(upload_ids_to_delete)
        deleted_upload_files += session_deleted_upload_files
        retained_uploads += session_retained_uploads
        deleted_acceptances += len(session_acceptances)

        if _has_remaining_session_data(db, session_id):
            retained_sessions += 1
            continue

        session_dir = (anon_root / session_id).resolve(strict=False)
        if session_dir.is_relative_to(anon_root) and session_dir.exists() and session_dir.is_dir():
            shutil.rmtree(session_dir)
            deleted_session_dirs += 1

        db[ANONYMOUS_SESSIONS_COLLECTION].delete_one({"_id": session_doc["_id"]})
        deleted_sessions += 1

    return {
        "deleted_runs": deleted_runs,
        "deleted_output_dirs": deleted_output_dirs,
        "retained_runs": retained_runs,
        "deleted_uploads": deleted_uploads,
        "deleted_upload_files": deleted_upload_files,
        "retained_uploads": retained_uploads,
        "deleted_acceptances": deleted_acceptances,
        "deleted_session_dirs": deleted_session_dirs,
        "deleted_sessions": deleted_sessions,
        "retained_sessions": retained_sessions,
    }


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


@app.task()
def trigger_dropdown_options_fetching():
    logger.debug("Updating genomic dropdown options cache")
    _ = fetch_dropdown_options()


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

        start_oid = ObjectId.from_datetime(start_dt)
        end_oid = ObjectId.from_datetime(end_dt)
        new_users = db.users.count_documents({"_id": {"$gte": start_oid, "$lt": end_oid}})

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
            "generated_at": datetime.datetime.now(datetime.UTC),
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
        logger.info(f"Monthly report generated: {period_id} (triggered_by={triggered_by})")
    finally:
        client.close()


@app.task()
def cleanup_anonymous_data() -> dict[str, int]:
    upload_root, userdata_root = _get_data_roots()
    cutoff = datetime.datetime.now(datetime.UTC) - datetime.timedelta(
        days=CeleryConfig.anonymous_data_retention_days
    )

    with MongoClient(Config.MONGO_URI) as client:
        db = client["oligo_db"]
        result = _cleanup_expired_anonymous_data(
            db=db,
            upload_root=upload_root,
            userdata_root=userdata_root,
            cutoff=cutoff,
        )

    print(f"Anonymous cleanup completed: {result}")
    return result
