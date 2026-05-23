from backend.routes.admin import admin_bp
from backend.routes.auth import auth_bp
from backend.routes.feedback import feedback_bp
from backend.routes.genomic import genomic_bp
from backend.routes.legal import legal_bp
from backend.routes.pipelines import pipelines_bp
from backend.routes.runs import runs_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(runs_bp)
    app.register_blueprint(genomic_bp)
    app.register_blueprint(legal_bp)
    app.register_blueprint(
        feedback_bp
    )  # before pipelines so /api/feedback is not caught by /api/<pipeline_name>
    app.register_blueprint(pipelines_bp)
    app.register_blueprint(admin_bp)
