from celery import Celery, signature
from celery.schedules import crontab
from config import Config

app = Celery()
app.config_from_object(Config.CELERY_CONFIG)

MIDNIGHT_CRON = crontab(minute=0, hour=0)


@app.on_after_finalize.connect
def setup(sender, **kwargs):
    sender.add_periodic_task(
        MIDNIGHT_CRON,
        signature("worker.tasks.fetch_dropdown_options", args=(Config.MONGO_URI,)),
        name="fetch-dropdown-options-task",
    )


if __name__ == "main":
    app.start()
