"""
This module defines utilities shared between the Flask server and the celery worker,
therefore it intentionally imports only from the standard library so it can be
shared without introducing cross-boundary dependencies.
"""

import os
from datetime import UTC, datetime
from pathlib import Path


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(UTC)


def resolve_relative_root(base: Path, env_var: str, default: str) -> Path:
    """Resolves a directory configured relative to a base directory.

    Arguments:
        base {pathlib.Path} -- The directory the configured path is relative to.
        env_var {str} -- The environment variable that overrides the default.
        default {str} -- The relative path used if the environment variable is not set.

    Raises:
        ValueError: The configured path does not point to a directory inside of `base`.

    Returns:
        pathlib.Path -- The resolved directory path.
    """
    base = base.resolve(strict=False)
    root = (base / os.environ.get(env_var, default)).resolve(strict=False)
    if root == base or not root.is_relative_to(base):
        raise ValueError(f"{env_var} must point to a directory inside of {base}, got {root}.")
    return root
