from celery import Celery, signature
from celery.schedules import crontab

from backend.config import CeleryConfig
from backend.worker.task_index import Tasks

app = Celery()
app.config_from_object(CeleryConfig)

MIDNIGHT_CRON = crontab(minute=0, hour=0)
FIRST_OF_MONTH_CRON = crontab(minute=0, hour=1, day_of_month=1)


@app.on_after_finalize.connect  # type: ignore
def setup(sender, **kwargs):
    sender.add_periodic_task(
        MIDNIGHT_CRON,
        signature(Tasks.TRIGGER_DROPDOWN_OPTIONS_FETCHING),
        name="fetch-dropdown-options-task",
    )
    sender.add_periodic_task(
        FIRST_OF_MONTH_CRON,
        signature(Tasks.GENERATE_MONTHLY_REPORT),
        name="generate-monthly-report-task",
    )
    sender.add_periodic_task(
        MIDNIGHT_CRON,
        signature("backend.worker.tasks.cleanup_anonymous_data"),
        name="cleanup-anonymous-data-task",
    )


if __name__ == "main":
    app.start()
