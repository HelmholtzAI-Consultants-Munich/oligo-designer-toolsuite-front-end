from celery import Celery
from celery.signals import task_prerun
from pymongo import MongoClient

from backend.config import CeleryConfig, Config
from backend.worker.task_index import TASK_ROOT

app = Celery()
app.config_from_object(CeleryConfig)


@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, **kwargs):
    client = MongoClient(Config.MONGO_URI)
    db = client["oligo_db"]
    if task.priority == CeleryConfig.task_high_priority:
        # remove one high priority task ahead of all pending tasks
        db.runs.update_many(
            {"status": "pending"},
            {"$inc": {"queue_position.0": -1}},
        )
    else:
        # remove one low priority task ahead of all pending low priority tasks
        db.runs.update_many(
            {"status": "pending", "priority": "default"},
            {"$inc": {"queue_position.1": -1}},
        )


# Optional configuration, see the application user guide.
app.conf.update(
    main="worker",
    include=[TASK_ROOT],
)

if __name__ == "__main__":
    app.start()
