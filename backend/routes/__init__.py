"""Registers every route blueprint on the Flask app; registration order matters (see below)."""

from backend.routes.admin import admin_bp
from backend.routes.auth import auth_bp
from backend.routes.feedback import feedback_bp
from backend.routes.genomic import genomic_bp
from backend.routes.legal import legal_bp
from backend.routes.pipelines import pipelines_bp
from backend.routes.runs import runs_bp


def register_blueprints(app):
    """Registers feedback_bp before pipelines_bp — order matters here since
    Flask matches routes in registration order and /api/feedback would
    otherwise be shadowed by the catch-all /api/<pipeline_name> route.

    Args:
        app: the Flask application instance.
    """
    app.register_blueprint(auth_bp)
    app.register_blueprint(runs_bp)
    app.register_blueprint(genomic_bp)
    app.register_blueprint(legal_bp)
    app.register_blueprint(
        feedback_bp
    )  # before pipelines so /api/feedback is not caught by /api/<pipeline_name>
    app.register_blueprint(pipelines_bp)
    app.register_blueprint(admin_bp)
