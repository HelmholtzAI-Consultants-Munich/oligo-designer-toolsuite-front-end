"""
Authentication and User Management Blueprint for Flask Application.

This module provides all authentication-related endpoints and helpers, including user registration,
login, logout, authentication status checking, and management of anonymous sessions for guest users.

Main features:
    - User registration with password hashing
    - Secure login with session and data migration
    - Logout endpoint
    - Auth status check endpoint for frontend
    - Anonymous session tracking and data directory creation for unauthenticated users

:requires: Flask, Flask-Login, Werkzeug security, MongoDB (via extensions.mongo)
"""

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
    Flask-Login User class wrapper for MongoDB user documents.

    :param user_doc: The MongoDB user document.
    :type user_doc: dict

    :ivar id: User ID, as a string (ObjectId).
    :ivar email: User's email address.
    """
    def __init__(self, user_doc):
        self.id = str(user_doc['_id'])
        self.email = user_doc['email']

def init_login_manager(app):
    """
    Initialize Flask-Login's LoginManager and user loader.

    :param app: The Flask application instance.
    :type app: flask.Flask
    :returns: The initialized LoginManager object.
    :rtype: flask_login.LoginManager

    The user_loader loads a user from the database using their ObjectId.
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
    Register a new user.

    Accepts email and password from the frontend, checks if the user exists, hashes the password,
    creates a new user document in MongoDB, makes a user-specific data directory, and logs the user in.

    :request json email: Email address for registration.
    :type email: str
    :request json password: Password (plain text, will be hashed).
    :type password: str

    :returns: JSON message for success or error.
    :rtype: flask.Response

    :raises: HTTP 400 if email or password missing; 409 if user already exists.

    Workflow:
      1. Parse and validate input.
      2. Check if email is already registered.
      3. Hash password.
      4. Insert new user into MongoDB.
      5. Create a user-specific data directory.
      6. Log the new user in.
      7. Respond with success or error.
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
    Authenticate user and log them in.

    Checks email and password against MongoDB, logs in if valid, ensures user data directory exists,
    and migrates any anonymous runs/data to the new user account.

    :request json email: User's email.
    :type email: str
    :request json password: User's password.
    :type password: str

    :returns: JSON message for success or error.
    :rtype: flask.Response

    :raises: HTTP 401 if credentials are invalid.

    Workflow:
      1. Find user by email.
      2. Verify password.
      3. Log user in.
      4. Ensure data directory exists.
      5. If anonymous session, migrate runs/data to user and clear session_id.
      6. Respond with success or error.
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
    Check if current user is authenticated.

    Returns user info if authenticated, otherwise just `authenticated: False`.

    :returns: JSON containing authentication status and user info (if authenticated).
    :rtype: flask.Response
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

    :returns: JSON message confirming logout.
    :rtype: flask.Response
    """
    logout_user()
    return jsonify({"message": "Logged out"}), 200

# ---- Before Request Handler to Assign Anonymous Session ID ----
@auth_bp.before_app_request
def assign_session_id():
    """
    Assign a unique session_id to anonymous users for tracking their runs
    and data before they log in or register.

    If the current user is not authenticated and session does not have a 'session_id',
    assigns a new UUID as session_id and creates a directory for anonymous user data.

    :modifies session: Adds 'session_id' to Flask session for anonymous user tracking.
    """
    if not current_user.is_authenticated and 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
        # Create directory for anonymous user data associated with this session
        user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session['session_id'])
        os.makedirs(user_dir, exist_ok=True)