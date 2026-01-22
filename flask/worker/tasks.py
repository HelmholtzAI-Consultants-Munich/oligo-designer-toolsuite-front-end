from typing import Any

from celery import Celery

from .celery import app
from .pipeline_runner import PipelineRunner


@app.task(bind=True)
def run_pipeline(
    self: Celery.Task, pipeline_name: str, form_data: Any, upload_path: str, output_path: str
) -> bool:
    runner = PipelineRunner(pipeline_name, task=self)
    return runner.run(form_data, upload_path, output_path)
