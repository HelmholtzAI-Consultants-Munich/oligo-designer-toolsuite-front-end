"""FileCacheProxy and file cache region tests, requires a running Redis instance."""

from pathlib import Path

import pytest
from dogpile.cache import make_region
from dogpile.cache.api import NO_VALUE
from dogpile.cache.backends.redis import RedisBackend

from backend.cache import (
    FileCacheProxy,
    file_cache_key_mangler,
    file_cache_region,
    get_cached_file_paths,
)
from backend.config import Config

CACHE_KEY = "test-file-cache-entry"


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
    file_cache_proxy = cache_region.backend
    assert isinstance(file_cache_proxy, FileCacheProxy)
    redis_backend = file_cache_proxy.proxied
    assert isinstance(redis_backend, RedisBackend)
    redis_backend.writer_client.flushdb()
    yield cache_region
    redis_backend.writer_client.flushdb()


@pytest.fixture
def cached_file(tmp_path: Path):
    """Cache a file in the shared file cache region under a test key and remove it afterwards.

    Arguments:
        tmp_path {Path} -- pytest-provided temp directory the file is created in

    Yields:
        Path -- the path to the cached file
    """
    path = tmp_path / "cached.txt"
    path.write_text("content")
    file_cache_region.set(CACHE_KEY, path)

    yield path

    file_cache_region.delete(CACHE_KEY)


def get_client():
    """Return the Redis client the file cache region writes to.

    Returns:
        redis.StrictRedis -- the client of the file cache region's Redis backend
    """
    file_cache_proxy = file_cache_region.backend
    assert isinstance(file_cache_proxy, FileCacheProxy)
    redis_backend = file_cache_proxy.proxied
    assert isinstance(redis_backend, RedisBackend)
    return redis_backend.reader_client


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


def test_cached_path_is_listed(cached_file: Path):
    """A cached path is collected from Redis by get_cached_file_paths.

    Arguments:
        cached_file {Path} -- file cached under CACHE_KEY
    """
    assert cached_file.resolve() in get_cached_file_paths()


def test_reading_renews_the_expiration(cached_file: Path):
    """Reading a cached entry resets its expiration to the configured file expiration time.

    Arguments:
        cached_file {Path} -- file cached under CACHE_KEY
    """
    key = file_cache_key_mangler(CACHE_KEY)
    client = get_client()
    client.expire(key, 10)

    assert file_cache_region.get(CACHE_KEY) == cached_file
    assert client.ttl(key) == Config.REDIS_FILE_EXPIRATION_TIME


def test_listing_cached_paths_does_not_renew_the_expiration(cached_file: Path):
    """Collecting the cached paths leaves the expiration untouched.

    Arguments:
        cached_file {Path} -- file cached under CACHE_KEY

    Notes:
        The cleanup task must not keep entries alive just by looking at them.
    """
    key = file_cache_key_mangler(CACHE_KEY)
    client = get_client()
    client.expire(key, 10)

    get_cached_file_paths()

    # redis-py types a reply as possibly awaitable, the sync client returns an int
    ttl = client.ttl(key)
    assert isinstance(ttl, int)
    assert ttl <= 10


def test_missing_file_invalidates_the_cache_entry(cached_file: Path):
    """A cached entry is dropped from Redis once its file is gone.

    Arguments:
        cached_file {Path} -- file cached under CACHE_KEY
    """
    cached_file.unlink()

    assert file_cache_region.get(CACHE_KEY) is NO_VALUE
    assert get_client().exists(file_cache_key_mangler(CACHE_KEY)) == 0


def test_malformed_value_is_skipped():
    """A file cache key without a path value does not break collecting the paths."""
    key = f"{Config.REDIS_FILE_CACHE_KEY_PREFIX}malformed-test-entry"
    client = get_client()
    client.set(key, b"not a dogpile value")

    try:
        get_cached_file_paths()
    finally:
        client.delete(key)
