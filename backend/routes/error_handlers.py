"""
Error Handler Registration for Flask Application

This module registers centralized error handlers that ensure all HTTP errors
(from abort()) and unexpected exceptions return consistent JSON responses.
Sensitive information is never exposed to clients.
"""

from http import HTTPStatus

from flask import Flask, current_app, jsonify
from werkzeug.exceptions import HTTPException


def register_error_handlers(app: Flask):
    """Register centralized error handlers on the Flask app.

    Arguments:
        app {Flask} -- the Flask application instance.

    Notes:
        This centralizes error responses so every abort()/unhandled exception
        always returns consistent JSON, instead of each route having to format
        its own error response or risk leaking a stack trace to the client.
    """

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        """Handle Flask HTTPException (from abort()).

        Arguments:
            error {HTTPException} -- carries the description passed to
            abort(), which is safe to show the user (unlike a raw exception
            message).

        Returns:
            flask.Response -- JSON error with the original status code.
        """
        message = error.description or "Something went wrong."
        status_code = error.code or HTTPStatus.INTERNAL_SERVER_ERROR
        return jsonify({"error": message}), status_code

    @app.errorhandler(Exception)
    def handle_generic_exception(error: Exception):
        """Catch-all for anything not raised via abort(). Logs the real
        exception server-side but returns a generic message to the client.

        Arguments:
            error {Exception} -- the unhandled exception.

        Notes:
            An unhandled exception's message could expose internals, so the
            client only ever sees the generic message.

        Returns:
            flask.Response -- generic JSON 500 error.
        """
        current_app.logger.error(
            f"Unhandled exception: {type(error).__name__}: {error!s}",
            exc_info=True,
        )
        message = "Something went wrong. Please try again or contact support if the problem persists."
        return jsonify({"error": message}), HTTPStatus.INTERNAL_SERVER_ERROR
