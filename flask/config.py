"""
Configuration for Helmholtz AAI OAuth2/OIDC Integration.

This module contains all configuration settings for integrating with the Helmholtz AAI
authentication and authorization infrastructure using OAuth2/OIDC protocol.

Environment Variables Required:
    HELMHOLTZ_CLIENT_ID: OAuth2 client ID from Helmholtz AAI registration
    HELMHOLTZ_CLIENT_SECRET: OAuth2 client secret from Helmholtz AAI registration
"""

import os
from datetime import timedelta

from kombu import Queue


class Config:
    """Base configuration class for Flask application with Helmholtz AAI settings."""

    # Flask settings
    SECRET_KEY = os.environ.get("SECRET_KEY", "bi_oligo_gizemi_var")

    # Directory settings
    # Directory shared between server and worker
    RELATIVE_DATA_ACCESS_PATH = os.environ.get("RELATIVE_DATA_ACCESS_PATH", "data-access")

    # Upload directory relative to data access path
    RELATIVE_UPLOAD_PATH = os.environ.get("RELATIVE_UPLOAD_PATH", "uploads")
    # User data directory relative to data access path
    RELATIVE_USERDATA_PATH = os.environ.get("RELATIVE_USERDATA_PATH", "user_data")

    # Make sessions persistent (90 days) for anonymous users
    PERMANENT_SESSION_LIFETIME = timedelta(days=90)
    # Remember me cookie duration (90 days) for authenticated users
    REMEMBER_COOKIE_DURATION = timedelta(days=90)

    # Session cookie security settings
    SESSION_COOKIE_SECURE = True  # Only send session cookies over HTTPS
    SESSION_COOKIE_SAMESITE = "Lax"  # CSRF protection for session cookies

    # Remember me cookie security settings
    REMEMBER_COOKIE_SECURE = True  # Only send remember me cookies over HTTPS
    REMEMBER_COOKIE_SAMESITE = "Lax"  # CSRF protection for remember me cookies

    # MongoDB settings
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/oligo_db")

    # Helmholtz AAI OAuth2/OIDC settings (Testing/Development instance)
    HELMHOLTZ_DISCOVERY_URL = "https://login-dev.helmholtz.de/oauth2/.well-known/openid-configuration"
    HELMHOLTZ_AUTHORIZATION_ENDPOINT = "https://login-dev.helmholtz.de/oauth2-as/oauth2-authz"
    HELMHOLTZ_TOKEN_ENDPOINT = "https://login-dev.helmholtz.de/oauth2/token"
    HELMHOLTZ_USERINFO_ENDPOINT = "https://login-dev.helmholtz.de/oauth2/userinfo"
    HELMHOLTZ_REVOCATION_ENDPOINT = "https://login-dev.helmholtz.de/oauth2/revoke"
    HELMHOLTZ_ISSUER = "https://login-dev.helmholtz.de/oauth2"

    # OAuth2 client credentials (from environment)
    HELMHOLTZ_CLIENT_ID = os.environ.get("HELMHOLTZ_CLIENT_ID")
    HELMHOLTZ_CLIENT_SECRET = os.environ.get("HELMHOLTZ_CLIENT_SECRET")

    # OAuth2 settings
    HELMHOLTZ_SCOPE = "openid profile email"
    HELMHOLTZ_REDIRECT_URI = "http://localhost:5000/auth/callback"

    @staticmethod
    def validate_oauth_config():
        """
        Validate that required OAuth configuration is present.

        :raises ValueError: If required OAuth credentials are missing.
        """
        if not Config.HELMHOLTZ_CLIENT_ID:
            raise ValueError("HELMHOLTZ_CLIENT_ID environment variable is required")
        if not Config.HELMHOLTZ_CLIENT_SECRET:
            raise ValueError("HELMHOLTZ_CLIENT_SECRET environment variable is required")

    # Celery settings
    # see https://github.com/celery/celery/issues/7309
    class CeleryConfig:
        broker_url: str = os.environ.get("CELERY_BROKER", "pyamqp://guest@localhost//")
        result_backend: str = os.environ.get("CELERY_MONGO_URI", "mongodb://localhost:27017/")
        task_track_started: bool = True
        task_compression: str = "zlib"
        result_compression: str = "zlib"
        result_expires: timedelta = timedelta(weeks=1)  # non-polled results will be dropped
        worker_send_task_events: bool = True  # enable events to be monitored by Flower
        task_queues = (
            Queue("priority"),
            Queue("standard"),
        )

    CELERY_CONFIG = CeleryConfig()
