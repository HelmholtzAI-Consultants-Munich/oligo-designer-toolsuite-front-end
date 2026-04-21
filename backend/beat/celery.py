from celery import Celery, signature
from celery.schedules import crontab

from backend.config import CeleryConfig
from backend.worker.task_index import Tasks

app = Celery()
app.config_from_object(CeleryConfig)

MIDNIGHT_CRON = crontab(minute=0, hour=0)


@app.on_after_finalize.connect  # type: ignore
def setup(sender, **kwargs):
    sender.add_periodic_task(
        MIDNIGHT_CRON,
        signature(Tasks.FETCH_DROPDOWN_OPTIONS),
        name="fetch-dropdown-options-task",
    )


if __name__ == "main":
    app.start()
