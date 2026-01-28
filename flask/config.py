"""

This module separates default configuration values from environment variable overrides
following Flask best practices. Environment variables are loaded from .env file.

See .env.sample for available configuration options.
"""

import os
from datetime import timedelta

from dotenv import load_dotenv

# Load environment variables from .env file before class definitions
# This ensures environment variables are available when class attributes are evaluated
load_dotenv()


def _get_env(key: str, default: str | None = None) -> str | None:
    """Get environment variable with optional default value."""
    return os.environ.get(key, default)


class BaseConfig:
    """Base configuration class with default values only (no environment overrides).

    This class defines all configuration defaults. Use Config class for production
    which applies environment variable overrides.
    """

    # Flask settings
    SECRET_KEY = "change-me-in-production"

    # URL settings
    HOST_URL = os.environ.get("HOST_URL", "http://localhost:5000")
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    # Directory settings
    RELATIVE_DATA_ACCESS_PATH = "data-access"  # Shared between server and worker
    RELATIVE_UPLOAD_PATH = "uploads"  # Relative to data access path
    RELATIVE_USERDATA_PATH = "user_data"  # Relative to data access path

    # Session settings
    PERMANENT_SESSION_LIFETIME = timedelta(days=90)
    REMEMBER_COOKIE_DURATION = timedelta(days=90)

    # Cookie security settings
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "Lax"
    REMEMBER_COOKIE_SECURE = True
    REMEMBER_COOKIE_SAMESITE = "Lax"

    # MongoDB settings
    MONGO_URI = "mongodb://localhost:27017/oligo_db"

    # Helmholtz AAI OAuth2/OIDC settings (Development instance)
    HELMHOLTZ_DISCOVERY_URL = "https://login-dev.helmholtz.de/oauth2/.well-known/openid-configuration"
    HELMHOLTZ_AUTHORIZATION_ENDPOINT = "https://login-dev.helmholtz.de/oauth2-as/oauth2-authz"
    HELMHOLTZ_TOKEN_ENDPOINT = "https://login-dev.helmholtz.de/oauth2/token"
    HELMHOLTZ_USERINFO_ENDPOINT = "https://login-dev.helmholtz.de/oauth2/userinfo"
    HELMHOLTZ_REVOCATION_ENDPOINT = "https://login-dev.helmholtz.de/oauth2/revoke"
    HELMHOLTZ_ISSUER = "https://login-dev.helmholtz.de/oauth2"

    # OAuth2 client credentials (required, no defaults)
    HELMHOLTZ_CLIENT_ID = None
    HELMHOLTZ_CLIENT_SECRET = None

    # OAuth2 settings
    HELMHOLTZ_SCOPE = "openid profile email"
    HELMHOLTZ_REDIRECT_URI = HOST_URL + "/auth/callback"

    # Performance Settings
    DOWNLOAD_CHUNK_SIZE = int(os.environ.get("DOWNLOAD_CHUNK_SIZE", 10 * 1024 * 1024))

    # Celery settings (see https://github.com/celery/celery/issues/7309)
    class CeleryConfig:
        """Celery configuration with default values."""

        broker_url: str = "pyamqp://guest@localhost//"
        result_backend: str = "mongodb://localhost:27017/"
        task_track_started: bool = True
        task_compression: str = "zlib"
        result_compression: str = "zlib"
        result_expires: timedelta = timedelta(weeks=1)
        worker_send_task_events: bool = True


class Config(BaseConfig):
    """Production configuration with environment variable overrides.

    Inherits all defaults from BaseConfig and overrides with environment variables
    where provided. Environment variables are loaded from .env file.
    """

    # Flask settings
    SECRET_KEY = _get_env("SECRET_KEY", BaseConfig.SECRET_KEY)

    # Directory settings
    RELATIVE_DATA_ACCESS_PATH = _get_env("RELATIVE_DATA_ACCESS_PATH", BaseConfig.RELATIVE_DATA_ACCESS_PATH)
    RELATIVE_UPLOAD_PATH = _get_env("RELATIVE_UPLOAD_PATH", BaseConfig.RELATIVE_UPLOAD_PATH)
    RELATIVE_USERDATA_PATH = _get_env("RELATIVE_USERDATA_PATH", BaseConfig.RELATIVE_USERDATA_PATH)

    # MongoDB settings
    MONGO_URI = _get_env("MONGO_URI", BaseConfig.MONGO_URI)

    # OAuth2 client credentials (from environment, required for OAuth)
    HELMHOLTZ_CLIENT_ID = _get_env("HELMHOLTZ_CLIENT_ID")
    HELMHOLTZ_CLIENT_SECRET = _get_env("HELMHOLTZ_CLIENT_SECRET")

    # Celery configuration with environment overrides
    class CeleryConfig(BaseConfig.CeleryConfig):
        """Celery configuration with environment variable overrides."""

        broker_url: str = _get_env("CELERY_BROKER", BaseConfig.CeleryConfig.broker_url)
        result_backend: str = _get_env("CELERY_MONGO_URI", BaseConfig.CeleryConfig.result_backend)

    CELERY_CONFIG = CeleryConfig()

    @staticmethod
    def get_logging_config(debug: bool = False) -> dict:
        """Get logging configuration dictionary for Flask application.

        Args:
            debug: Whether Flask is in debug mode. If True, uses DEBUG log level,
                   otherwise uses INFO level for production.

        Returns:
            Dictionary compatible with logging.config.dictConfig()
        """
        log_level = "DEBUG" if debug else "INFO"
        return {
            "version": 1,
            "formatters": {
                "default": {
                    "format": "[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
                },
            },
            "handlers": {
                "wsgi": {
                    "class": "logging.StreamHandler",
                    "stream": "ext://flask.logging.wsgi_errors_stream",
                    "formatter": "default",
                },
            },
            "root": {
                "level": log_level,
                "handlers": ["wsgi"],
            },
        }

    @staticmethod
    def validate_oauth_config():
        """Validate that required OAuth configuration is present.

        :raises ValueError: If required OAuth credentials are missing.
        """
        missing = []
        if not Config.HELMHOLTZ_CLIENT_ID:
            missing.append("HELMHOLTZ_CLIENT_ID")
        if not Config.HELMHOLTZ_CLIENT_SECRET:
            missing.append("HELMHOLTZ_CLIENT_SECRET")

        if missing:
            raise ValueError(f"Missing required environment variable(s): {', '.join(missing)}")
