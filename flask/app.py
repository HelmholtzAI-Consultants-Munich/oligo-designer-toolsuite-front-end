import os

from config import Config
from dotenv import load_dotenv
from extensions import celery_app, mongo, oauth
from flask_cors import CORS
from prometheus_flask_exporter import PrometheusMetrics
from routes import register_blueprints
from routes.auth import init_login_manager

from flask import Flask


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


def create_app():
    app = Flask(__name__)
    PrometheusMetrics(app)

    # Load environment variables from .env file if present
    load_dotenv()

    # Load configuration from Config class
    app.config.from_object(Config)

    # Validate OAuth configuration
    try:
        Config.validate_oauth_config()
    except ValueError as e:
        app.logger.warning(f"OAuth configuration incomplete: {e}")
        app.logger.warning("Helmholtz AAI authentication will not be available.")

    # Set up directories and update config with absolute paths
    prepare_paths(app)

    # Initialize Flask extensions
    mongo.init_app(app)
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
    celery_app.config_from_object(Config.CELERY_CONFIG)

    # Register all blueprints from the routes package
    register_blueprints(app)

    return app


if __name__ == "__main__":
    app = create_app()
    # Note: If debug is True, Prometheus metrics won't be available
    app.run(debug=app.config.get("DEBUG", False), host="0.0.0.0")
