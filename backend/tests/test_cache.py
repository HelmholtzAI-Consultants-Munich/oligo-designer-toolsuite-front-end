"""Tests for the file cache region, requires a running Redis instance."""

from pathlib import Path

import pytest
from dogpile.cache.api import NO_VALUE

from backend.cache import (
    file_cache_key_mangler,
    file_cache_region,
    get_cached_file_paths,
    get_file_cache_redis_backend,
)
from backend.config import Config

CACHE_KEY = "test-file-cache-entry"


@pytest.fixture
def cached_file(tmp_path: Path):
    """Caches a file under a test key and removes it from the cache afterwards.

    Arguments:
        tmp_path {pathlib.Path} -- The temporary directory to create the file in.

    Yields:
        pathlib.Path -- The path to the cached file.
    """
    path = tmp_path / "cached.txt"
    path.write_text("content")
    file_cache_region.set(CACHE_KEY, path)

    yield path

    file_cache_region.delete(CACHE_KEY)


def get_client():
    """Returns the Redis client the file cache region writes to.

    Returns:
        redis.StrictRedis -- The client of the file cache region's Redis backend.
    """
    return get_file_cache_redis_backend().reader_client


def test_cached_path_is_listed(cached_file: Path):
    """Test that a cached path is collected from Redis"""
    assert cached_file.resolve() in get_cached_file_paths()


def test_reading_renews_the_expiration(cached_file: Path):
    """Test that reading a cached entry resets its expiration"""
    key = file_cache_key_mangler(CACHE_KEY)
    client = get_client()
    client.expire(key, 10)

    assert file_cache_region.get(CACHE_KEY) == cached_file
    assert client.ttl(key) == Config.REDIS_FILE_EXPIRATION_TIME


def test_listing_cached_paths_does_not_renew_the_expiration(cached_file: Path):
    """Test that collecting the cached paths leaves the expiration untouched

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
    """Test that a cached entry is dropped once its file is gone"""
    cached_file.unlink()

    assert file_cache_region.get(CACHE_KEY) is NO_VALUE
    assert get_client().exists(file_cache_key_mangler(CACHE_KEY)) == 0


def test_malformed_value_is_skipped():
    """Test that a file cache key without a path value does not break collecting the paths"""
    key = f"{Config.REDIS_FILE_CACHE_KEY_PREFIX}malformed-test-entry"
    client = get_client()
    client.set(key, b"not a dogpile value")

    try:
        get_cached_file_paths()
    finally:
        client.delete(key)
