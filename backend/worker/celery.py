import datetime

from celery import Celery
from celery.signals import task_prerun

from backend.config import CeleryConfig
from backend.worker.helpers import get_worker_db

app = Celery()
app.config_from_object(CeleryConfig)

# Optional configuration, see the application user guide.
app.conf.update(
    main="worker",
    include=["backend.worker.tasks"],
)


@task_prerun.connect
def on_task_prerun(task_id, task, *args, **kwargs):
    """Record start time of pipeline tasks for heuristic timeout calculation."""
    if getattr(task, "name", "") == "backend.worker.tasks.run_pipeline":
        # datetime.datetime.utcnow() is used directly here instead of utc_now()
        # because the worker has no Flask application context.
        with get_worker_db() as db:
            db.runs.update_one({"task_id": task_id}, {"$set": {"started_at": datetime.datetime.utcnow()}})


if __name__ == "__main__":
    app.start()
