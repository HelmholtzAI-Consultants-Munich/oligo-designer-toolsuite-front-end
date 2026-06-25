import logging

from celery import Celery

from backend.config import CeleryConfig
from backend.worker.task_index import CALLBACK_ROOT, TASK_ROOT

app = Celery()
app.config_from_object(CeleryConfig)

# Optional configuration, see the application user guide.
app.conf.update(
    main="worker",
    include=[TASK_ROOT, CALLBACK_ROOT, "backend.worker.signals"],
)

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    app.start()
