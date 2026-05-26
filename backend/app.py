import logging.config
import os
import time

import celery
from flask import Flask
from flask_cors import CORS
from flask_pymongo import BSONObjectIdConverter
from prometheus_flask_exporter import PrometheusMetrics

from backend.cli import register_cli_commands
from backend.config import CeleryConfig, Config
from backend.extensions import celery_app, limiter, mongo, oauth
from backend.routes import register_blueprints
from backend.routes.auth import init_login_manager
from backend.routes.error_handlers import register_error_handlers
from backend.utilities.session_activity import ANONYMOUS_SESSIONS_COLLECTION
from backend.worker.task_index import Tasks


def register_teardown_handler(app):
    @app.teardown_appcontext
    def teardown(exception=None):

        # Trigger lazy initialization of flask-limiter storage backend
        limiter_storage = limiter.limiter.storage.storage

        # Close underlying connection to avoid errors in flask-limiter destructor
        limiter_storage.close()


def ensure_mongo_indexes() -> None:
    """Create MongoDB indexes used by recurring cleanup and consent lookups."""
    mongo.db.runs.create_index(
        [("session_id", 1)],
        name="runs_session_id_idx",
    )
    mongo.db.uploads.create_index(
        [("session_id", 1)],
        name="uploads_session_id_idx",
    )
    mongo.db.legal_acceptances.create_index(
        [("session_id", 1), ("timestamp", 1)],
        name="legal_acceptances_session_timestamp_idx",
    )
    mongo.db[ANONYMOUS_SESSIONS_COLLECTION].create_index(
        [("session_id", 1)],
        name="anonymous_sessions_session_id_idx",
        unique=True,
    )
    mongo.db[ANONYMOUS_SESSIONS_COLLECTION].create_index(
        [("last_activity_at", 1)],
        name="anonymous_sessions_last_activity_at_idx",
    )


def prepare_paths(app: Flask):
    """Extract and expand relative path definitions in the app's config.

    The initial config contains relative paths which this functions expands to their full absolute paths.
    The "data access" path points to the directory assumed to be shared by the Flask server and Celery workers.
    All other relative paths are relative to this directory.
    """
    relative_data_access_path_key = "RELATIVE_DATA_ACCESS_PATH"
    relative_to_data_access_keys = ["RELATIVE_UPLOAD_PATH", "RELATIVE_USERDATA_PATH"]

    def _update_and_mkdir(relative_key: str, path: str):
        key = relative_key.split("RELATIVE_", maxsplit=1)[1]
        app.config[key] = path
        os.makedirs(path, exist_ok=True)

    data_access_path = os.path.join(app.root_path, app.config[relative_data_access_path_key])
    _update_and_mkdir(relative_data_access_path_key, data_access_path)

    for relative_key in relative_to_data_access_keys:
        path = os.path.join(data_access_path, app.config[relative_key])
        _update_and_mkdir(relative_key, path)


# TODO: investigate double execution due to server restart in development mode
def initial_dropdown_prefetch(celery_app, app):
    while True:
        try:
            app.logger.debug("Prefetching dropdown")
            celery_app.send_task(
                Tasks.TRIGGER_DROPDOWN_OPTIONS_FETCHING,
            )
            app.logger.debug("Dropdown prefetch done")
            break
        except celery.exceptions.OperationalError:
            time.sleep(2)


def create_app():
    # Configure logging before creating Flask app (as Flask docs recommend)
    # This ensures logging is configured before app.logger is accessed
    logging.config.dictConfig(Config.get_logging_config())

    app = Flask(__name__)
    PrometheusMetrics(app)

    # Register custom URL converter for MongoDB ObjectId
    app.url_map.converters["ObjectId"] = BSONObjectIdConverter

    # Load default configuration, then override with FLASK_-prefixed environment variables
    app.config.from_object(Config)
    app.config.from_prefixed_env()

    # Use the application's MongoDB for Flask-Limiter storage unless explicitly overridden.
    # This avoids in-memory rate-limit storage in production.
    app.config.setdefault("RATELIMIT_STORAGE_URI", app.config.get("MONGO_URI"))

    # Validate OAuth configuration
    try:
        Config.validate_oauth_config(app.config)
    except ValueError as e:
        app.logger.warning(f"OAuth configuration incomplete: {e}")
        app.logger.warning("Helmholtz AAI authentication will not be available.")

    # Set up directories and update config with absolute paths
    prepare_paths(app)

    # Initialize Flask extensions
    mongo.init_app(app)
    with app.app_context():
        ensure_mongo_indexes()
    limiter.init_app(app)
    init_login_manager(app)
    CORS(app, supports_credentials=True)

    # Initialize OAuth client for Helmholtz AAI
    oauth.init_app(app)
    oauth.register(
        name="helmholtz",
        client_id=app.config.get("HELMHOLTZ_CLIENT_ID"),
        client_secret=app.config.get("HELMHOLTZ_CLIENT_SECRET"),
        server_metadata_url=app.config.get("HELMHOLTZ_DISCOVERY_URL"),
        client_kwargs={
            "scope": app.config.get("HELMHOLTZ_SCOPE"),
        },
    )

    # Initialize Celery configuration
    celery_app.config_from_object(CeleryConfig)

    initial_dropdown_prefetch(celery_app, app)

    # Register all blueprints from the routes package
    register_blueprints(app)

    # Register error handlers for centralized error handling
    register_error_handlers(app)

    # Register CLI commands
    register_cli_commands(app)

    # Register Teardown Handler
    register_teardown_handler(app)

    return app


if __name__ == "__main__":
    app = create_app()
    logging.config.dictConfig(Config.get_logging_config())
    app.run(debug=True, host="0.0.0.0")
