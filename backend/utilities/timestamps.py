from datetime import UTC, datetime

UTC = UTC


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)
