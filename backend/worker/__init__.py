"""Init file of the worker package. Explicitly exports the celery app."""

# Worker package
from backend.worker.celery import app

__all__ = ["app"]
