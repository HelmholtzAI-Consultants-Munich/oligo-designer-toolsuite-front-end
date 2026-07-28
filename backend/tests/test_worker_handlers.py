"""Celery worker task handler tests.

Notes:
    Lifecycle hooks must persist status transitions to MongoDB so the frontend can
    poll run status and users see accurate progress without querying Celery directly.
"""

from unittest.mock import patch

import pytest
from celery.exceptions import TaskRevokedError

from backend.worker.handlers import PipelineTask


def test_pipeline_task_handlers_update_run_status():
    """Status transitions are written to the run document by task id.

    Notes:
        before_start delegates to start_pending_run (which also updates queue
        accounting), while on_success still writes directly via _update_run_by_task_id.
    """
    task = PipelineTask()

    with (
        patch("backend.worker.handlers.start_pending_run", return_value=True) as start_pending,
        patch("backend.worker.handlers._update_run_by_task_id") as update,
    ):
        task.before_start("task-1", (), {})
        task.on_success(None, "task-1", (), {})

    start_pending.assert_called_once_with("task-1")
    update.assert_called_once_with("task-1", {"status": "success"})


def test_pipeline_task_before_start_revokes_task_without_pending_run():
    """A task whose run is no longer pending must be revoked rather than executed.

    Notes:
        This happens when a run was cancelled or already claimed before the
        worker picked up the task.
    """
    task = PipelineTask()

    with (
        patch("backend.worker.handlers.start_pending_run", return_value=False),
        pytest.raises(TaskRevokedError),
    ):
        task.before_start("task-1", (), {})
