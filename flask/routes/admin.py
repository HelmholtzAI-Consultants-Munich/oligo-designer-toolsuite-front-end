"""
Admin API Endpoints for Refine Admin Panel

This module provides REST API endpoints for admin operations, specifically
user management. All endpoints require admin role authentication.

Endpoints:
    - GET /api/admin/users - List all users
    - GET /api/admin/users/<user_id> - Get single user
    - PUT /api/admin/users/<user_id> - Update user
    - DELETE /api/admin/users/<user_id> - Delete user

:requires: Flask, Flask-Login, MongoDB (via extensions.mongo)
"""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from bson import ObjectId
from datetime import datetime
from extensions import mongo

admin_bp = Blueprint('admin', __name__)

def is_admin(user):
    """
    Check if the current user has admin role.
    
    :param user: The current user object from Flask-Login
    :type user: User
    :returns: True if user has admin role, False otherwise
    :rtype: bool
    """
    if not user or not user.is_authenticated:
        return False
    
    user_doc = mongo.db.users.find_one({'_id': ObjectId(user.id)})
    if not user_doc:
        return False
    
    return user_doc.get('role') == 'admin'

def require_admin(f):
    """
    Decorator to require admin role for an endpoint.
    
    :param f: The route function to protect
    :type f: function
    :returns: Decorated function that checks admin role
    :rtype: function
    """
    def decorated_function(*args, **kwargs):
        if not is_admin(current_user):
            return jsonify({"error": "Unauthorized. Admin access required."}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

@admin_bp.route('/api/admin/users', methods=['GET'])
@login_required
@require_admin
def get_users():
    """
    Get all users (admin only).
    
    Returns list of users in format compatible with Refine data provider.
    
    :returns: JSON list of users
    :rtype: flask.Response
    """
    try:
        users = list(mongo.db.users.find({}, {'password': 0}))  # Exclude password
        
        # Format for Refine: convert _id to id, format dates
        formatted_users = []
        for user in users:
            formatted = {
                'id': str(user['_id']),
                'email': user.get('email', ''),
                'name': user.get('name', ''),
                'role': user.get('role', 'user'),
                'helmholtz_sub': user.get('helmholtz_sub'),
                'created_at': user.get('_id').generation_time.isoformat() if user.get('_id') else None,
            }
            formatted_users.append(formatted)
        
        return jsonify(formatted_users), 200
    
    except Exception as e:
        return jsonify({"error": f"Failed to fetch users: {str(e)}"}), 500

@admin_bp.route('/api/admin/users/<user_id>', methods=['GET'])
@login_required
@require_admin
def get_user(user_id):
    """
    Get a single user by ID (admin only).
    
    :param user_id: The MongoDB ObjectId string of the user
    :type user_id: str
    :returns: JSON user object
    :rtype: flask.Response
    """
    try:
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)}, {'password': 0})
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        formatted = {
            'id': str(user['_id']),
            'email': user.get('email', ''),
            'name': user.get('name', ''),
            'role': user.get('role', 'user'),
            'helmholtz_sub': user.get('helmholtz_sub'),
            'created_at': user.get('_id').generation_time.isoformat() if user.get('_id') else None,
        }
        
        return jsonify(formatted), 200
    
    except Exception as e:
        return jsonify({"error": f"Failed to fetch user: {str(e)}"}), 500

@admin_bp.route('/api/admin/users/<user_id>', methods=['PUT'])
@login_required
@require_admin
def update_user(user_id):
    """
    Update a user (admin only).
    
    Allows updating email, name, and role fields.
    
    :param user_id: The MongoDB ObjectId string of the user
    :type user_id: str
    :request json email: Optional email address
    :request json name: Optional name
    :request json role: Optional role ('user' or 'admin')
    :returns: JSON updated user object
    :rtype: flask.Response
    """
    try:
        data = request.get_json() or {}
        
        # Validate role if provided
        if 'role' in data and data['role'] not in ['user', 'admin']:
            return jsonify({"error": "Invalid role. Must be 'user' or 'admin'"}), 400
        
        # Build update document
        update_doc = {}
        if 'email' in data:
            update_doc['email'] = data['email'].strip().lower()
        if 'name' in data:
            update_doc['name'] = data['name'].strip()
        if 'role' in data:
            update_doc['role'] = data['role']
        
        if not update_doc:
            return jsonify({"error": "No fields to update"}), 400
        
        # Update user
        result = mongo.db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_doc}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "User not found"}), 404
        
        # Fetch updated user
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)}, {'password': 0})
        formatted = {
            'id': str(user['_id']),
            'email': user.get('email', ''),
            'name': user.get('name', ''),
            'role': user.get('role', 'user'),
            'helmholtz_sub': user.get('helmholtz_sub'),
            'created_at': user.get('_id').generation_time.isoformat() if user.get('_id') else None,
        }
        
        return jsonify(formatted), 200
    
    except Exception as e:
        return jsonify({"error": f"Failed to update user: {str(e)}"}), 500

@admin_bp.route('/api/admin/users/<user_id>', methods=['DELETE'])
@login_required
@require_admin
def delete_user(user_id):
    """
    Delete a user (admin only).
    
    :param user_id: The MongoDB ObjectId string of the user
    :type user_id: str
    :returns: JSON confirmation message
    :rtype: flask.Response
    """
    try:
        # Prevent deleting yourself
        if str(current_user.id) == user_id:
            return jsonify({"error": "Cannot delete your own account"}), 400
        
        result = mongo.db.users.delete_one({'_id': ObjectId(user_id)})
        
        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({"message": "User deleted successfully"}), 200
    
    except Exception as e:
        return jsonify({"error": f"Failed to delete user: {str(e)}"}), 500

