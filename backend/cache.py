import shutil
from pathlib import Path
from typing import Annotated

from dogpile.cache import CacheRegion, make_region
from dogpile.cache.api import NO_VALUE, BackendFormatted, BackendSetType, SerializedReturnType
from dogpile.cache.proxy import ProxyBackend

from backend.config import Config


class FileCacheProxy(ProxyBackend):
    """A dogpile.cache ProxyBackend that caches files.

    Notes:
        Cached values must be pathlib.Path objects pointing to existing files or
        directories. The cache does not know how they were created but handles
        deletion upon eviction and replacement.

        Files and directories get deleted if they are explicitly removed from the
        cache or the same key is associated with a new file or directory.

        If a key is invalidated or expires, the associated file or directory will
        not get deleted. This needs to be handled externally, e.g. by comparing
        existing files with the paths stored in the cache backend.
    """

    def _get_path_from_value(self, value: bytes) -> Path:
        """Inspired by dogpile.cache.CacheRegion._parse_serialized_from_backend"""
        assert self.proxied.deserializer

        _, _, bytes_payload = value.partition(b"|")
        payload = self.proxied.deserializer(bytes_payload)
        assert isinstance(payload, Path)
        return payload

    def get(self, key: str) -> BackendFormatted:
        raise NotImplementedError

    def get_serialized(self, key: str) -> SerializedReturnType:
        """Retrieves the associated file or directory path."""
        value = self.proxied.get_serialized(key)
        # Ensure file is actually present
        if value and not self._get_path_from_value(value).exists():
            self.proxied.delete(key)
            return NO_VALUE
        return value

    def set(self, key: str, value: BackendSetType):
        raise NotImplementedError

    def _delete_associated_file(self, key):
        """Deletes the associated file or directory if it exists.

        Notes:
            The key's value should be deleted or overwritten after calling this function.
        """
        value = self.proxied.get_serialized(key)
        if value:
            path = self._get_path_from_value(value)
            if path.exists():
                if path.is_dir():
                    shutil.rmtree(path)
                else:
                    path.unlink()

    def set_serialized(self, key: str, value: bytes):
        """Associates a cache key with a file or directory.

        Notes:
            The cached return value needs to be a pathlib.Path pointing to an
            existing file or directory.
        """
        path = self._get_path_from_value(value)
        if not path.exists():
            raise ValueError("The to-be-cached file does not exist.")

        # If already present -> delete stale file
        self._delete_associated_file(key)
        self.proxied.set_serialized(key, value)

    def delete(self, key: str):
        """Deletes the associated file or directory and removes key from the cache."""
        self._delete_associated_file(key)
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


file_cache_region: Annotated[CacheRegion, "see backend.cache.FileCacheProxy"] = make_region().configure(
    "dogpile.cache.redis",
    arguments={
        "url": Config.REDIS_URI,
        "redis_expiration_time": Config.REDIS_FILE_EXPIRATION_TIME,
        "distributed_lock": True,
        "thread_local_lock": False,
    },
    wrap=[FileCacheProxy],
)
