"""Tests for the periodic file cache cleanup task."""

import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from backend.worker.tasks import cleanup_cache_dirs

GRACE_HOURS = 24
NOW = time.time()
OLD_CHANGE_TIME = NOW - (GRACE_HOURS + 1) * 3600
FRESH_FILE_NAME = "fresh.fa"


def fake_changed_at(path: Path) -> float:
    """Returns an old change time for every path except the fresh file.

    Arguments:
        path {pathlib.Path} -- The path whose change time is requested.

    Returns:
        float -- The fake change timestamp.
    """
    return NOW if path.name == FRESH_FILE_NAME else OLD_CHANGE_TIME


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

    for name in ["referenced.fa", "orphan.fa", FRESH_FILE_NAME]:
        (root / "ensembl" / name).write_text(name)
    (root / "generated" / "referenced_dir" / "regions.fa").write_text("regions")
    (root / "generated" / "orphan_dir" / "regions.fa").write_text("regions")

    return root


def run_cleanup(cache_root: Path, referenced: set[Path], changed_at=fake_changed_at) -> dict[str, int]:
    """Runs the cleanup task synchronously against the passed cache root.

    Arguments:
        cache_root {pathlib.Path} -- The cache root directory to clean up.
        referenced {set[pathlib.Path]} -- The paths the file cache is pretending to reference.
        changed_at {Callable | None} -- Replacement for the change time lookup, None uses the real one.

    Returns:
        dict[str, int] -- The counters returned by the task.
    """
    with (
        patch("backend.worker.tasks.get_cache_root", return_value=cache_root),
        patch("backend.worker.tasks.get_cached_file_paths", return_value=referenced),
        patch("backend.worker.tasks.CeleryConfig.cache_orphan_grace_hours", GRACE_HOURS),
    ):
        if changed_at is None:
            return cleanup_cache_dirs.run()
        with patch("backend.worker.tasks._changed_at", side_effect=changed_at):
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
    assert result == {"referenced": 2, "deleted_files": 2, "deleted_dirs": 1, "failed": 0}


def test_cleanup_keeps_entries_within_grace_period(cache_root: Path):
    """Test that an orphaned entry is kept while it may still be in creation"""
    referenced = {cache_root / "generated" / "referenced_dir"}

    run_cleanup(cache_root, referenced)

    assert (cache_root / "ensembl" / FRESH_FILE_NAME).exists()


def test_cleanup_keeps_fresh_download_with_old_modification_time(tmp_path: Path):
    """Test that a just downloaded file is kept although its modification time is old

    Downloads set the modification time to the remote's `Last-Modified` date.
    """
    root = tmp_path / "cache"
    download = root / "ensembl" / "genome.fa.gz"
    download.parent.mkdir(parents=True)
    download.write_text("genome")
    os.utime(download, times=(NOW, OLD_CHANGE_TIME - 365 * 86400))

    run_cleanup(root, set(), changed_at=None)

    assert download.exists()


def test_cleanup_removes_container_without_referenced_entries(cache_root: Path):
    """Test that a directory is removed once none of its entries are cached anymore"""
    referenced = {cache_root / "generated" / "referenced_dir"}
    (cache_root / "ensembl" / FRESH_FILE_NAME).unlink()

    run_cleanup(cache_root, referenced)

    assert not (cache_root / "ensembl").exists()
    assert (cache_root / "generated" / "referenced_dir").exists()


def test_cleanup_continues_after_entry_error(cache_root: Path):
    """Test that an inaccessible entry does not stop the cleanup of the remaining entries"""
    referenced = {cache_root / "generated" / "referenced_dir"}

    def changed_at(path: Path) -> float:
        if path.name == "orphan.fa":
            raise PermissionError("denied")
        return fake_changed_at(path)

    result = run_cleanup(cache_root, referenced, changed_at=changed_at)

    assert (cache_root / "ensembl" / "orphan.fa").exists()
    assert not (cache_root / "generated" / "orphan_dir").exists()
    assert result["failed"] == 1


def test_cleanup_ignores_symlink_escaping_root(cache_root: Path, tmp_path: Path):
    """Test that content outside of the cache root is never deleted through a symlink"""
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.txt").write_text("secret")
    (cache_root / "link").symlink_to(outside, target_is_directory=True)

    run_cleanup(cache_root, set())

    assert (outside / "secret.txt").exists()


def test_cleanup_without_cache_directory(tmp_path: Path):
    """Test that a missing cache directory is reported as nothing to clean up"""
    result = run_cleanup(tmp_path / "missing", set())

    assert result == {"referenced": 0, "deleted_files": 0, "deleted_dirs": 0, "failed": 0}
