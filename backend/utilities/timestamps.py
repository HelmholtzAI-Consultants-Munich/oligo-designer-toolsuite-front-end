from datetime import UTC, datetime

# This module intentionally imports only from the standard library so it can be
# shared between the Flask server and the Celery worker without introducing
# cross-boundary dependencies.
# TODO: restructure backend/utilities/ to make the server/worker/shared split
#       explicit in the file structure (deferred to avoid large unrelated diffs).


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)
