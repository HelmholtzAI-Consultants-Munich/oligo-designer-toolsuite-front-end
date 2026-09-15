from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend.worker.tasks import (
    _delete_directory_if_under_root,
    _delete_file_if_under_root,
    generate_monthly_report,
)


def build_mock_client():
    client = MagicMock()
    db = MagicMock()
    client.__getitem__.return_value = db
    db.users.count_documents.return_value = 0
    db.runs.aggregate.return_value = []
    db.runs.distinct.return_value = []
    db.feedback.count_documents.return_value = 0
    db.monthly_reports.find_one.return_value = None
    return client, db


def test_generate_monthly_report_closes_mongo_client_on_success():
    client, db = build_mock_client()

    with patch("backend.database.MongoClient", return_value=client):
        generate_monthly_report.run(target_year=2026, target_month=3)

    client.close.assert_called_once()
    db.monthly_reports.replace_one.assert_called_once()


def test_generate_monthly_report_closes_mongo_client_on_failure():
    client, db = build_mock_client()
    db.runs.aggregate.side_effect = RuntimeError("boom")

    with patch("backend.database.MongoClient", return_value=client):
        with pytest.raises(RuntimeError, match="boom"):
            generate_monthly_report.run(target_year=2026, target_month=3)

    client.close.assert_called_once()


def test_delete_directory_if_under_root_removes_directory(tmp_path: Path):
    """Test that a directory including its content gets deleted"""
    directory = tmp_path / "run_output"
    directory.mkdir()
    (directory / "result.fa").write_text("result")

    assert _delete_directory_if_under_root(directory, tmp_path) == (True, True)
    assert not directory.exists()


def test_delete_file_if_under_root_removes_file(tmp_path: Path):
    """Test that a file gets deleted"""
    file = tmp_path / "upload.csv"
    file.write_text("upload")

    assert _delete_file_if_under_root(file, tmp_path) == (True, True)
    assert not file.exists()


def test_delete_helpers_keep_paths_of_unexpected_type(tmp_path: Path):
    """Test that a file passed as directory and a directory passed as file are kept"""
    directory = tmp_path / "run_output"
    directory.mkdir()
    file = tmp_path / "upload.csv"
    file.write_text("upload")

    assert _delete_file_if_under_root(directory, tmp_path) == (False, False)
    assert _delete_directory_if_under_root(file, tmp_path) == (False, False)
    assert directory.exists()
    assert file.exists()
