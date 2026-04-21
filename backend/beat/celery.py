from celery import Celery, signature
from celery.schedules import crontab

from backend.config import CeleryConfig

app = Celery()
app.config_from_object(CeleryConfig)

MIDNIGHT_CRON = crontab(minute=0, hour=0)


@app.on_after_finalize.connect
def setup(sender, **kwargs):
    sender.add_periodic_task(
        MIDNIGHT_CRON,
        signature("backend.worker.tasks.fetch_dropdown_options"),
        name="fetch-dropdown-options-task",
    )


if __name__ == "main":
    app.start()
