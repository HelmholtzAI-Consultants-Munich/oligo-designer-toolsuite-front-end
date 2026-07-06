"""Converters and helper functions that are used to convert between
closely related types should be defined here
"""

from datetime import datetime
from typing import Any


def to_bool(val):
    return True if str(val).lower() == "true" else False


def to_int(val):
    try:
        return int(val)
    except Exception:
        return val


def parse_datetime(value: Any) -> datetime | None:
    """Parses the datetime from a string and returns the object if it already is a datetime object.
    For other values, or when a string is not a valid datetime, None is returned.

    Arguments:
        value {Any} -- The value the datetime is parsed from.

    Returns:
        datetime | None -- Datetime is returned, if a valid string was passed or the object was a datetime
        object already, else None is returned.
    """
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None
