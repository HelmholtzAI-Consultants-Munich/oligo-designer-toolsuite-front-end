from .admin import admin_bp
from .auth import auth_bp
from .genomic import genomic_bp
from .merfish import merfish_bp
from .oligoseq import oligoseq_bp
from .pipelines import pipelines_bp
from .scrinshot import scrinshot_bp
from .seqfish import seqfish_bp
from .upload import upload_bp


def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(pipelines_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(scrinshot_bp)
    app.register_blueprint(merfish_bp)
    app.register_blueprint(seqfish_bp)
    app.register_blueprint(genomic_bp)
    app.register_blueprint(oligoseq_bp)
    app.register_blueprint(admin_bp)
