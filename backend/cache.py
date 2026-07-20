"""Shared file for caching utils."""

import shutil
from pathlib import Path

from dogpile.cache import CacheRegion, make_region
from dogpile.cache.api import NO_VALUE, BackendFormatted, BackendSetType, SerializedReturnType
from dogpile.cache.proxy import ProxyBackend

from backend.config import Config


class FileCacheProxy(ProxyBackend):
    """A dogpile.cache ProxyBackend that caches files and directories.

    Notes:
        Cached values must be pathlib.Path objects pointing to existing files or
        directories. The cache does not know how they were created but handles
        deletion upon eviction and replacement.

        Files and directories get deleted if they are explicitly removed from the
        cache or the same key is associated with a new file or directory.

        If a key is invalidated or expires, the associated file or directory will
        not get deleted. This needs to be handled externally, e.g. by comparing
        existing files with the paths stored in the cache backend.

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
        """Retrieves the associated file or directory path.

        Notes:
            If the cache backend contains a path to a file or directory that does
            not exist when this function is called, the value gets deleted from the
            cache and the function returns NO_VALUE, treating it like a cache miss.

        Arguments:
            key {str} -- The cache key to retrieve.

        Returns:
            SerializedReturnType -- The cached value representing a pathlib.Path or NO_VALUE.
        """
        value = self.proxied.get_serialized(key)
        # Ensure file or directory is actually present
        if value and not self._get_path_from_value(value).exists():
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

file_cache_region: CacheRegion = make_region().configure(
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
