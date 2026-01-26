"""
Error Handler Utility for Sanitizing and Polishing Error Messages

This module provides centralized error handling that sanitizes error messages
before returning them to users, ensuring sensitive information is never exposed.
"""

from flask import current_app, jsonify
from bson.errors import InvalidId


# ============================================================================
# Custom Exception Classes
# ============================================================================


class NotFoundError(Exception):
    """Raised when a requested resource is not found."""

    def __init__(self, message: str = "Resource not found"):
        self.message = message
        super().__init__(self.message)


class ForbiddenError(Exception):
    """Raised when access to a resource is forbidden."""

    def __init__(self, message: str = "Unauthorized"):
        self.message = message
        super().__init__(self.message)


class InternalServerError(Exception):
    """Raised when an internal server error occurs."""

    def __init__(self, message: str = "Internal server error"):
        self.message = message
        super().__init__(self.message)


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
        f"Error ({error_type}): {type(exception).__name__}: {exception!s}", exc_info=True
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

    match exception:
        case NotFoundError():
            return exception.message
        case ForbiddenError():
            return exception.message
        case InternalServerError():
            return exception.message
        case InvalidId():
            return "The run ID you provided is not valid. Please check and try again."

        case ValueError():
            # Check for specific ValueError messages
            if "session" in error_str or "session_id" in error_str:
                return "Your session has expired. Please refresh the page and try again."
            if "directory" in error_str or "user_dir" in error_str:
                return "Unable to access your data directory. Please try again or contact support."
            return "The information you provided is not valid. Please check your input and try again."

        case RuntimeError():
            # Check for specific RuntimeError messages
            if (
                "directory" in error_str
                or "not found" in error_str
                or "User directory not found" in str(exception)
                or "/user_data/" in error_str
            ):
                return "Unable to access your data directory. Please try again or contact support."
            if "pipeline" in error_str or "subprocess" in error_str:
                return "The pipeline failed to execute. Please check your input and try again."
            return "An error occurred while running the pipeline. Please try again."

        case FileNotFoundError():
            return "A required file is missing. Please check your input files and try again."

        case PermissionError():
            # Permission errors are internal server issues - users can't fix file permissions
            return "Something went wrong while accessing files. Please try again or contact support if the problem persists."

        case KeyError():
            return "Some required information is missing. Please check your input and try again."

        case _:
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
    match exception:
        case NotFoundError():
            return 404
        case ForbiddenError():
            return 403
        case InternalServerError():
            return 500
        case InvalidId():
            return 400
        case ValueError():
            return 400
        case RuntimeError():
            # RuntimeError for missing directories should be 400 (bad request)
            error_str = str(exception).lower()
            if (
                "directory" in error_str
                or "not found" in error_str
                or "User directory not found" in str(exception)
            ):
                return 400
            # Other runtime errors are server errors
            return 500
        case FileNotFoundError():
            return 404
        case PermissionError():
            # Permission errors are internal server issues, not user permission issues
            return 500
        case KeyError():
            return 400
        case _:
            # Default to 500 for server errors
            return 500
