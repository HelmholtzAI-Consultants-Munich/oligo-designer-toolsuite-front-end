from .admin import admin_bp
from .auth import auth_bp
from .runs import runs_bp
from .upload import upload_bp
from .pipelines import pipelines_bp
from .genomic import genomic_bp
from .admin import admin_bp

def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(runs_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(genomic_bp)
    app.register_blueprint(pipelines_bp)
    app.register_blueprint(admin_bp)
