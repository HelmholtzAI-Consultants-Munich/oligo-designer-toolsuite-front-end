"""
Flask CLI commands for administrative tasks.

This module provides command-line interface commands using Flask's CLI system
(which uses Click under the hood). Commands are automatically available via
the `flask` command-line tool.

Usage:
    flask admin promote <email>  - Promote a user to admin role
    flask admin list             - List all admin users
"""

import click

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
    @click.argument("email")
    def promote(email):
        """Promote a user to admin role.

        Args:
            email: Email address of the user to promote
        """
        user = mongo.db.users.find_one({"email": email})

        if not user:
            click.echo(f'❌ Error: User with email "{email}" not found.', err=True)
            raise click.Abort()

        if user.get("role") == "admin":
            click.echo(f'☑️  User "{email}" is already an admin.')
            return

        result = mongo.db.users.update_one({"email": email}, {"$set": {"role": "admin"}})

        if result.modified_count > 0:
            click.echo(f'✅ Successfully promoted "{email}" to admin.')
        else:
            click.echo("❌ Error: Failed to promote user.", err=True)
            raise click.Abort()

    @admin.command(name="list")
    def list_admins():
        """List all admin users."""
        admins = list(mongo.db.users.find({"role": "admin"}, {"email": 1, "name": 1, "_id": 0}))

        if not admins:
            click.echo("No admin users found.")
            return

        click.echo(f"\nFound {len(admins)} admin user(s):\n")
        for admin in admins:
            name = admin.get("name", "N/A")
            email = admin.get("email", "N/A")
            click.echo(f"  • {email} ({name})")
