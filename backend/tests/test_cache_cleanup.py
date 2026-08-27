"""Tests for the periodic file cache cleanup task."""

import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from backend.worker.tasks import cleanup_cache_dirs

GRACE_HOURS = 24
OLD_MTIME = time.time() - (GRACE_HOURS + 1) * 3600


def age(path: Path) -> None:
    """Sets the modification time of a path beyond the cleanup grace period.

    Arguments:
        path {pathlib.Path} -- The file or directory to age.
    """
    os.utime(path, times=(OLD_MTIME, OLD_MTIME))


@pytest.fixture
def cache_root(tmp_path: Path) -> Path:
    """Builds a file cache directory containing referenced and orphaned entries.

    Layout:
        ensembl/referenced.fa       -- referenced file, must be kept
        ensembl/orphan.fa           -- old orphaned file, must be deleted
        ensembl/fresh.fa            -- orphaned file within the grace period, must be kept
        generated/referenced_dir/   -- referenced directory, must be kept
        generated/orphan_dir/       -- old orphaned directory, must be deleted

    Arguments:
        tmp_path {pathlib.Path} -- The temporary directory to build the cache in.

    Returns:
        pathlib.Path -- The path to the built cache root directory.
    """
    root = tmp_path / "cache"
    (root / "ensembl").mkdir(parents=True)
    (root / "generated" / "referenced_dir").mkdir(parents=True)
    (root / "generated" / "orphan_dir").mkdir(parents=True)

    for name in ["referenced.fa", "orphan.fa", "fresh.fa"]:
        (root / "ensembl" / name).write_text(name)
    (root / "generated" / "referenced_dir" / "regions.fa").write_text("regions")
    (root / "generated" / "orphan_dir" / "regions.fa").write_text("regions")

    # Everything but `fresh.fa` predates the grace period, children before their parents
    for path in sorted(root.rglob("*"), key=lambda path: len(path.parts), reverse=True):
        if path.name != "fresh.fa":
            age(path)
    age(root)

    return root


def run_cleanup(cache_root: Path, referenced: set[Path]) -> dict[str, int]:
    """Runs the cleanup task synchronously against the passed cache root.

    Arguments:
        cache_root {pathlib.Path} -- The cache root directory to clean up.
        referenced {set[pathlib.Path]} -- The paths the file cache is pretending to reference.

    Returns:
        dict[str, int] -- The deletion counters returned by the task.
    """
    with (
        patch("backend.worker.tasks.get_cache_root", return_value=cache_root),
        patch("backend.worker.tasks.get_cached_file_paths", return_value=referenced),
        patch("backend.worker.tasks.CeleryConfig.cache_orphan_grace_hours", GRACE_HOURS),
    ):
        return cleanup_cache_dirs.run()


def test_cleanup_keeps_referenced_and_deletes_orphans(cache_root: Path):
    """Test that expired entries are deleted while referenced ones are kept"""
    referenced = {
        cache_root / "ensembl" / "referenced.fa",
        cache_root / "generated" / "referenced_dir",
    }

    result = run_cleanup(cache_root, referenced)

    assert (cache_root / "ensembl" / "referenced.fa").exists()
    assert (cache_root / "generated" / "referenced_dir" / "regions.fa").exists()
    assert not (cache_root / "ensembl" / "orphan.fa").exists()
    assert not (cache_root / "generated" / "orphan_dir").exists()
    # The orphaned directory is emptied first and then removed
    assert result == {"referenced": 2, "deleted_files": 2, "deleted_dirs": 1}


def test_cleanup_keeps_entries_within_grace_period(cache_root: Path):
    """Test that an orphaned entry is kept while it may still be in creation"""
    referenced = {cache_root / "generated" / "referenced_dir"}

    run_cleanup(cache_root, referenced)

    assert (cache_root / "ensembl" / "fresh.fa").exists()


def test_cleanup_removes_container_without_referenced_entries(cache_root: Path):
    """Test that a directory is removed once none of its entries are cached anymore"""
    referenced = {cache_root / "generated" / "referenced_dir"}
    (cache_root / "ensembl" / "fresh.fa").unlink()

    run_cleanup(cache_root, referenced)

    assert not (cache_root / "ensembl").exists()
    assert (cache_root / "generated" / "referenced_dir").exists()


def test_cleanup_without_cache_directory(tmp_path: Path):
    """Test that a missing cache directory is reported as nothing to clean up"""
    result = run_cleanup(tmp_path / "missing", set())

    assert result == {"referenced": 0, "deleted_files": 0, "deleted_dirs": 0}
