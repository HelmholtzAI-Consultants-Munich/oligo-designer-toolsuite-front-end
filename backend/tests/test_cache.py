"""FileCacheProxy tests."""

import pytest
from dogpile.cache import make_region
from dogpile.cache.api import NO_VALUE

from backend.cache import FileCacheProxy
from backend.config import Config


@pytest.fixture
def region():
    """Provide a real dogpile CacheRegion wrapping an isolated test Redis database with FileCacheProxy.

    Notes:
        Database 15 keeps this from sharing state with the dev/production
        broker or other test suites.

    Yields:
        CacheRegion -- configured region with FileCacheProxy applied
    """
    test_redis_uri = f"{Config.REDIS_URI.rstrip('/')}/15"
    cache_region = make_region().configure(
        "dogpile.cache.redis",
        arguments={
            "url": test_redis_uri,
            "redis_expiration_time": 3600,
            "distributed_lock": True,
            "thread_local_lock": False,
        },
        wrap=[FileCacheProxy],
    )
    cache_region.backend.proxied.writer_client.flushdb()
    yield cache_region
    cache_region.backend.proxied.writer_client.flushdb()


def test_set_then_get_round_trips_existing_file(region, tmp_path):
    """A cached Path pointing at an existing file round-trips through set and get.

    Arguments:
        region {CacheRegion} -- dogpile region under test
        tmp_path {Path} -- pytest-provided temp directory
    """
    cached_file = tmp_path / "output.txt"
    cached_file.write_text("data")

    region.set("key", cached_file)

    assert region.get("key") == cached_file


def test_set_then_get_round_trips_existing_directory(region, tmp_path):
    """A cached Path pointing at an existing directory round-trips through set and get.

    Arguments:
        region {CacheRegion} -- dogpile region under test
        tmp_path {Path} -- pytest-provided temp directory
    """
    cached_dir = tmp_path / "output_dir"
    cached_dir.mkdir()

    region.set("key", cached_dir)

    assert region.get("key") == cached_dir


def test_get_serialized_evicts_key_when_path_no_longer_exists(region, tmp_path):
    """A cached path removed from disk is treated as a miss and purged from the cache.

    Arguments:
        region {CacheRegion} -- dogpile region under test
        tmp_path {Path} -- pytest-provided temp directory

    Notes:
        Checking the raw backend after the first get() proves the stale entry
        was actually deleted, not merely filtered on each read.
    """
    cached_file = tmp_path / "output.txt"
    cached_file.write_text("data")
    region.set("key", cached_file)
    cached_file.unlink()

    assert region.get("key") is NO_VALUE
    assert region.backend.proxied.get_serialized("key") is NO_VALUE


def test_set_serialized_deletes_previous_path_when_replaced(region, tmp_path):
    """Associating a key with a new path deletes the file or directory it previously pointed to.

    Arguments:
        region {CacheRegion} -- dogpile region under test
        tmp_path {Path} -- pytest-provided temp directory
    """
    first_path = tmp_path / "first"
    first_path.mkdir()
    second_path = tmp_path / "second"
    second_path.mkdir()
    region.set("key", first_path)

    region.set("key", second_path)

    assert not first_path.exists()
    assert second_path.exists()
    assert region.get("key") == second_path


def test_set_serialized_raises_when_new_path_does_not_exist(region, tmp_path):
    """Caching a path that does not exist on disk is rejected.

    Arguments:
        region {CacheRegion} -- dogpile region under test
        tmp_path {Path} -- pytest-provided temp directory
    """
    missing_path = tmp_path / "does-not-exist"

    with pytest.raises(ValueError, match="does not exist"):
        region.set("key", missing_path)


def test_delete_removes_cache_entry_and_underlying_path(region, tmp_path):
    """Deleting a key removes both the cache entry and the file or directory it pointed to.

    Arguments:
        region {CacheRegion} -- dogpile region under test
        tmp_path {Path} -- pytest-provided temp directory
    """
    cached_file = tmp_path / "output.txt"
    cached_file.write_text("data")
    region.set("key", cached_file)

    region.delete("key")

    assert not cached_file.exists()
    assert region.get("key") is NO_VALUE


def test_get_raises_not_implemented(region):
    """The non-serialized get() method always raises NotImplementedError.

    Arguments:
        region {CacheRegion} -- dogpile region under test

    Notes:
        get() and set() behave identically (both always raise) — this covers
        the read side of the interface, while test_set_raises_not_implemented
        covers the write side.
    """
    with pytest.raises(NotImplementedError):
        region.backend.get("key")


def test_set_raises_not_implemented(region, tmp_path):
    """The non-serialized set() method always raises NotImplementedError.

    Arguments:
        region {CacheRegion} -- dogpile region under test
        tmp_path {Path} -- pytest-provided temp directory
    """
    with pytest.raises(NotImplementedError):
        region.backend.set("key", tmp_path)
