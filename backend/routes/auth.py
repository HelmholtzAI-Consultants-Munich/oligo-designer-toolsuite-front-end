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

import os
import uuid
from http import HTTPStatus

import requests
from bson import ObjectId
from flask import Blueprint, abort, current_app, jsonify, redirect, request, session, url_for
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash

from backend.extensions import mongo, oauth
from backend.routes.route_helpers import validate_turnstile
from backend.utilities.account_cleanup import delete_user_account_data
from backend.utilities.legal import TERMS_DOCUMENT_KEY, get_published_legal_document
from backend.utilities.legal_acceptance import (
    get_latest_terms_acceptance,
    record_terms_acceptance,
)
from backend.utilities.session_activity import delete_anonymous_session, touch_anonymous_session
from backend.utilities.typed_values import (
    parse_http_url,
    sanitize_relative_redirect_path,
)

auth_bp = Blueprint("auth", __name__)


# ---- User Loader and User Class ----
class User(UserMixin):
    """
    Flask-Login User class wrapper for MongoDB user documents.

    Stores user information from Helmholtz AAI OAuth2/OIDC authentication or CLI registration.

    :param user_doc: The MongoDB user document.
    :type user_doc: dict

    :ivar id: User ID, as a string (ObjectId).
    :ivar helmholtz_sub: Helmholtz AAI subject identifier (unique user ID from OAuth).
    :ivar username: Username for CLI-registered admin users.
    """

    def __init__(self, user_doc):
        self.id = str(user_doc["_id"])
        self.helmholtz_sub = user_doc.get("helmholtz_sub")
        self.username = user_doc.get("username")


def init_login_manager(app):
    """
    Initialize Flask-Login's LoginManager and user loader.

    :param app: The Flask application instance.
    :type app: flask.Flask
    :returns: The initialized LoginManager object.
    :rtype: flask_login.LoginManager

    The user_loader loads a user from the database using their ObjectId.
    Session protection is enabled in "strong" mode to prevent session hijacking.
    """
    login_manager = LoginManager()
    login_manager.init_app(app)

    # Enable strong session protection to prevent session hijacking
    # This tracks IP address and user agent, and deletes sessions if they don't match
    login_manager.session_protection = "strong"

    @login_manager.user_loader
    def load_user(user_id):
        # Load user document from MongoDB by ObjectId and return User instance
        user_doc = mongo.db.users.find_one({"_id": ObjectId(user_id)})
        if user_doc:
            return User(user_doc)
        return None

    return login_manager


# ---- Helper Function for User Login Logic ----
def _login(user: User, remember: bool = True):
    """
    Helper function to handle user login logic including directory creation,
    session management, and anonymous run migration.

    :param user: The User instance to log in.
    :type user: User
    :param remember: Whether to use "Remember Me" functionality.
    :type remember: bool
    """
    # Make session cookie temporary; Flask-Login remember cookie handles persistence
    session.permanent = False
    # Log in with optional "Remember Me" based on preference
    login_user(user, remember=remember)

    # Ensure user data directory exists
    user_dir = os.path.join(current_app.config["USERDATA_PATH"], user.id)
    os.makedirs(user_dir, exist_ok=True)

    # Clear any OAuth token from previous sessions
    session.pop("oauth_token", None)

    # Migrate anonymous runs if present
    session_id = session.get("session_id")
    if session_id:
        mongo.db.runs.update_many(
            {"session_id": session_id},
            {"$set": {"user_id": user.id, "session_id": None, "transferred_from_anon": True}},
        )
        mongo.db.uploads.update_many(
            {"session_id": session_id},
            {"$set": {"user_id": user.id, "session_id": None}},
        )
        mongo.db.legal_acceptances.delete_many({"session_id": session_id})
        delete_anonymous_session(session_id)
        # Clear anonymous session_id from session
        session.pop("session_id", None)


def _build_legal_status(user_id: str | None = None, session_id: str | None = None) -> dict:
    terms_doc = get_published_legal_document(TERMS_DOCUMENT_KEY)
    latest_acceptance = None
    accepted_terms_version = None
    accepted_at = None

    if user_id or session_id:
        latest_acceptance = get_latest_terms_acceptance(user_id=user_id, session_id=session_id)
        accepted_terms_version = latest_acceptance.get("terms_version") if latest_acceptance else None
        accepted_at = latest_acceptance.get("timestamp") if latest_acceptance else None

    return {
        "current_terms_version": terms_doc["version"],
        "accepted_terms_version": accepted_terms_version,
        "terms_accepted_at": accepted_at.isoformat() if accepted_at else None,
    }


# ---- Login Route (OAuth GET + Legacy POST) ----
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """
    Handle both Helmholtz AAI OAuth login (GET) and legacy username/password login (POST).

    GET:
        Redirects the user to the Helmholtz AAI authorization endpoint.
    POST:
        Authenticates user via MongoDB-stored username/password credentials.

    :returns: Redirect response (GET) or JSON message (POST).
    """

    if request.method == "GET":
        # Preserve redirect parameter from frontend through OAuth flow
        redirect_param = request.args.get("redirect")
        if redirect_param:
            safe_redirect = sanitize_relative_redirect_path(redirect_param)
            if safe_redirect is None:
                abort(HTTPStatus.BAD_REQUEST, description="Invalid redirect path")
            session["oauth_redirect"] = safe_redirect
        redirect_uri = url_for("auth.auth_callback", _external=True)
        return oauth.helmholtz.authorize_redirect(redirect_uri)

    # POST legacy login
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password")
    remember_me = data.get("remember_me", True)  # Default to True for backward compatibility
    token = data.get("token", "")

    if not validate_turnstile(token):
        abort(HTTPStatus.FORBIDDEN, description="Turnstile verification failed. Please try again.")

    if not username or not password:
        abort(HTTPStatus.BAD_REQUEST, description="Username and password required")

    user_doc = mongo.db.users.find_one({"username": username})

    if not user_doc or "password" not in user_doc:
        abort(HTTPStatus.UNAUTHORIZED, description="Invalid credentials")

    if not check_password_hash(user_doc["password"], password):
        abort(HTTPStatus.UNAUTHORIZED, description="Invalid credentials")

    user = User(user_doc)
    _login(user, remember=remember_me)

    return jsonify({"message": "Logged in successfully"}), HTTPStatus.OK


# ---- OAuth Callback Route ----
@auth_bp.route("/auth/callback")
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
      4. If new user: create a user document with helmholtz_sub, role, and legal acceptance fields.
      5. Log user in via Flask-Login with remember-me enabled.
      6. Let _login() create the user data directory if needed and migrate any anonymous session data.
      7. Store the access token in session for later revocation.
      8. Redirect to the frontend, preserving any validated redirect path from the OAuth flow.
    """
    # Exchange authorization code for access token
    token = oauth.helmholtz.authorize_access_token()

    # Fetch user information from Helmholtz AAI
    userinfo = token.get("userinfo")
    if not userinfo:
        # If userinfo not in token, fetch it explicitly
        resp = oauth.helmholtz.get("userinfo")
        userinfo = resp.json()

    helmholtz_sub = userinfo.get("sub")

    if not helmholtz_sub:
        current_app.logger.warning(f"Failed to get 'sub' from userinfo: {userinfo}")
        abort(
            HTTPStatus.INTERNAL_SERVER_ERROR, description="Failed to get user information from Helmholtz AAI"
        )

    # Check if user exists in database by helmholtz_sub
    user_doc = mongo.db.users.find_one({"helmholtz_sub": helmholtz_sub})

    if not user_doc:
        # Create new user with only helmholtz_sub and role
        user_id = mongo.db.users.insert_one(
            {
                "helmholtz_sub": helmholtz_sub,
                "role": "user",  # Default role for Helmholtz users
                "accepted_terms_version": None,
                "terms_accepted_at": None,
            }
        ).inserted_id
        user_doc = mongo.db.users.find_one({"_id": user_id})
    # Log user in with "Remember Me" to persist login across browser sessions
    # OAuth logins always use "Remember Me" since there's no way to pass preference through OAuth flow
    # _login() will create the user directory if it doesn't exist
    user = User(user_doc)
    _login(user, remember=True)

    # Store access token in session for logout/revocation
    session["oauth_token"] = token.get("access_token")

    # Redirect to frontend - check if there's a preserved redirect URL
    frontend_url_raw = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
    frontend_url = parse_http_url(frontend_url_raw)
    if frontend_url is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Frontend URL configuration is invalid")

    frontend_base = frontend_url.geturl().rstrip("/")
    redirect_path = sanitize_relative_redirect_path(session.pop("oauth_redirect", None))
    if redirect_path:
        return redirect(f"{frontend_base}{redirect_path}")
    return redirect(f"{frontend_base}/")  # Default to homepage


# ---- Check Authentication Status Route ----
@auth_bp.route("/api/check_auth", methods=["GET"])
def check_auth():
    """
    Check if current user is authenticated.

    Returns user info if authenticated, otherwise just `authenticated: False`.

    :returns: JSON containing authentication status and user info (if authenticated).
    :rtype: flask.Response
    """
    if current_user.is_authenticated:
        # Get user document to include role, helmholtz_sub, and username
        user_doc = mongo.db.users.find_one({"_id": ObjectId(current_user.id)})
        role = user_doc.get("role", "user") if user_doc else "user"
        helmholtz_sub = user_doc.get("helmholtz_sub") if user_doc else None
        username = user_doc.get("username") if user_doc else None
        legal_status = _build_legal_status(user_id=str(current_user.id))

        return jsonify(
            {
                "authenticated": True,
                "user": {
                    "id": str(current_user.id),
                    "username": username,
                    "role": role,
                    "helmholtz_sub": helmholtz_sub,
                },
                "legal": legal_status,
            }
        )
    return jsonify(
        {
            "authenticated": False,
            "legal": _build_legal_status(session_id=session.get("session_id")),
        }
    ), HTTPStatus.OK


@auth_bp.route("/api/legal/terms/accept", methods=["POST"])
def accept_terms():
    """Record acceptance of the current terms version for the current user or session."""
    user_id = str(current_user.id) if current_user.is_authenticated else None
    session_id = None if user_id else session.get("session_id")

    acceptance = record_terms_acceptance(user_id=user_id, session_id=session_id)

    if user_id:
        mongo.db.users.update_one(
            {"_id": ObjectId(current_user.id)},
            {
                "$set": {
                    "accepted_terms_version": acceptance["terms_version"],
                    "terms_accepted_at": acceptance["timestamp"],
                }
            },
        )

    return jsonify(
        {
            "legal": _build_legal_status(user_id=user_id, session_id=session_id),
        }
    ), HTTPStatus.OK


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
    oauth_token = session.get("oauth_token")
    if oauth_token:
        try:
            # Revoke the token with Helmholtz AAI
            revocation_url = parse_http_url(current_app.config.get("HELMHOLTZ_REVOCATION_ENDPOINT"))
            client_id = current_app.config.get("HELMHOLTZ_CLIENT_ID")

            # According to RFC 7009 and Helmholtz AAI docs, token_type_hint is mandatory
            data = {
                "token": oauth_token,
                "client_id": client_id,
                "token_type_hint": "access_token",
                "logout": "true",
            }

            if revocation_url is None:
                current_app.logger.warning("Token revocation skipped: invalid revocation endpoint URL")
            else:
                response = requests.post(revocation_url.geturl(), data=data)
                if response.status_code != HTTPStatus.OK:
                    current_app.logger.warning(f"Token revocation failed: {response.status_code}")
        except Exception as e:
            current_app.logger.error(f"Error revoking token: {e!s}")

        # Clear token from session
        session.pop("oauth_token", None)

    # Log out user
    logout_user()
    return jsonify({"message": "Logged out"}), HTTPStatus.OK


@auth_bp.route("/api/account", methods=["DELETE"])
@login_required
def delete_account():
    """Delete the current account and the user's associated data."""
    user_id = str(current_user.id)

    delete_user_account_data(
        user_id=user_id,
        upload_root=current_app.config["UPLOAD_PATH"],
        userdata_root=current_app.config["USERDATA_PATH"],
    )

    session.clear()
    logout_user()
    return jsonify({"message": "Your account and associated data have been deleted."}), HTTPStatus.OK


# ---- Before Request Handler to Assign Anonymous Session ID ----
@auth_bp.before_app_request
def assign_session_id():
    """
    Assign a unique session_id to anonymous users for tracking their runs
    and data before they log in or register.

    If the current user is not authenticated and session does not have a 'session_id',
    assigns a new UUID as session_id. Makes the session permanent so it persists across browser sessions.
    Creates a directory for anonymous user data if it does not exists already.

    :modifies session: Adds 'session_id' to Flask session for anonymous user tracking.
    """
    if request.method == "OPTIONS":
        return

    if not current_user.is_authenticated:
        # Make session permanent so it persists (uses PERMANENT_SESSION_LIFETIME)
        session.permanent = True
        if "session_id" not in session:
            session["session_id"] = str(uuid.uuid4())
        touch_anonymous_session(session.get("session_id"))
        # Ensure directory for anonymous user data associated with this session exists
        user_dir = os.path.join(current_app.config["USERDATA_PATH"], "anon", session["session_id"])
        os.makedirs(user_dir, exist_ok=True)
