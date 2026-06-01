import shutil
from pathlib import Path

from bson import ObjectId

from backend.extensions import db
from backend.utilities.pipeline import delete_pipeline_run_files_and_db


def _delete_file_if_tracked(path_value: str | None, root_path: str) -> None:
    if not path_value:
        return

    root = Path(root_path).resolve(strict=False)
    file_path = Path(path_value).resolve(strict=False)
    if not file_path.is_relative_to(root):
        return

    if file_path.exists() and file_path.is_file():
        file_path.unlink()


def delete_user_account_data(user_id: str, upload_root: str, userdata_root: str) -> None:
    runs = list(db.runs.find({"user_id": user_id}, {"_id": 1}))
    for run in runs:
        delete_pipeline_run_files_and_db(mongo, run["_id"])

    uploads = list(db.uploads.find({"user_id": user_id}, {"path": 1}))
    for upload in uploads:
        _delete_file_if_tracked(upload.get("path"), upload_root)
    db.uploads.delete_many({"user_id": user_id})

    db.feedback.delete_many({"user_id": user_id})
    db.legal_acceptances.delete_many({"user_id": user_id})

    user_dir = Path(userdata_root).resolve(strict=False) / user_id
    if user_dir.exists():
        shutil.rmtree(user_dir)

    db.users.delete_one({"_id": ObjectId(user_id)})
