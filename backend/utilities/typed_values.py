from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import SplitResult, urlsplit, urlunsplit

from werkzeug.utils import safe_join

PATH_STORAGE_KIND = "pathlib.Path/v1"


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)


def serialize_path(path: Path) -> dict[str, Any]:
    """Serialize a pathlib.Path to a structured Mongo-safe representation."""
    return {
        "kind": PATH_STORAGE_KIND,
        "parts": list(path.parts),
    }


def deserialize_path(path_value: dict[str, Any] | None) -> Path | None:
    """Deserialize a structured path representation."""
    if not isinstance(path_value, dict):
        return None
    if path_value.get("kind") != PATH_STORAGE_KIND:
        return None
    parts = path_value.get("parts")
    if not isinstance(parts, list) or not parts:
        return None
    if not all(isinstance(part, str) for part in parts):
        return None
    return Path(*parts)


def path_for_display(path_value: dict[str, Any] | None) -> str:
    """Convert a structured path representation to string for API output."""
    path = deserialize_path(path_value)
    return str(path) if path else ""


def timestamp_for_display(value: datetime | None, separator: str = " ") -> str:
    """Format a datetime for display."""
    if value is None:
        return ""
    return value.strftime(f"%Y-%m-%d{separator}%H-%M-%S")


def timestamp_to_iso(value: datetime) -> str:
    """Convert supported timestamp values to ISO format for API output."""
    timestamp = value
    if timestamp is not None:
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        return timestamp.isoformat()

    return ""


def safe_join_under(base_dir: Path, requested_path: str) -> Path | None:
    """Safely join user-provided file names under a base directory."""
    joined = safe_join(str(base_dir), requested_path)
    if joined is None:
        return None

    resolved_base = base_dir.resolve(strict=False)
    resolved_target = Path(joined).resolve(strict=False)

    if not resolved_target.is_relative_to(resolved_base):
        return None

    return resolved_target


def sanitize_relative_redirect_path(raw_url: str | None) -> str | None:
    """Allow only relative frontend redirect paths and normalize them."""
    if raw_url is None:
        return None

    stripped = raw_url.strip()
    if not stripped:
        return None

    parsed = urlsplit(stripped)
    if parsed.scheme or parsed.netloc:
        return None

    normalized = PurePosixPath("/" + parsed.path.lstrip("/"))
    if ".." in normalized.parts:
        return None

    path = str(normalized) if str(normalized) else "/"
    return urlunsplit(("", "", path, parsed.query, ""))


def parse_http_url(url_value: str | None) -> SplitResult | None:
    """Parse and validate HTTP(S) URL values."""
    if not url_value:
        return None

    parsed = urlsplit(url_value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    return parsed
