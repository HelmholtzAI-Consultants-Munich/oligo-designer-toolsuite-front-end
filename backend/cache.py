"""Shared file for caching utils."""

import logging
import shutil
from pathlib import Path

from dogpile.cache import CacheRegion, make_region
from dogpile.cache.api import NO_VALUE, BackendFormatted, BackendSetType, SerializedReturnType
from dogpile.cache.backends.redis import RedisBackend
from dogpile.cache.proxy import ProxyBackend
from dogpile.cache.util import sha1_mangle_key

from backend.config import Config

logger = logging.getLogger(__name__)


def get_cache_root() -> Path:
    """Gets the root directory of the file cache.

    Returns:
        pathlib.Path -- The path to the file cache root directory.
    """
    return Path(__file__).resolve().parent / Config.RELATIVE_CACHE_PATH


class FileCacheProxy(ProxyBackend):
    """A dogpile.cache ProxyBackend that caches files and directories.

    Cached values must be pathlib.Path objects pointing to existing files or directories.
    The cache does not know how they were created, but it deletes them on eviction and
    replacement: a file or directory is deleted when its key is deleted or the same key
    is set to a new path.

    Reading a value renews its expiration, so cached files and directories expire after
    not being used for the expiration time configured on the cache backend.

    Files of invalidated or expired keys are not deleted here. The periodic
    backend.worker.tasks.cleanup_cache_dirs task removes them by comparing the files on
    disk with the paths returned by get_cached_file_paths.

    Not all dogpile.cache backends work with this proxy: it reads and writes serialized
    values, so backends that do not serialize values are not supported.
    """

    def _get_path_from_value(self, value: bytes) -> Path:
        """Unpacks and deserializes the raw cached value into a pathlib.Path.

        Arguments:
            value {bytes} -- The raw cached value, must represent a pathlib.Path.

        Notes:
            Adapted from dogpile.cache.CacheRegion._parse_serialized_from_backend, see
            https://github.com/sqlalchemy/dogpile.cache/blob/39e3c57180ce9b4f27a256ffdf31f063d54fb685/dogpile/cache/region.py#L1266.

        Raises:
            AssertionError: The underlying cache backend does not provide a deserializer.
            AssertionError: The passed value does not represent a pathlib.Path.

        Returns:
            pathlib.Path -- The deserialized path contained in the passed value.
        """
        assert self.proxied.deserializer

        _, _, bytes_payload = value.partition(b"|")
        payload = self.proxied.deserializer(bytes_payload)
        assert isinstance(payload, Path)
        return payload

    def get(self, key: str) -> BackendFormatted:
        """NOT IMPLEMENTED, the not-serializing equivalent of get_serialized.

        Notes:
            Needs to be implemented to make the Proxy compatible with cache backends
            that do not serialize values.

        Raises:
            NotImplementedError: Always.
        """
        raise NotImplementedError

    def get_serialized(self, key: str) -> SerializedReturnType:
        """Gets the associated file or directory path and renews its expiration.

        Arguments:
            key {str} -- The cache key to retrieve.

        Notes:
            If the stored path no longer exists on disk, the key is deleted from the cache and
            NO_VALUE is returned, like a cache miss.

            Reading a value renews its expiration, so an entry expires after being unused for the
            configured time instead of a fixed time after it was cached.

        Returns:
            SerializedReturnType -- The cached value representing a pathlib.Path or NO_VALUE.
        """
        if isinstance(self.proxied, RedisBackend) and (expiration_time := self.proxied.redis_expiration_time):
            # Read and renew the expiration in a single atomic call
            value = self.proxied.writer_client.getex(key, ex=expiration_time)
        else:
            value = self.proxied.get_serialized(key)
        # the Redis client types values as bytes or str, but without decode_responses it returns bytes
        if not value or not isinstance(value, bytes):
            return NO_VALUE

        # Ensure file or directory is actually present
        if not self._get_path_from_value(value).exists():
            self.proxied.delete(key)
            return NO_VALUE

        return value

    def set(self, key: str, value: BackendSetType) -> None:
        """NOT IMPLEMENTED, the not-serializing equivalent of set_serialized.

        Notes:
            Needs to be implemented to make the Proxy compatible with cache backends
            that do not serialize values.

        Raises:
            NotImplementedError: Always.
        """
        raise NotImplementedError

    def _delete_path(self, path: Path) -> None:
        """Deletes the file or directory, if it exists.

        Arguments:
            path {pathlib.Path} -- The file or directory to delete.
        """
        if path.exists():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()

    def set_serialized(self, key: str, value: bytes) -> None:
        """Associates a cache key with a file or directory.

        Arguments:
            key {str} -- The cache key to set.
            value {bytes} -- The value to store, must represent a pathlib.Path pointing to an
                existing file or directory.

        Notes:
            If a different path is already stored under the key, that file or directory is deleted.

        Raises:
            AssertionError: The passed value does not represent a pathlib.Path.
            ValueError: The to-be-cached file or directory does not exist.
        """
        # Ensure value is valid path pointing to an actual file or directory
        path = self._get_path_from_value(value)
        if not path.exists():
            raise ValueError("The to-be-cached file or directory does not exist.")

        # If different path associated -> delete stale file or directory
        if previous_value := self.proxied.get_serialized(key):
            previous_path = self._get_path_from_value(previous_value)
            if previous_path != path:
                self._delete_path(previous_path)

        self.proxied.set_serialized(key, value)

    def delete(self, key: str) -> None:
        """Deletes the associated file or directory and removes the key from the cache.

        Arguments:
            key {str} -- The cache key to delete.

        Notes:
            Expects the backend to store serialized values, so it does not work with backends
            that do not serialize them.
        """
        if value := self.proxied.get_serialized(key):
            path = self._get_path_from_value(value)
            self._delete_path(path)
        self.proxied.delete(key)


generic_cache_region: CacheRegion = make_region().configure(
    "dogpile.cache.redis",
    arguments={
        "url": Config.REDIS_URI,
        "redis_expiration_time": Config.REDIS_GENERIC_EXPIRATION_TIME,
        "distributed_lock": True,
        "thread_local_lock": False,
        "lock_timeout": Config.REDIS_CACHE_LOCK_TIMEOUT,
    },
)
"""A generic dogpile.cache region for Python values.

Usage:
    Decorate a function with `@generic_cache_region.cache_on_arguments()` to
    cache its return value. See the dogpile.cache docs for more information.
"""


def file_cache_key_mangler(key: str) -> str:
    """Hashes a file cache key and prefixes it, so file cache keys stay enumerable.

    Arguments:
        key {str} -- The unmangled cache key.

    Notes:
        The prefix separates file cache keys from other keys in the same Redis instance
        (generic cache, Celery), so get_cached_file_paths can collect them with a SCAN.

    Returns:
        str -- The prefixed and hashed cache key.
    """
    return Config.REDIS_FILE_CACHE_KEY_PREFIX + sha1_mangle_key(key)


file_cache_region: CacheRegion = make_region(key_mangler=file_cache_key_mangler).configure(
    "dogpile.cache.redis",
    arguments={
        "url": Config.REDIS_URI,
        "redis_expiration_time": Config.REDIS_FILE_EXPIRATION_TIME,
        "distributed_lock": True,
        "thread_local_lock": False,
        "lock_timeout": Config.REDIS_CACHE_LOCK_TIMEOUT,
    },
    wrap=[FileCacheProxy],
)
"""A specialized dogpile.cache region for files and directories, see backend.cache.FileCacheProxy.

Usage:
    Decorate a function with `@file_cache_region.cache_on_arguments()` to
    cache its return value. See the dogpile.cache docs for more information.
"""


def get_cached_file_paths() -> set[Path]:
    """Collects the paths of all files and directories currently held in the file cache.

    Notes:
        Values that cannot be deserialized into a pathlib.Path are skipped, e.g.
        because a key of another cache consumer collided with our prefix.

    Returns:
        set[pathlib.Path] -- The resolved paths that the file cache still references.
    """
    file_cache_proxy = file_cache_region.backend
    assert isinstance(file_cache_proxy, FileCacheProxy)
    # read Redis directly, since reading through the proxy would renew every entry's expiration
    redis_backend = file_cache_proxy.proxied
    assert isinstance(redis_backend, RedisBackend)

    paths: set[Path] = set()
    for key in redis_backend.reader_client.scan_iter(match=f"{Config.REDIS_FILE_CACHE_KEY_PREFIX}*"):
        value = redis_backend.get_serialized(key)
        if not value or not isinstance(value, bytes):
            continue
        try:
            paths.add(file_cache_proxy._get_path_from_value(value).resolve())
        except Exception as error:
            logger.warning(f"Skipping file cache key {key!r}, its value is not a path: {error!r}")
    return paths
