#!/usr/bin/env python3
"""
Simple script to promote a user to admin role.
Usage: python promote_admin.py <email>
"""

import os
import sys

# Add the flask directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


from app import create_app
from extensions import mongo


def promote_user(email):
    """Promote a user to admin role."""
    app = create_app()

    with app.app_context():
        user = mongo.db.users.find_one({"email": email})

        if not user:
            print(f'❌ Error: User with email "{email}" not found.')
            return False

        if user.get("role") == "admin":
            print(f'☑️  User "{email}" is already an admin.')
            return True

        result = mongo.db.users.update_one({"email": email}, {"$set": {"role": "admin"}})

        if result.modified_count > 0:
            print(f'✅ Successfully promoted "{email}" to admin.')
            return True
        else:
            print("❌ Error: Failed to promote user.")
            return False


def list_admins():
    """List all admin users."""
    app = create_app()

    with app.app_context():
        admins = list(mongo.db.users.find({"role": "admin"}, {"email": 1, "name": 1, "_id": 0}))

        if not admins:
            print("No admin users found.")
            return

        print(f"\nFound {len(admins)} admin user(s):\n")
        for admin in admins:
            name = admin.get("name", "N/A")
            email = admin.get("email", "N/A")
            print(f"  • {email} ({name})")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python promote_admin.py <email>")
        print("   or: python promote_admin.py --list")
        sys.exit(1)

    if sys.argv[1] == "--list":
        list_admins()
    else:
        email = sys.argv[1]
        success = promote_user(email)
        sys.exit(0 if success else 1)
