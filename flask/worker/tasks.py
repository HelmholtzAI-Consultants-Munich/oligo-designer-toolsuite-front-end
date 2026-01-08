from typing import Any

from celery import Celery

from .celery import app
from .runners.pipeline_runner import PipelineRunner

# TODO: instead of sending compressed archives of our uploaded files as messages in RabbitMQ and output files as results in mongodb,
# we should use some kind of shared filesystem (e.g. NFS or S3 object storage)


@app.task(bind=True)
def run_pipeline(
    self: Celery.Task, pipeline_name: str, form_data: Any, upload_path: str, output_path: str
) -> bool:
    runner = PipelineRunner(pipeline_name, task=self)
    return runner.run(form_data, upload_path, output_path)
