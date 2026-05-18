"""
Flask and Celery configuration module.

Flask configuration defaults are defined in the Config class. Environment variables
prefixed with FLASK_ override these defaults via app.config.from_prefixed_env().

Celery configuration is managed separately in CeleryConfig since it uses its own
configuration mechanism independent of Flask.

See .env.sample for available configuration options.
"""

import os
from collections.abc import Mapping
from datetime import timedelta

from dotenv import load_dotenv

# Load environment variables from .env file
# This ensures environment variables are available for both from_prefixed_env() and os.environ.get()
load_dotenv()


class Config:
    """Flask configuration with default values.

    Environment variables prefixed with FLASK_ will override these defaults
    when app.config.from_prefixed_env() is called in create_app().

    Variables also used by the Celery worker need to use os.environ.get since
    Flask's from_prefixed_env() does not get called by the worker.

    For example, to override MONGO_URI, set FLASK_MONGO_URI in your environment.
    See .env.sample for all available options.
    """

    # Flask settings
    SECRET_KEY = "change-me-in-production"

    # URL settings
    BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000")
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    # Directory settings
    RELATIVE_DATA_ACCESS_PATH = "data-access"  # Shared between server and worker
    RELATIVE_UPLOAD_PATH = "uploads"  # Relative to data access path
    RELATIVE_USERDATA_PATH = "user_data"  # Relative to data access path

    # Session settings
    PERMANENT_SESSION_LIFETIME = timedelta(days=90)
    REMEMBER_COOKIE_DURATION = timedelta(days=90)

    SESSION_COOKIE_SECURE = BACKEND_URL.startswith("https://")
    SESSION_COOKIE_SAMESITE = "Lax"
    REMEMBER_COOKIE_SECURE = BACKEND_URL.startswith("https://")
    REMEMBER_COOKIE_SAMESITE = "Lax"

    # MongoDB settings
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost/oligo_db")

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
    HELMHOLTZ_SCOPE = "openid single-logout"
    HELMHOLTZ_REDIRECT_URI = BACKEND_URL + "/auth/callback"

    # Performance Settings
    DOWNLOAD_CHUNK_SIZE = int(os.environ.get("DOWNLOAD_CHUNK_SIZE", 10 * 1024 * 1024))
    FEEDBACK_MAX_LENGTH = int(os.environ.get("FEEDBACK_MAX_LENGTH", 2000))
    GENE_COUNT_THRESHOLD = 10
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 10 * 1024 * 1024))

    # Caching Settings
    REDIS_URI = os.environ.get("REDIS_URI", "redis://localhost")
    REDIS_GENERIC_EXPIRATION_TIME = int(
        os.environ.get("REDIS_GENERIC_EXPIRATION_TIME", 3600 * 24)
    )  # in seconds (default: 1 day)
    REDIS_FILE_EXPIRATION_TIME = int(
        os.environ.get("REDIS_FILE_EXPIRATION_TIME", 3600 * 24 * 30)
    )  # in seconds (default: 30 days)
    REDIS_QUEUE_LENGTH_KEY = "pipelines:queue_lengths"

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
    def validate_oauth_config(app_config: dict):
        """Validate that required OAuth configuration is present.

        Args:
            app_config: The Flask app.config dictionary (checked after env overrides are applied).

        :raises ValueError: If required OAuth credentials are missing.
        """
        missing = []
        if not app_config.get("HELMHOLTZ_CLIENT_ID"):
            missing.append("HELMHOLTZ_CLIENT_ID")
        if not app_config.get("HELMHOLTZ_CLIENT_SECRET"):
            missing.append("HELMHOLTZ_CLIENT_SECRET")

        if missing:
            raise ValueError(f"Missing required environment variable(s): {', '.join(missing)}")


class CeleryConfig:
    """Celery configuration with default values.

    Environment variables override defaults where provided.
    This is separate from Flask configuration since Celery has its own
    configuration mechanism (see https://github.com/celery/celery/issues/7309).
    """

    broker_url: str = Config.REDIS_URI
    result_backend: str = Config.REDIS_URI
    task_track_started: bool = True
    task_compression: str = "zlib"
    result_compression: str = "zlib"
    result_expires: timedelta = timedelta(weeks=1)
    worker_send_task_events: bool = True

    # Redis task priorities
    broker_transport_options: Mapping[str, str] = {
        "queue_order_strategy": "priority",
        "sep": ":",  # queue names: celery, celery:3, celery:6, celery:9
    }
    task_default_priority = 6
    task_high_priority = 3  # in Redis, lower number means higher priority; valid range is 0-9
    worker_disable_prefetch = True
