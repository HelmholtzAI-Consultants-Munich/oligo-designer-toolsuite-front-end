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

Notes:
    Requires Flask, Flask-Login, Authlib, MongoDB (via extensions.mongo),
    requests.
"""

import os
import uuid
from http import HTTPStatus

from bson import ObjectId
from flask import Blueprint, abort, current_app, jsonify, request, session, url_for
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user
from werkzeug.security import check_password_hash

from backend.extensions import db, oauth
from backend.routes.route_helpers import (
    deny_oauth_login,
    get_or_create_helmholtz_user,
    is_helmholtz_access_allowed,
    load_helmholtz_userinfo,
    redirect_after_oauth_login,
    revoke_helmholtz_token,
    validate_turnstile,
)
from backend.utilities.account_cleanup import delete_user_account_data
from backend.utilities.legal import TERMS_DOCUMENT_KEY, get_published_legal_document
from backend.utilities.legal_acceptance import (
    get_latest_terms_acceptance,
    record_terms_acceptance,
)
from backend.utilities.session_activity import delete_anonymous_session, touch_anonymous_session
from backend.utilities.typed_values import sanitize_relative_redirect_path
from backend.utilities.user_denylist import is_helmholtz_sub_banned

auth_bp = Blueprint("auth", __name__)


# ---- User Loader and User Class ----
class User(UserMixin):
    """Wraps a MongoDB user document (user_doc) so Flask-Login can track it.

    Notes:
        id, helmholtz_sub, and username are pulled out because those are the
        fields routes need, without every caller re-parsing the raw document.
    """

    def __init__(self, user_doc):
        self.id = str(user_doc["_id"])
        self.helmholtz_sub = user_doc.get("helmholtz_sub")
        self.username = user_doc.get("username")


def init_login_manager(app):
    """Initializes and configures the Flask-Login login manager.

    Arguments:
        app {flask.Flask} -- the Flask application instance.

    Notes:
        "Strong" session protection is used (tracks IP/user-agent), so a
        stolen session cookie stops working if replayed from a different
        client.

    Returns:
        flask_login.LoginManager -- the initialized login manager.
    """
    login_manager = LoginManager()
    login_manager.init_app(app)

    # Enable strong session protection to prevent session hijacking
    # This tracks IP address and user agent, and deletes sessions if they don't match
    login_manager.session_protection = "strong"

    @login_manager.user_loader
    def load_user(user_id):
        # Called by Flask-Login on every request to reload the user from the session.
        # Returning None for banned users immediately revokes their access.
        user_doc = db.users.find_one({"_id": ObjectId(user_id)})
        if user_doc and not is_helmholtz_sub_banned(user_doc.get("helmholtz_sub")):
            return User(user_doc)
        return None

    return login_manager


# ---- Helper Function for User Login Logic ----
def _login(user: User, remember: bool = True):
    """Logs in the given user and performs post-login setup.

    Arguments:
        user {User} -- the user to log in.

    Keyword Arguments:
        remember {bool} -- whether to persist the login across browser
        sessions via Flask-Login's remember cookie. (default: {True})

    Notes:
        This is shared by both OAuth and legacy login so anonymous-session
        migration and user-directory setup happen exactly once, regardless
        of which login path was used.
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
        db.runs.update_many(
            {"session_id": session_id},
            {"$set": {"user_id": user.id, "session_id": None, "transferred_from_anon": True}},
        )
        db.uploads.update_many(
            {"session_id": session_id},
            {"$set": {"user_id": user.id, "session_id": None}},
        )
        db.legal_acceptances.delete_many({"session_id": session_id})
        delete_anonymous_session(session_id)
        # Clear anonymous session_id from session
        session.pop("session_id", None)


def _build_legal_status(user_id: str | None = None, session_id: str | None = None) -> dict:
    """Builds the legal terms-acceptance status for a user or session.

    Keyword Arguments:
        user_id {str | None} -- set for authenticated users; mutually
        exclusive with session_id. (default: {None})
        session_id {str | None} -- set for anonymous users. (default: {None})

    Notes:
        This is shared by check_auth and accept_terms so the frontend always
        gets the same shape for whether this identity needs to (re-)accept
        terms.

    Returns:
        dict -- current/accepted terms version and acceptance timestamp.
    """
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
    """Handles both OAuth (GET) and legacy username/password (POST) login on one route.

    Notes:
        The frontend always POSTs here for username/password, while OAuth
        needs a GET the browser can be redirected to directly.

    Returns:
        flask.Response -- redirect to Helmholtz AAI (GET), or JSON message (POST).
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
        abort(HTTPStatus.FORBIDDEN, description="We couldn't verify that you are human. Please try again.")

    if not username or not password:
        abort(HTTPStatus.BAD_REQUEST, description="Username and password required")

    user_doc = db.users.find_one({"username": username})

    if not user_doc or "password" not in user_doc:
        abort(
            HTTPStatus.UNAUTHORIZED,
            description="Invalid username or password. Please check your credentials and try again.",
        )

    if not check_password_hash(user_doc["password"], password):
        abort(
            HTTPStatus.UNAUTHORIZED,
            description="Invalid username or password. Please check your credentials and try again.",
        )

    user = User(user_doc)
    _login(user, remember=remember_me)

    return jsonify({"message": "Logged in successfully"}), HTTPStatus.OK


# ---- OAuth Callback Route ----
@auth_bp.route("/auth/callback")
def auth_callback():
    """OAuth2 callback from Helmholtz AAI that looks up/creates the user and logs them in.

    Notes:
        The user is looked up/created by helmholtz_sub and the denylist is checked here
        (rather than relying on the user_loader) so a newly-banned user is
        rejected even before their first User object is created.

    Returns:
        flask.Response -- redirect to the frontend (success or ban message).
    """
    # Exchange authorization code for access token
    token = oauth.helmholtz.authorize_access_token()
    userinfo = load_helmholtz_userinfo(token)
    helmholtz_sub = userinfo.get("sub")

    if not isinstance(helmholtz_sub, str) or not helmholtz_sub:
        current_app.logger.warning(f"Failed to get 'sub' from userinfo: {userinfo}")
        abort(
            HTTPStatus.INTERNAL_SERVER_ERROR, description="Failed to get user information from Helmholtz AAI"
        )

    if is_helmholtz_sub_banned(helmholtz_sub):
        current_app.logger.warning(
            "Helmholtz AAI login denied for subject %s: account is banned",
            helmholtz_sub,
        )
        return deny_oauth_login(token.get("access_token"), "account_banned")

    if not is_helmholtz_access_allowed(userinfo):
        current_app.logger.warning(
            "Helmholtz AAI login denied for subject %s: no allowed entitlement is present",
            helmholtz_sub,
        )
        return deny_oauth_login(token.get("access_token"), "vo_access_denied")

    user_doc = get_or_create_helmholtz_user(helmholtz_sub)
    # Log user in with "Remember Me" to persist login across browser sessions
    # OAuth logins always use "Remember Me" since there's no way to pass preference through OAuth flow
    # _login() will create the user directory if it doesn't exist
    user = User(user_doc)
    _login(user, remember=True)

    # Store access token in session for logout/revocation
    session["oauth_token"] = token.get("access_token")

    return redirect_after_oauth_login()


# ---- Check Authentication Status Route ----
@auth_bp.route("/api/check_auth", methods=["GET"])
def check_auth():
    """Returns the current authentication and legal-acceptance status for the caller.

    Notes:
        The frontend polls this on load to decide whether to show a
        logged-in or anonymous UI, and whether terms need (re-)accepting.

    Returns:
        flask.Response -- authentication status, user info if authenticated,
        and legal-acceptance status either way.
    """
    if current_user.is_authenticated:
        # Get user document to include role, helmholtz_sub, and username
        user_doc = db.users.find_one({"_id": ObjectId(current_user.id)})
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
    """Record acceptance of the current terms version for the current user
    or session.

    Returns:
        flask.Response -- updated legal-acceptance status.
    """
    user_id = str(current_user.id) if current_user.is_authenticated else None
    session_id = None if user_id else session.get("session_id")

    acceptance = record_terms_acceptance(user_id=user_id, session_id=session_id)

    if user_id:
        db.users.update_one(
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
    """Logs out the current user and revokes their OAuth token with Helmholtz AAI.

    Notes:
        Revoking the token (not just clearing the local session) ensures the
        access token can't still be used elsewhere after the user has logged
        out here. Revocation failures are logged, not raised, since the user
        should still be logged out locally either way.

    Returns:
        flask.Response -- confirmation message.
    """
    # Revoke OAuth token if present
    oauth_token = session.get("oauth_token")
    if oauth_token:
        revoke_helmholtz_token(oauth_token)

        # Clear token from session
        session.pop("oauth_token", None)

    # Log out user
    logout_user()
    return jsonify({"message": "Logged out"}), HTTPStatus.OK


@auth_bp.route("/api/account", methods=["DELETE"])
@login_required
def delete_account():
    """Delete the current account and the user's associated data.

    Returns:
        flask.Response -- confirmation message.
    """
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
    """Assigns and persists a stable anonymous session id before every request.

    Notes:
        This runs before every request so anonymous visitors get a stable
        identity (and data directory) even before they submit anything,
        since a pipeline run needs somewhere to write output as soon as it
        starts.
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
