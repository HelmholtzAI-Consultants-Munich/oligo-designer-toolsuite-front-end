"""Celery worker task handler tests.

Notes:
    Lifecycle hooks must persist status transitions to MongoDB so the frontend can
    poll run status and users see accurate progress without querying Celery directly.
"""

from types import SimpleNamespace
from unittest.mock import patch

from backend.worker.handlers import PipelineTask


def test_pipeline_task_handlers_update_run_status():
    """Status transitions are written to the run document by task id.

    Notes:
        This lets the frontend reflect the current state without needing to
        query Celery directly.
    """
    task = PipelineTask()
    update_result = SimpleNamespace(matched_count=1)

    with patch("backend.worker.handlers._update_run_by_task_id", return_value=update_result) as update:
        task.before_start("task-1", (), {})
        task.on_success(None, "task-1", (), {})

    assert update.call_args_list[0].args == ("task-1", {"status": "started"})
    assert update.call_args_list[1].args == ("task-1", {"status": "success"})
