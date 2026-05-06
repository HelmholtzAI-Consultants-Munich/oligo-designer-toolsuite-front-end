# This file defines the Celery tasks available.
# The Tasks definition is in this separate file to avoid importing the worker's dependencies.


TASK_ROOT = "backend.worker.tasks"


class Tasks:
    RUN_PIPELINE = TASK_ROOT + ".run_pipeline"
    RUN_GENOMIC_REGION_GENERATOR = TASK_ROOT + ".run_genomic_region_generator"
    FETCH_DROPDOWN_OPTIONS = TASK_ROOT + ".fetch_dropdown_options"
    GENERATE_MONTHLY_REPORT = TASK_ROOT + ".generate_monthly_report"
