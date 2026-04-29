from celery.signals import task_prerun

from backend.utilities.typed_values import utc_now
from backend.worker.helpers import get_worker_db


@task_prerun.connect
def on_task_prerun(task_id, task, *args, **kwargs):
    """Record start time of pipeline tasks for heuristic timeout calculation."""
    if getattr(task, "name", "") == "backend.worker.tasks.run_pipeline":
        with get_worker_db() as db:
            db.runs.update_one({"task_id": task_id}, {"$set": {"started_at": utc_now()}})
