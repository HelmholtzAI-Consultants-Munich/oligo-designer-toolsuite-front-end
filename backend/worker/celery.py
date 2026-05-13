from celery import Celery

from backend.config import CeleryConfig
from backend.worker import signals  # noqa: F401
from backend.worker.task_index import TASK_ROOT

app = Celery()
app.config_from_object(CeleryConfig)

# Optional configuration, see the application user guide.
app.conf.update(
    main="worker",
    include=[TASK_ROOT],
)

if __name__ == "__main__":
    app.start()
