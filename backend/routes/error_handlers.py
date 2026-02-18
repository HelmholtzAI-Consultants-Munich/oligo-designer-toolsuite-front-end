"""
Error Handler Registration for Flask Application

This module registers centralized error handlers that ensure all HTTP errors
(from abort()) and unexpected exceptions return consistent JSON responses.
Sensitive information is never exposed to clients.
"""

from http import HTTPStatus

from flask import Flask, current_app, jsonify, request
from werkzeug.exceptions import HTTPException


def _is_genomic_endpoint() -> bool:
    """Check if the current request targets a genomic endpoint."""
    return bool(request.endpoint and "genomic" in request.endpoint)


def _make_error_response(message: str, status_code: int):
    """
    Build a JSON error response, using the genomic envelope when appropriate.
    """
    if _is_genomic_endpoint():
        return jsonify(
            {
                "status": "error",
                "message": message,
                "error": message,
            }
        ), status_code

    return jsonify({"error": message}), status_code


def register_error_handlers(app: Flask):
    """
    Register error handlers on the Flask application.

    This function registers handlers for:
    - HTTPException (from Flask's abort() function) -- returns the description
      as a user-facing message, with special formatting for genomic endpoints.
    - Catch-all Exception -- logs full details server-side and returns a
      generic 500 message.

    Args:
        app: The Flask application instance
    """

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        """Handle Flask HTTPException (from abort())."""
        message = error.description or "Something went wrong."
        status_code = error.code or HTTPStatus.INTERNAL_SERVER_ERROR
        return _make_error_response(message, status_code)

    @app.errorhandler(Exception)
    def handle_generic_exception(error: Exception):
        """Catch-all handler for any unhandled exceptions."""
        current_app.logger.error(
            f"Unhandled exception: {type(error).__name__}: {error!s}",
            exc_info=True,
        )
        message = "Something went wrong. Please try again or contact support if the problem persists."
        return _make_error_response(message, HTTPStatus.INTERNAL_SERVER_ERROR)
