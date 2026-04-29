from http import HTTPStatus

from flask import Blueprint, jsonify

from backend.utilities.legal import (
    PRIVACY_DOCUMENT_KEY,
    TERMS_DOCUMENT_KEY,
    get_published_legal_document,
)

legal_bp = Blueprint("legal", __name__)


@legal_bp.route("/api/legal/terms", methods=["GET"])
def get_terms():
    return jsonify(get_published_legal_document(TERMS_DOCUMENT_KEY)), HTTPStatus.OK


@legal_bp.route("/api/legal/privacy-policy", methods=["GET"])
def get_privacy_policy():
    return jsonify(get_published_legal_document(PRIVACY_DOCUMENT_KEY)), HTTPStatus.OK
