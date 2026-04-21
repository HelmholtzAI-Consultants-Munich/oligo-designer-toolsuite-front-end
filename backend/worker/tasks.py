import datetime
import os
import shutil
from pathlib import Path
from typing import Any

from celery import Celery
from pymongo import MongoClient

from backend.config import CeleryConfig, Config
from backend.genomic_databases import prefetch_dropdown_options
from backend.worker.celery import app
from backend.worker.pipeline_runner import PipelineRunner

ANONYMOUS_SESSIONS_COLLECTION = "anonymous_sessions"


def _get_application_db(client: MongoClient):
    return client[Config.MONGO_DB_NAME]


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


@app.task(bind=True)
def run_pipeline(
    self: Celery.Task, pipeline_name: str, form_data: Any, upload_path: str, output_path: str
) -> bool:
    runner = PipelineRunner(pipeline_name, task=self)
    return runner.run(form_data, upload_path, output_path)


@app.task(bind=True)
def fetch_dropdown_options(self: Celery.Task):
    client = MongoClient(Config.MONGO_URI)
    db = _get_application_db(client)

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
def cleanup_anonymous_data(self: Celery.Task):
    client = MongoClient(Config.MONGO_URI)
    db = _get_application_db(client)
    upload_root, userdata_root = _get_data_roots()
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=CeleryConfig.anonymous_data_retention_days)

    result = _cleanup_expired_anonymous_data(
        db=db,
        upload_root=upload_root,
        userdata_root=userdata_root,
        cutoff=cutoff,
    )
    print(f"Anonymous cleanup completed: {result}")
    return result
