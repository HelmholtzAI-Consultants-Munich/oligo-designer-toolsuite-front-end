"""
This module defines utilities shared between the Flask server and the celery worker,
therefore it intentionally imports only from the standard library so it can be
shared without introducing cross-boundary dependencies.
"""

from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)
