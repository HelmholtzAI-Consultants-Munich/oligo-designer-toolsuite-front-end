from typing import Any
from celery import Celery

from .runners.pipeline_runner import PipelineRunner
from .celery import app

@app.task(bind=True)
def run_pipeline(self: Celery.Task, pipeline_name: str, form_data: Any, upload_path: str, uploaded_files: bytes | None) -> bytes | None:
    runner = PipelineRunner(pipeline_name, task=self)
    return runner.run(form_data, upload_path, uploaded_files)