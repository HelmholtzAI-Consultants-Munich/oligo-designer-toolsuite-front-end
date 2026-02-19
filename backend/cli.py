"""
Flask CLI commands for administrative tasks.

This module provides command-line interface commands using Flask's CLI system
(which uses Click under the hood). Commands are automatically available via
the `flask` command-line tool.

Usage:
    flask admin promote <identifier>  - Promote a user to admin role (by username or helmholtz_sub)
    flask admin list             - List all admin users
    flask user register <username> <password>  - Register a new admin user
"""

import os

import click
from werkzeug.security import generate_password_hash

from backend.extensions import mongo


def register_cli_commands(app):
    """Register CLI commands with the Flask application.

    This function should be called from create_app() to make commands available.

    Args:
        app: Flask application instance
    """

    @app.cli.group()
    def admin():
        """Admin management commands."""
        pass

    @admin.command()
    @click.argument("identifier")
    def promote(identifier):
        """Promote a user to admin role.

        Args:
            identifier: Username (for CLI users) or helmholtz_sub (for Helmholtz users)
        """
        # Try username first, then helmholtz_sub
        user = mongo.db.users.find_one({"username": identifier})
        if not user:
            user = mongo.db.users.find_one({"helmholtz_sub": identifier})

        if not user:
            click.echo(f'❌ Error: User with identifier "{identifier}" not found.', err=True)
            raise click.Abort()

        if user.get("role") == "admin":
            display_id = user.get("username") or user.get("helmholtz_sub") or identifier
            click.echo(f'☑️  User "{display_id}" is already an admin.')
            return

        result = mongo.db.users.update_one({"_id": user["_id"]}, {"$set": {"role": "admin"}})

        if result.modified_count > 0:
            display_id = user.get("username") or user.get("helmholtz_sub") or identifier
            click.echo(f'✅ Successfully promoted "{display_id}" to admin.')
        else:
            click.echo("❌ Error: Failed to promote user.", err=True)
            raise click.Abort()

    @admin.command(name="list")
    def list_admins():
        """List all admin users."""
        admins = list(mongo.db.users.find({"role": "admin"}, {"username": 1, "helmholtz_sub": 1, "_id": 0}))

        if not admins:
            click.echo("No admin users found.")
            return

        click.echo(f"\nFound {len(admins)} admin user(s):\n")
        for admin in admins:
            username = admin.get("username")
            helmholtz_sub = admin.get("helmholtz_sub")
            if username:
                click.echo(f"  • Username: {username}")
            elif helmholtz_sub:
                click.echo(f"  • Helmholtz ID: {helmholtz_sub}")
            else:
                click.echo("  • Unknown user")

    @app.cli.group()
    def user():
        """User management commands."""
        pass

    @user.command()
    @click.argument("username")
    @click.argument("password")
    def register(username, password):
        """Register a new admin user.

        Args:
            username: Username for registration
            password: Plain-text password (will be hashed)

        Example:
            flask user register admin_user mypassword123
        """
        # Normalize username
        username = username.strip()

        if not username or not password:
            click.echo("❌ Error: Username and password are required.", err=True)
            raise click.Abort()

        # Check if user already exists
        existing_user = mongo.db.users.find_one({"username": username})
        if existing_user:
            click.echo(f'❌ Error: User with username "{username}" already exists.', err=True)
            raise click.Abort()

        # Hash password
        hashed_password = generate_password_hash(password)

        # Create user document - CLI users are automatically admins
        user_doc = {
            "username": username,
            "password": hashed_password,
            "role": "admin",  # CLI users are automatically admins
        }

        # Insert user into database
        result = mongo.db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)

        # Create user data directory
        try:
            # Access app context to get USERDATA_PATH config
            with app.app_context():
                userdata_path = app.config["USERDATA_PATH"]
                user_dir = os.path.join(userdata_path, user_id)
                os.makedirs(user_dir, exist_ok=True)
            click.echo(f'✅ Successfully registered admin user "{username}" (ID: {user_id}).')
            click.echo(f"   User data directory created at: {user_dir}")
        except Exception as e:
            click.echo(f'⚠️  User "{username}" registered, but failed to create user directory: {e}', err=True)
            click.echo(f"   User ID: {user_id}")
            raise click.Abort()
