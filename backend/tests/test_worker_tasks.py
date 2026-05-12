from unittest.mock import MagicMock, patch

import pytest

from backend.config import CeleryConfig
from backend.worker.celery import task_prerun_handler
from backend.worker.tasks import generate_monthly_report


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

    with patch("backend.worker.tasks.MongoClient", return_value=client):
        generate_monthly_report.run(target_year=2026, target_month=3)

    client.close.assert_called_once()
    db.monthly_reports.replace_one.assert_called_once()


def test_generate_monthly_report_closes_mongo_client_on_failure():
    client, db = build_mock_client()
    db.runs.aggregate.side_effect = RuntimeError("boom")

    with patch("backend.worker.tasks.MongoClient", return_value=client):
        with pytest.raises(RuntimeError, match="boom"):
            generate_monthly_report.run(target_year=2026, target_month=3)

    client.close.assert_called_once()


@pytest.mark.parametrize(
    ("priority", "expected_filter", "expected_update"),
    [
        (
            CeleryConfig.task_high_priority,
            {"status": "pending", "queue_position.0": {"$gt": 0}},
            {"$inc": {"queue_position.0": -1}},
        ),
        (
            CeleryConfig.task_default_priority,
            {
                "status": "pending",
                "priority": "default",
                "queue_position.1": {"$gt": 0},
            },
            {"$inc": {"queue_position.1": -1}},
        ),
    ],
)
def test_task_prerun_handler_never_targets_zero_queue_positions(priority, expected_filter, expected_update):
    client = MagicMock()
    db = MagicMock()
    client.__getitem__.return_value = db

    task = MagicMock()
    task.priority = priority

    with patch("backend.worker.celery.MongoClient", return_value=client):
        task_prerun_handler(task=task)

    db.runs.update_many.assert_called_once_with(expected_filter, expected_update)
