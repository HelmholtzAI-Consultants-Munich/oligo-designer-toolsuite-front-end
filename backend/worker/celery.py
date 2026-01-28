from celery import Celery

from backend.config import Config

app = Celery()
app.config_from_object(Config.CELERY_CONFIG)

# Optional configuration, see the application user guide.
app.conf.update(
    main="worker",
    include=["backend.worker.tasks"],
)

if __name__ == "__main__":
    app.start()
