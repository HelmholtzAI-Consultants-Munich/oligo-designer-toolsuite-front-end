"""
Safe conversions between Python/pathlib values and the plain strings/dicts
that MongoDB and JSON APIs can actually store or transmit — centralized so
every route/worker serializes paths, timestamps, and user-supplied
paths/URLs the same, safe way instead of reimplementing the edge cases.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import SplitResult, urlsplit, urlunsplit

from werkzeug.utils import safe_join

PATH_STORAGE_KIND = "pathlib.Path/v1"


def serialize_path(path: Path) -> dict[str, Any]:
    """Serializes a Path into a Mongo-safe representation.

    Arguments:
        path {Path} -- the path to store.

    Notes:
        MongoDB can't store a Path object directly, so the path is stored as a
        list of parts (not a plain string) plus a "kind" tag. This lets
        deserialize_path validate the shape and reconstruct it safely rather
        than trusting an arbitrary string.

    Returns:
        dict[str, Any] -- Mongo-safe representation of the path.
    """
    return {
        "kind": PATH_STORAGE_KIND,
        "parts": list(path.parts),
    }


def deserialize_path(path_value: dict[str, Any] | None) -> Path | None:
    """Validates the shape and kind before rebuilding a Path.

    Arguments:
        path_value {dict[str, Any] | None} -- stored path representation to
        deserialize, as produced by serialize_path.

    Notes:
        path_value comes from the database and could be missing, malformed, or
        from an older/different storage format. This returns None instead of
        raising so callers can treat "no usable path" as a normal case.

    Returns:
        Path | None -- the reconstructed path, or None if it isn't valid.
    """
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
    """Formats a stored path as a display string.

    Arguments:
        path_value {dict[str, Any] | None} -- stored path representation.

    Notes:
        API responses should have a consistent string type for the frontend to
        render, not sometimes null, so this returns an empty string rather
        than None for invalid/missing paths.

    Returns:
        str -- the path as a string, or "" if there's nothing valid to show.
    """
    path = deserialize_path(path_value)
    return str(path) if path else ""


def timestamp_for_display(value: datetime | None, separator: str = " ") -> str:
    """Formats a timestamp for display without colons.

    Arguments:
        value {datetime | None} -- the timestamp to format.

    Keyword Arguments:
        separator {str} -- what to put between date and time; callers pass
        "_" when the result needs to be filename-safe. (default: {" "})

    Notes:
        Callers use this both for human-readable display and for
        filename-safe strings, and colons aren't valid in filenames on some
        platforms, so colons are deliberately avoided (unlike ISO format).

    Returns:
        str -- formatted timestamp, or "" if value is None.
    """
    if value is None:
        return ""
    return value.strftime(f"%Y-%m-%d{separator}%H-%M-%S")


def timestamp_to_iso(value: datetime | None) -> str:
    """Converts a timestamp to an ISO 8601 string, assuming UTC for naive datetimes.

    Arguments:
        value {datetime | None} -- the timestamp to format.

    Notes:
        Older records were stored before the app consistently attached
        timezone info. Without assuming UTC, those timestamps would serialize
        without a UTC offset and could be misread as local time by the
        frontend.

    Returns:
        str -- ISO 8601 timestamp, or "" if value is None.
    """
    timestamp = value
    if timestamp is not None:
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=UTC)
        return timestamp.isoformat()

    return ""


def safe_join_under(base_dir: Path, requested_path: str) -> Path | None:
    """Resolves requested_path under base_dir, re-checking that the result is still contained after safe_join.

    Arguments:
        base_dir {Path} -- the directory the result must stay under.
        requested_path {str} -- user-supplied, possibly-nested file path.

    Notes:
        requested_path comes straight from the URL and must not be able to
        escape the run's output directory via traversal sequences or symlinks
        (e.g. "../../etc/passwd").

    Returns:
        Path | None -- the resolved path, or None if it's invalid or escapes base_dir.
    """
    joined = safe_join(str(base_dir), requested_path)
    if joined is None:
        return None

    resolved_base = base_dir.resolve(strict=False)
    resolved_target = Path(joined).resolve(strict=False)

    if not resolved_target.is_relative_to(resolved_base):
        return None

    return resolved_target


def sanitize_relative_redirect_path(raw_url: str | None) -> str | None:
    """Sanitizes a redirect target down to a normalized, same-origin relative path.

    Arguments:
        raw_url {str | None} -- the redirect target as submitted by the client.

    Notes:
        Anything with a scheme/host or ".." segments is rejected, so the
        OAuth redirect parameter can't be used for an open redirect to an
        external site or to escape the frontend's own path space.

    Returns:
        str | None -- a normalized, same-origin relative path, or None if
        raw_url isn't a safe relative path.
    """
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
    """Parses and validates a string as an http(s) URL with a host.

    Arguments:
        url_value {str | None} -- the URL to validate.

    Notes:
        This is used to validate configured URLs (e.g. frontend URL, OAuth
        revocation endpoint) at the point they're read, so a misconfigured
        setting fails with a clear error immediately instead of surfacing as
        a confusing failure later when actually making the request.

    Returns:
        SplitResult | None -- the parsed URL, or None if it isn't a valid
        http(s) URL with a host.
    """
    if not url_value:
        return None

    parsed = urlsplit(url_value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    return parsed
