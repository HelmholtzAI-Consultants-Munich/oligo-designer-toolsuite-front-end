    import os
    from flask import Flask
    from flask_cors import CORS
    from extensions import mongo
    from routes.auth import init_login_manager
    from routes import register_blueprints

    def create_app():
        app = Flask(__name__)
        app.secret_key = "bi_oligo_gizemi_var"
        app.config["MONGO_URI"] = "mongodb://localhost:27017/oligo_db"

        # Set up the uploads directory (always exists)
        UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
        app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

        # Initialize Flask extensions and login manager (with user_loader)
        mongo.init_app(app)
        init_login_manager(app)
        CORS(app, supports_credentials=True)

        # Register all blueprints from the routes package
        register_blueprints(app)

        return app

    if __name__ == "__main__":
        app = create_app()
        app.run(debug=True)