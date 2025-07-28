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

# ---- User Loader and User Class ----
class User(UserMixin):
    """
    User class for Flask-Login that wraps a user document from MongoDB.
    """
    def __init__(self, user_doc):
        self.id = str(user_doc['_id'])
        self.email = user_doc['email']

def init_login_manager(app):
    """
    Initialize the Flask-Login LoginManager with the app and define the user loader.
    """
    login_manager = LoginManager()
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        # Load user document from MongoDB by ObjectId and return User instance
        user_doc = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        if user_doc:
            return User(user_doc)
        return None

    return login_manager

# ---- Register Route ----
@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Handle user registration by accepting email and password,
    creating a new user in the database, initializing user data directory,
    and logging the user in.
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    # Validate input
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    # Check if user already exists
    existing_user = mongo.db.users.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "User already exists"}), 409

    # Hash the password before storing
    hashed_password = generate_password_hash(password)

    # Insert new user document
    user_id = mongo.db.users.insert_one({
        "email": email,
        "password": hashed_password
    }).inserted_id

    # Create user-specific data directory
    user_dir = os.path.join(current_app.root_path, 'user_data', str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    # Retrieve user document and log in the user
    user_doc = mongo.db.users.find_one({"_id": user_id})
    user = User(user_doc)
    login_user(user)

    return jsonify({"message": "User registered successfully"}), 201

# ---- Login Route ----
@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Authenticate user by email and password, log them in,
    create user data directory, and migrate any anonymous session runs
    to the authenticated user.
    """
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    # Find user document by email
    user_doc = mongo.db.users.find_one({"email": email})

    # Verify password hash and authenticate
    if user_doc and check_password_hash(user_doc["password"], password):
        user = User(user_doc)
        login_user(user)

        # Ensure user data directory exists
        user_dir = os.path.join(current_app.root_path, 'user_data', user.id)
        os.makedirs(user_dir, exist_ok=True)

        # If there is an anonymous session, migrate runs to this user and clear session_id
        session_id = session.get('session_id')
        if session_id:
            mongo.db.runs.update_many(
                {"session_id": session_id},
                {"$set": {"user_id": user.id, "session_id": None}}
            )

        return jsonify({"message": "Logged in successfully"}), 200

    # Authentication failed
    return jsonify({"error": "Invalid credentials"}), 401

# ---- Check Authentication Status Route ----
@auth_bp.route('/api/check_auth', methods=['GET'])
def check_auth():
    """
    Check if the current user is authenticated and return user info if so.
    """
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
    """
    Log out the current authenticated user.
    """
    logout_user()
    return jsonify({"message": "Logged out"}), 200

# ---- Before Request Handler to Assign Anonymous Session ID ----
@auth_bp.before_app_request
def assign_session_id():
    """
    Assign a unique session_id to anonymous users for tracking their runs
    and data before they log in or register.
    """
    if not current_user.is_authenticated and 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
        # Create directory for anonymous user data associated with this session
        user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session['session_id'])
        os.makedirs(user_dir, exist_ok=True)