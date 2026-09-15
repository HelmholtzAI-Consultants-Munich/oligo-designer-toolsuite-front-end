"""Tests for the utilities shared between the Flask server and the Celery worker."""

from pathlib import Path

import pytest

from backend.utils import resolve_relative_root

ENV_VAR = "TEST_RELATIVE_ROOT"


def test_resolve_relative_root_uses_default(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Test that the default is used if the environment variable is not set"""
    monkeypatch.delenv(ENV_VAR, raising=False)

    assert resolve_relative_root(tmp_path, ENV_VAR, "cache") == (tmp_path / "cache").resolve()


def test_resolve_relative_root_uses_environment_variable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Test that the environment variable overrides the default"""
    monkeypatch.setenv(ENV_VAR, "other")

    assert resolve_relative_root(tmp_path, ENV_VAR, "cache") == (tmp_path / "other").resolve()


@pytest.mark.parametrize("value", ["", ".", "..", "cache/../..", "/etc"])
def test_resolve_relative_root_rejects_paths_outside_of_base(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, value: str
):
    """Test that paths resolving to the base itself or outside of it are rejected"""
    monkeypatch.setenv(ENV_VAR, value)

    with pytest.raises(ValueError):
        resolve_relative_root(tmp_path, ENV_VAR, "cache")
