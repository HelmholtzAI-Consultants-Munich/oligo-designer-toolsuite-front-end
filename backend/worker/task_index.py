"""This file defines the Celery tasks available.

The Tasks definition is in this separate file to avoid importing the worker's dependencies.
"""

TASK_ROOT = "backend.worker.tasks"
CALLBACK_ROOT = "backend.worker.callbacks"


class Tasks:
    RUN_PIPELINE = TASK_ROOT + ".run_pipeline"
    RUN_GENOMIC_REGION_GENERATOR = TASK_ROOT + ".run_genomic_region_generator"
    TRIGGER_DROPDOWN_OPTIONS_FETCHING = TASK_ROOT + ".trigger_dropdown_options_fetching"
    GENERATE_MONTHLY_REPORT = TASK_ROOT + ".generate_monthly_report"
    CLEANUP_ANONYMOUS_DATA = TASK_ROOT + ".cleanup_anonymous_data"
    CLEANUP_CACHE_DIRS = TASK_ROOT + ".cleanup_cache_dirs"


class Callbacks:
    PIPELINE_CHORD_ERRBACK = CALLBACK_ROOT + ".pipeline_chord_errback"
