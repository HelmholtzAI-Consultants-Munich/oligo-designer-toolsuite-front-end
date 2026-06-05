import re
from datetime import datetime
from typing import Any


def to_bool(val):
    return True if str(val).lower() == "true" else False


def to_int(val):
    try:
        return int(val)
    except Exception:
        return val


def to_null(val):
    return None if val == "" or str(val).lower() == "null" else val


def parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def split_commas_and_newlines(val):
    lines = [line.strip() for line in re.split(",|\n", val) if line.strip()]
    return lines


def split_on_newline(s):
    if "\n" in s:
        result = []
        parts = s.split("\n")
        for i, part in enumerate(parts):
            if i > 0:
                result.append("\n")
            result.append(part)
        return result
    else:
        return [s]
