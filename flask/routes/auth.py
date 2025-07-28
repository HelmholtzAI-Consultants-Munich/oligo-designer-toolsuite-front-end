from flask import Blueprint, request, jsonify, session, current_app
from flask_login import (
    LoginManager, UserMixin, login_user, logout_user, current_user, login_required
)
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
import os
import uuid

from extensions import mongo

auth_bp = Blueprint('auth', __name__)

# ---- User Loader ----
class User(UserMixin):
    def __init__(self, user_doc):
        self.id = str(user_doc['_id'])
        self.email = user_doc['email']

def init_login_manager(app):
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        user_doc = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if user_doc:
            return User(user_doc)
        return None

    return login_manager

# ---- Register Route ----
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    existing_user = mongo.db.users.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "User already exists"}), 409

    hashed_password = generate_password_hash(password)
    user_id = mongo.db.users.insert_one({
        "email": email,
        "password": hashed_password
    }).inserted_id

    user_dir = os.path.join(current_app.root_path, 'user_data', str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    user_doc = mongo.db.users.find_one({"_id": user_id})
    user = User(user_doc)
    login_user(user)

    return jsonify({"message": "User registered successfully"}), 201

# ---- Login Route ----
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    user_doc = mongo.db.users.find_one({"email": email})

    if user_doc and check_password_hash(user_doc["password"], password):
        user = User(user_doc)
        login_user(user)

        # Make sure user data directory exists
        user_dir = os.path.join(current_app.root_path, 'user_data', user.id)
        os.makedirs(user_dir, exist_ok=True)

        # Move runs from anon session to user, if present
        session_id = session.get('session_id')
        if session_id:
            mongo.db.runs.update_many(
                {"session_id": session_id},
                {"$set": {"user_id": user.id, "session_id": None}}
            )

        return jsonify({"message": "Logged in successfully"}), 200

    return jsonify({"error": "Invalid credentials"}), 401

# ---- Check Auth Route ----
@auth_bp.route('/api/check_auth', methods=['GET'])
def check_auth():
    if current_user.is_authenticated:
        return jsonify({
            "authenticated": True,
            "user": {
                "id": str(current_user.id),
                "email": current_user.email,
            }
        })
    return jsonify({"authenticated": False}), 200

# ---- Logout Route ----
@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out"}), 200

# ---- (Optional) Before Request: Assign session for anon ----
@auth_bp.before_app_request
def assign_session_id():
    if not current_user.is_authenticated and 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
        user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session['session_id'])
        os.makedirs(user_dir, exist_ok=True)