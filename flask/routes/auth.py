"""
Authentication and User Management Blueprint for Flask Application with Helmholtz AAI Integration.

This module provides all authentication-related endpoints and helpers using OAuth2/OIDC
authentication with Helmholtz AAI, including login flow, callback handling, logout with
token revocation, authentication status checking, and management of anonymous sessions for guest users.

Main features:
    - OAuth2/OIDC authentication with Helmholtz AAI
    - Secure login flow with authorization code exchange
    - User creation/update from OAuth userinfo
    - Logout with token revocation
    - Auth status check endpoint for frontend
    - Anonymous session tracking and data directory creation for unauthenticated users
    - Seamless migration of anonymous data to authenticated users

:requires: Flask, Flask-Login, Authlib, MongoDB (via extensions.mongo), requests
"""

from flask import Blueprint, request, jsonify, session, current_app, redirect, url_for, g
from flask_login import (
    LoginManager, UserMixin, login_user, logout_user, current_user, login_required
)
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
import os
import uuid
import requests
from extensions import mongo, oauth

auth_bp = Blueprint('auth', __name__)

# Cookie name for anonymous session tracking
ANONYMOUS_SESSION_COOKIE = 'anonymous_session_id'
COOKIE_MAX_AGE = 7776000  # 90 days in seconds

# ---- Cookie Helper Functions ----
def get_anonymous_session_id():
    """
    Get the anonymous session ID from the request cookie.
    
    :returns: Session ID string if present, None otherwise.
    :rtype: str or None
    """
    return request.cookies.get(ANONYMOUS_SESSION_COOKIE)

def set_anonymous_session_id(response, session_id: str):
    """
    Set the anonymous session ID cookie on the response.
    
    :param response: Flask response object to set cookie on.
    :type response: flask.Response
    :param session_id: The session ID UUID string to store.
    :type session_id: str
    """
    response.set_cookie(
        ANONYMOUS_SESSION_COOKIE,
        session_id,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite='Lax'
    )

def clear_anonymous_session_id(response):
    """
    Clear the anonymous session ID cookie by setting it to expire immediately.
    
    :param response: Flask response object to clear cookie on.
    :type response: flask.Response
    """
    response.set_cookie(ANONYMOUS_SESSION_COOKIE, '', expires=0)

# ---- User Loader and User Class ----
class User(UserMixin):
    """
    Flask-Login User class wrapper for MongoDB user documents.
    
    Stores user information from Helmholtz AAI OAuth2/OIDC authentication.

    :param user_doc: The MongoDB user document.
    :type user_doc: dict

    :ivar id: User ID, as a string (ObjectId).
    :ivar helmholtz_sub: Helmholtz AAI subject identifier (unique user ID from OAuth).
    :ivar email: User's email address.
    :ivar name: User's full name (from Helmholtz AAI).
    """
    def __init__(self, user_doc):
        self.id = str(user_doc['_id'])
        self.helmholtz_sub = user_doc.get('helmholtz_sub')
        self.email = user_doc.get('email')
        self.name = user_doc.get('name', '')

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

# ---- Register Route (Legacy Email/Password) ----
@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user using legacy email/password authentication.

    :request json email: Email address for registration.
    :request json password: Plain-text password to hash and store securely.
    :request json name: Optional display name.

    :returns: JSON message for success or error.
    :rtype: flask.Response
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    name = data.get("name", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    # Prevent duplicate registrations
    existing_user = mongo.db.users.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "User already exists"}), 409

    hashed_password = generate_password_hash(password)

    user_id = mongo.db.users.insert_one({
        "email": email,
        "password": hashed_password,
        "name": name,
    }).inserted_id

    # Create user-specific data directory
    user_dir = os.path.join(current_app.root_path, 'user_data', str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    # Log the user in immediately after registration
    user_doc = mongo.db.users.find_one({"_id": user_id})
    user = User(user_doc)
    login_user(user)

    return jsonify({"message": "User registered successfully"}), 201

# ---- Login Route (OAuth GET + Legacy POST) ----
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """
    Handle both Helmholtz AAI OAuth login (GET) and legacy email/password login (POST).

    GET:
        Redirects the user to the Helmholtz AAI authorization endpoint.
    POST:
        Authenticates user via MongoDB-stored email/password credentials.

    :returns: Redirect response (GET) or JSON message (POST).
    """
    if request.method == 'GET':
        redirect_uri = url_for('auth.auth_callback', _external=True)
        return oauth.helmholtz.authorize_redirect(redirect_uri)

    # POST legacy login
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    user_doc = mongo.db.users.find_one({"email": email})

    if not user_doc or 'password' not in user_doc:
        return jsonify({"error": "Invalid credentials"}), 401

    if not check_password_hash(user_doc['password'], password):
        return jsonify({"error": "Invalid credentials"}), 401

    user = User(user_doc)
    login_user(user)

    # Ensure user data directory exists
    user_dir = os.path.join(current_app.root_path, 'user_data', user.id)
    os.makedirs(user_dir, exist_ok=True)

    # Clear any OAuth token from previous sessions
    session.pop('oauth_token', None)

    # Migrate anonymous runs if present
    session_id = get_anonymous_session_id()
    response = jsonify({"message": "Logged in successfully"})
    if session_id:
        mongo.db.runs.update_many(
            {"session_id": session_id},
            {"$set": {"user_id": user.id, "session_id": None}}
        )
        # Clear anonymous session cookie after migration
        clear_anonymous_session_id(response)

    return response, 200

# ---- OAuth Callback Route ----
@auth_bp.route('/auth/callback')
def auth_callback():
    """
    Handle OAuth2 callback from Helmholtz AAI.
    
    Exchanges authorization code for access token, fetches user info,
    creates or updates user in MongoDB, logs user in, and migrates
    any anonymous session data.
    
    :returns: Redirect to frontend or JSON error message.
    :rtype: flask.Response
    
    Workflow:
      1. Exchange authorization code for access token.
      2. Fetch user info from Helmholtz AAI userinfo endpoint.
      3. Check if user exists in MongoDB by helmholtz_sub.
      4. If new user: create user document with helmholtz_sub, email, name.
      5. If existing: update email/name if changed.
      6. Create user data directory if needed.
      7. Log user in via Flask-Login.
      8. Migrate any anonymous session data to authenticated user.
      9. Store access token in session for later revocation.
    """
    try:
        # Exchange authorization code for access token
        token = oauth.helmholtz.authorize_access_token()
        
        # Fetch user information from Helmholtz AAI
        userinfo = token.get('userinfo')
        if not userinfo:
            # If userinfo not in token, fetch it explicitly
            resp = oauth.helmholtz.get('userinfo')
            userinfo = resp.json()
        
        helmholtz_sub = userinfo.get('sub')
        email = userinfo.get('email')
        name = userinfo.get('name', '')
        
        if not helmholtz_sub:
            return jsonify({"error": "Failed to get user information from Helmholtz AAI"}), 500
        
        # Check if user exists in database by helmholtz_sub
        user_doc = mongo.db.users.find_one({"helmholtz_sub": helmholtz_sub})
        
        if user_doc:
            # Update existing user's email and name if changed
            mongo.db.users.update_one(
                {"_id": user_doc['_id']},
                {"$set": {"email": email, "name": name}}
            )
            user_doc = mongo.db.users.find_one({"_id": user_doc['_id']})
        else:
            # Create new user
            user_id = mongo.db.users.insert_one({
                "helmholtz_sub": helmholtz_sub,
                "email": email,
                "name": name
            }).inserted_id
            user_doc = mongo.db.users.find_one({"_id": user_id})
            
            # Create user-specific data directory
            user_dir = os.path.join(current_app.root_path, 'user_data', str(user_id))
            os.makedirs(user_dir, exist_ok=True)
        
        # Log user in
        user = User(user_doc)
        login_user(user)
        
        # Store access token in session for logout/revocation
        session['oauth_token'] = token.get('access_token')
        
        # If there is an anonymous session, migrate runs to this user
        session_id = get_anonymous_session_id()
        redirect_response = redirect('http://localhost:3000/')  # Adjust frontend URL as needed
        if session_id:
            mongo.db.runs.update_many(
                {"session_id": session_id},
                {"$set": {"user_id": user.id, "session_id": None}}
            )
            # Clear anonymous session cookie after migration
            clear_anonymous_session_id(redirect_response)
        
        # Redirect to frontend homepage or dashboard
        return redirect_response
        
    except Exception as e:
        current_app.logger.error(f"OAuth callback error: {str(e)}")
        return jsonify({"error": "Authentication failed", "details": str(e)}), 500

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
                "name": current_user.name,
            }
        })
    return jsonify({"authenticated": False}), 200

# ---- Logout Route ----
@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    """
    Log out the current authenticated user and revoke OAuth token.
    
    Revokes the access token with Helmholtz AAI (if present),
    logs out the user from Flask-Login, and clears the session.

    :returns: JSON message confirming logout.
    :rtype: flask.Response
    """
    # Revoke OAuth token if present
    oauth_token = session.get('oauth_token')
    if oauth_token:
        try:
            # Revoke the token with Helmholtz AAI
            revocation_url = current_app.config.get('HELMHOLTZ_REVOCATION_ENDPOINT')
            client_id = current_app.config.get('HELMHOLTZ_CLIENT_ID')
            
            # According to RFC 7009 and Helmholtz AAI docs, token_type_hint is mandatory
            data = {
                'token': oauth_token,
                'client_id': client_id,
                'token_type_hint': 'access_token'
            }
            
            response = requests.post(revocation_url, data=data)
            if response.status_code != 200:
                current_app.logger.warning(f"Token revocation failed: {response.status_code}")
        except Exception as e:
            current_app.logger.error(f"Error revoking token: {str(e)}")
        
        # Clear token from session
        session.pop('oauth_token', None)
    
    # Log out user
    logout_user()
    return jsonify({"message": "Logged out"}), 200

# ---- Before Request Handler to Assign Anonymous Session ID ----
@auth_bp.before_app_request
def assign_session_id():
    """
    Assign a unique session_id to anonymous users for tracking their runs
    and data before they log in or register.

    If the current user is not authenticated and cookie does not have a 'session_id',
    generates a new UUID as session_id and stores it in g for later cookie setting.
    Creates a directory for anonymous user data if it does not exists already.

    :modifies g: Stores new session_id in g.anonymous_session_id if one needs to be created.
    """
    if not current_user.is_authenticated:
        session_id = get_anonymous_session_id()
        if not session_id:
            # Generate new session ID and store in g for after_request handler
            session_id = str(uuid.uuid4())
            g.anonymous_session_id = session_id
        # Ensure directory for anonymous user data associated with this session exists
        user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session['session_id'])
        os.makedirs(user_dir, exist_ok=True)

# ---- After Request Handler to Set Anonymous Session Cookie ----
@auth_bp.after_app_request
def set_anonymous_session_cookie(response):
    """
    Set the anonymous session ID cookie if a new one was generated in before_request.
    
    :param response: Flask response object.
    :type response: flask.Response
    :returns: Response with cookie set if needed.
    :rtype: flask.Response
    """
    if hasattr(g, 'anonymous_session_id'):
        set_anonymous_session_id(response, g.anonymous_session_id)
    return response