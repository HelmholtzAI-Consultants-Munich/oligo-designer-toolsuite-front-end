from http import HTTPStatus

from flask import Blueprint, abort, current_app, jsonify, redirect

from backend.utilities.legal import (
    PRIVACY_DOCUMENT_KEY,
    TERMS_DOCUMENT_KEY,
    get_published_legal_document,
)
from backend.utilities.typed_values import parse_http_url

legal_bp = Blueprint("legal", __name__)


def _frontend_legal_redirect(path: str):
    frontend_url = parse_http_url(current_app.config.get("FRONTEND_URL"))
    if frontend_url is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="Frontend URL configuration is invalid")
    return redirect(f"{frontend_url.geturl().rstrip('/')}{path}", code=HTTPStatus.TEMPORARY_REDIRECT)


@legal_bp.route("/terms", methods=["GET"])
def terms_page():
    return _frontend_legal_redirect("/terms")


@legal_bp.route("/privacy-policy", methods=["GET"])
def privacy_policy_page():
    return _frontend_legal_redirect("/privacy-policy")


@legal_bp.route("/api/legal/terms", methods=["GET"])
def get_terms():
    return jsonify(get_published_legal_document(TERMS_DOCUMENT_KEY)), HTTPStatus.OK


@legal_bp.route("/api/legal/privacy-policy", methods=["GET"])
def get_privacy_policy():
    return jsonify(get_published_legal_document(PRIVACY_DOCUMENT_KEY)), HTTPStatus.OK
