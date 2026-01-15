import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from prometheus_flask_exporter import PrometheusMetrics

from config import Config
from extensions import mongo, oauth
from routes import register_blueprints
from routes.auth import init_login_manager


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

    # Set up the uploads directory (always exists)
    UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

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

    # Register all blueprints from the routes package
    register_blueprints(app)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(
        debug=app.config.get("DEBUG", False), host="0.0.0.0"
    )  # If debug is True, Prometheus metrics won't be available
