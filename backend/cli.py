"""
Flask CLI commands for administrative tasks.

Usage:
    flask admin promote <identifier>  - Promote a user to admin (username or helmholtz_sub)
    flask admin list                  - List all admin users
    flask user list                   - List all users
    flask user register               - Register a new user (interactive)
"""

import os
import re
from typing import Never

import click
from flask import current_app
from werkzeug.security import generate_password_hash

from backend.extensions import mongo

# ---- Helpers ----

_PASSWORD_REQUIREMENTS = (
    "At least 8 characters, one uppercase, one lowercase, one digit, one special character"
)

_USER_PROJECTION = {"username": 1, "helmholtz_sub": 1, "role": 1, "_id": 0}


def _find_user(identifier: str) -> dict | None:
    """Find a user by username or helmholtz_sub."""
    return mongo.db.users.find_one({"username": identifier}) or mongo.db.users.find_one(
        {"helmholtz_sub": identifier}
    )


def _display_id(user: dict, fallback: str = "Unknown") -> str:
    """Return the most readable identifier for a user."""
    return user.get("username") or user.get("helmholtz_sub") or fallback


def _format_user(user: dict, show_role: bool = False) -> str:
    """Format a user document as a display string."""
    role = user.get("role", "user")
    role_suffix = f" [{role}]" if show_role else ""

    if username := user.get("username"):
        return f"  Username: {username}{role_suffix}"
    if helmholtz_sub := user.get("helmholtz_sub"):
        return f"  Helmholtz ID: {helmholtz_sub}{role_suffix}"
    return f"  Unknown user{role_suffix}"


def _print_user_list(users: list, label: str) -> None:
    """Print a formatted list of users."""
    if not users:
        click.echo(f"No {label} found.")
        return
    click.echo(f"\nFound {len(users)} {label}:\n")
    for user in users:
        click.echo(_format_user(user, show_role=(label == "user(s)")))


def _validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength. Returns (is_valid, error_message)."""
    checks = [
        (len(password) >= 8, "at least 8 characters"),
        (re.search(r"[A-Z]", password), "one uppercase letter"),
        (re.search(r"[a-z]", password), "one lowercase letter"),
        (re.search(r"\d", password), "one digit"),
        (re.search(r'[!@#$%^&*(),.?":{}|<>]', password), "one special character"),
    ]
    failed = [msg for passed, msg in checks if not passed]
    if failed:
        return False, f"Password must contain: {', '.join(failed)}"
    return True, ""


def _abort(message: str) -> Never:
    """Print an error and abort."""
    click.echo(f"Error: {message}", err=True)
    raise click.Abort()


# ---- Commands ----


def register_cli_commands(app):
    """Register CLI commands with the Flask application."""

    @app.cli.group()
    def admin():
        """Admin management commands."""

    @admin.command()
    @click.argument("identifier")
    def promote(identifier):
        """Promote a user to admin role.

        IDENTIFIER can be a username (CLI users) or helmholtz_sub (Helmholtz users).

        \b
        Examples:
            flask admin promote myuser
            flask admin promote 1fa0f64b-58f5-41f9-abb5-ac6e67456d23
        """
        user = _find_user(identifier)
        if not user:
            _abort(f'User "{identifier}" not found.')

        display_id = _display_id(user, identifier)

        if user.get("role") == "admin":
            click.echo(f'User "{display_id}" is already an admin.')
            return

        result = mongo.db.users.update_one({"_id": user["_id"]}, {"$set": {"role": "admin"}})
        if result.modified_count > 0:
            click.echo(f'Successfully promoted "{display_id}" to admin.')
        else:
            _abort("Failed to promote user.")

    @admin.command(name="list")
    def list_admins():
        """List all admin users.

        \b
        Example:
            flask admin list
        """
        projection = {k: v for k, v in _USER_PROJECTION.items() if k != "role"}
        admins = list(mongo.db.users.find({"role": "admin"}, projection))
        _print_user_list(admins, "admin user(s)")

    @app.cli.group()
    def user():
        """User management commands."""

    @user.command(name="list")
    def list_users():
        """List all users.

        \b
        Example:
            flask user list
        """
        users = list(mongo.db.users.find({}, _USER_PROJECTION))
        _print_user_list(users, "user(s)")

    @user.command()
    def register():
        """Register a new user (interactive).

        Both username and password are always prompted. Password input is hidden.

        \b
        Example:
            flask user register
        """
        username = click.prompt("Username").strip()
        if not username:
            _abort("Username cannot be empty.")

        if mongo.db.users.find_one({"username": username}):
            _abort(f'Username "{username}" already exists.')

        click.echo(f"\nPassword requirements: {_PASSWORD_REQUIREMENTS}\n")
        password = click.prompt("Password", hide_input=True, confirmation_prompt=True)

        is_valid, error_msg = _validate_password(password)
        if not is_valid:
            _abort(error_msg)

        result = mongo.db.users.insert_one(
            {
                "username": username,
                "password": generate_password_hash(password),
                "role": "user",
                "accepted_terms_version": None,
                "terms_accepted_at": None,
            }
        )
        user_id = str(result.inserted_id)

        user_dir = os.path.join(current_app.config["USERDATA_PATH"], user_id)
        os.makedirs(user_dir, exist_ok=True)

        click.echo(f'\nSuccessfully registered user "{username}" (ID: {user_id}).')
        click.echo(f"Data directory: {user_dir}")
