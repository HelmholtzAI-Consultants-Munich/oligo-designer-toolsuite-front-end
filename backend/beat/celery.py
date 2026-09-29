"""Schedules the time-based Celery tasks, which Celery Beat runs in pre-configured intervals."""

from celery import Celery, signature
from celery.schedules import crontab

from backend.config import CeleryConfig
from backend.worker.task_index import Tasks

app = Celery()
app.config_from_object(CeleryConfig)

MIDNIGHT_CRON = crontab(minute=0, hour=0)
FIRST_OF_MONTH_CRON = crontab(minute=0, hour=1, day_of_month=1)


@app.on_after_finalize.connect  # type: ignore
def setup(sender: Celery, **kwargs):
    """Sets up the tasks that Celery Beat runs regularly.

    Arguments:
        sender {celery.Celery} -- The Celery app that runs the tasks.

    Keyword Arguments:
        **kwargs {Any} -- Other arguments sent with the signal, unused.
    """
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
        signature(Tasks.CLEANUP_ANONYMOUS_DATA),
        name="cleanup-anonymous-data-task",
    )
    sender.add_periodic_task(
        MIDNIGHT_CRON,
        signature(Tasks.CLEANUP_CACHE_DIRS),
        name="cleanup-cache-dirs-task",
    )


if __name__ == "main":
    app.start()
