"""Shared file for caching utils."""

import os
import shutil
from pathlib import Path

from dogpile.cache import CacheRegion, make_region
from dogpile.cache.api import NO_VALUE, BackendFormatted, BackendSetType, SerializedReturnType
from dogpile.cache.proxy import ProxyBackend
from dogpile.cache.util import sha1_mangle_key

from backend.config import Config


def get_cache_root() -> Path:
    """Get the root directory of the file cache.

    Notes:
        The worker does not run Flask's from_prefixed_env, so the FLASK_ prefixed
        environment variable is read directly.

    Returns:
        pathlib.Path -- The path to the file cache root directory.
    """
    backend_root = Path(__file__).resolve().parent
    cache_root = backend_root / os.environ.get("FLASK_RELATIVE_CACHE_PATH", Config.RELATIVE_CACHE_PATH)
    return cache_root.resolve(strict=False)


class FileCacheProxy(ProxyBackend):
    """A dogpile.cache ProxyBackend that caches files and directories.

    Notes:
        Cached values must be pathlib.Path objects pointing to existing files or
        directories. The cache does not know how they were created but handles
        deletion upon eviction and replacement.

        Files and directories get deleted if they are explicitly removed from the
        cache or the same key is associated with a new file or directory.

        Cached files and directories expire after not being used for the expiration
        time configured on the region, since retrieving a value renews its expiration.

        If a key is invalidated or expires, the associated file or directory will
        not get deleted. This is handled externally by the periodic
        backend.worker.tasks.cleanup_cache_dirs task, which compares the files on
        disk against the paths returned by get_cached_file_paths.

        Not all cache backends provided by dogpile.cache are compatible with this Proxy
        as they may serialize values.
    """

    def _get_path_from_value(self, value: bytes) -> Path:
        """Unpacks and deserializes the raw cached value into a pathlib.Path.

        Notes:
            This was adapted from dogpile.cache.CacheRegion._parse_serialized_from_backend,
            see https://github.com/sqlalchemy/dogpile.cache/blob/39e3c57180ce9b4f27a256ffdf31f063d54fb685/dogpile/cache/region.py#L1266.

        Arguments:
            value {bytes} -- The raw cached value, must represent a pathlib.Path.

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
        """Retrieves the associated file or directory path and renews its expiration.

        Notes:
            If the cache backend contains a path to a file or directory that does
            not exist when this function is called, the value gets deleted from the
            cache and the function returns NO_VALUE, treating it like a cache miss.

            Retrieving a value renews its expiration, so that the cached file or
            directory expires after being unused for the configured expiration time
            instead of a fixed time after it was cached.

        Arguments:
            key {str} -- The cache key to retrieve.

        Returns:
            SerializedReturnType -- The cached value representing a pathlib.Path or NO_VALUE.
        """
        value = self.proxied.get_serialized(key)
        if not value:
            return value

        # Ensure file or directory is actually present
        if not self._get_path_from_value(value).exists():
            self.proxied.delete(key)
            return NO_VALUE

        if expiration_time := self.proxied.redis_expiration_time:
            self.proxied.writer_client.expire(key, expiration_time)
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
            path {Path} -- The path to the file or directory to delete.
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
            value {bytes} -- The value to associate with the key, must represent a pathlib.Path pointing to an existing file or directory.

        Notes:
            The cached return value needs to be a pathlib.Path pointing to an
            existing file or directory. If a different path is already associated
            with the passed key, it gets deleted.

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
            This expects the value to be serialized and is thus incompatible
            with backends that do not serialize cached values.
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
    },
)
"""A generic dogpile.cache region for Python values.

Usage:
    Decorate a function with `@generic_cache_region.cache_on_arguments()` to
    cache its return value. See the dogpile.cache docs for more information.
"""


def file_cache_key_mangler(key: str) -> str:
    """Hashes a file cache key and prefixes it, so file cache keys stay enumerable.

    Notes:
        The prefix separates the file cache keys from other keys in the same Redis
        instance (generic cache, Celery), so get_cached_file_paths can collect them
        with a SCAN.

    Arguments:
        key {str} -- The unmangled cache key.

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
    backend = file_cache_region.backend
    assert isinstance(backend, FileCacheProxy)

    paths: set[Path] = set()
    for key in backend.proxied.reader_client.scan_iter(match=f"{Config.REDIS_FILE_CACHE_KEY_PREFIX}*"):
        value = backend.proxied.get_serialized(key)
        if not value:
            continue
        try:
            paths.add(backend._get_path_from_value(value).resolve())
        except (AssertionError, ValueError, TypeError):
            continue
    return paths
