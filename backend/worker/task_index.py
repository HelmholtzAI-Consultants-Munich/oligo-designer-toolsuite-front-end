# This file defines the Celery tasks available.
# The Tasks definition is in this separate file to avoid importing the worker's dependencies.


class Tasks:
    RUN_PIPELINE = "backend.worker.tasks.run_pipeline"
    RUN_GENOMIC_REGION_GENERATOR = "backend.worker.tasks.run_genomic_region_generator"
    FETCH_DROPDOWN_OPTIONS = "backend.worker.tasks.fetch_dropdown_options"
