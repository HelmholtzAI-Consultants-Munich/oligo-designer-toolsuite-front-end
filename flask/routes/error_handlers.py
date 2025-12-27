"""
Error Handler Utility for Sanitizing and Polishing Error Messages

This module provides centralized error handling that sanitizes error messages
before returning them to users, ensuring sensitive information is never exposed.
"""

import traceback
from flask import current_app, jsonify
from bson.errors import InvalidId


def create_user_error_response(exception: Exception, error_type: str = "submission") -> tuple:
    """
    Create a sanitized, user-friendly error response.

    Logs full error details server-side for debugging but returns only
    user-friendly messages to the client. Never exposes file paths, stack traces,
    or internal system details.

    Args:
        exception: The exception that was raised
        error_type: Type of error - "submission" (immediate) or "run" (async)

    Returns:
        Tuple of (jsonify response, HTTP status code)
    """
    # Log full error details server-side for debugging
    current_app.logger.error(
        f"Error ({error_type}): {type(exception).__name__}: {str(exception)}",
        exc_info=True
    )

    # Sanitize error message based on exception type
    error_message = _sanitize_error_message(exception)

    # Return sanitized error response
    return jsonify({"error": error_message}), _get_http_status_code(exception)


def _sanitize_error_message(exception: Exception) -> str:
    """
    Sanitize exception message to be user-friendly.

    Maps specific exception types to descriptive, actionable messages
    while concealing sensitive information.
    """
    error_str = str(exception).lower()

    # Handle specific exception types
    if isinstance(exception, InvalidId):
        return "The run ID you provided is not valid. Please check and try again."

    if isinstance(exception, ValueError):
        # Check for specific ValueError messages
        if "session" in error_str or "session_id" in error_str:
            return "Your session has expired. Please refresh the page and try again."
        if "directory" in error_str or "user_dir" in error_str:
            return "Unable to access your data directory. Please try again or contact support."
        return "The information you provided is not valid. Please check your input and try again."

    if isinstance(exception, RuntimeError):
        # Check for specific RuntimeError messages
        if "directory" in error_str or "not found" in error_str or "User directory not found" in str(exception) or "/user_data/" in error_str:
            return "Unable to access your data directory. Please try again or contact support."
        if "pipeline" in error_str or "subprocess" in error_str:
            return "The pipeline failed to execute. Please check your input and try again."
        return "An error occurred while running the pipeline. Please try again."

    if isinstance(exception, FileNotFoundError):
        return "A required file is missing. Please check your input files and try again."

    if isinstance(exception, PermissionError):
        # Permission errors are internal server issues - users can't fix file permissions
        return "Something went wrong while accessing files. Please try again or contact support if the problem persists."

    if isinstance(exception, KeyError):
        return "Some required information is missing. Please check your input and try again."

    # Check error message content for sensitive patterns
    if any(pattern in error_str for pattern in ["/user_data/", "/tmp/", "traceback", "stack trace"]):
        return "An error occurred while processing your request"

    # Generic fallback - still sanitize the message
    if len(str(exception)) > 200:
        # Truncate very long error messages
        return "An error occurred while processing your request"

    # Return a generic message for unknown errors
    return "Something went wrong. Please try again or contact support if the problem persists."


def _get_http_status_code(exception: Exception) -> int:
    """
    Determine appropriate HTTP status code based on exception type.
    """
    if isinstance(exception, InvalidId):
        return 400
    if isinstance(exception, ValueError):
        return 400
    if isinstance(exception, RuntimeError):
        # RuntimeError for missing directories should be 400 (bad request)
        error_str = str(exception).lower()
        if "directory" in error_str or "not found" in error_str or "User directory not found" in str(exception):
            return 400
        # Other runtime errors are server errors
        return 500
    if isinstance(exception, FileNotFoundError):
        return 404
    if isinstance(exception, PermissionError):
        # Permission errors are internal server issues, not user permission issues
        return 500
    if isinstance(exception, KeyError):
        return 400
    # Default to 500 for server errors
    return 500


def sanitize_error_message_for_storage(exception: Exception) -> str:
    """
    Sanitize error message for storage in database.

    Used for async pipeline runs where errors are stored in MongoDB.
    Returns user-friendly message suitable for displaying to users later.
    """
    return _sanitize_error_message(exception)

