"""Legal document (terms/privacy) storage and versioning, using content-addressed version identifiers hashed from the document body."""

import hashlib
from http import HTTPStatus
from pathlib import Path
from typing import Any

from flask import abort
from pymongo.synchronous.collection import Collection

from backend.extensions import db
from backend.utils import utc_now

TERMS_DOCUMENT_KEY = "terms"
PRIVACY_DOCUMENT_KEY = "privacy-policy"

LEGAL_DOCUMENT_FILES = {
    TERMS_DOCUMENT_KEY: "terms.md",
    PRIVACY_DOCUMENT_KEY: "privacy-policy.md",
}

LEGAL_DOCUMENT_LABELS = {
    TERMS_DOCUMENT_KEY: "Terms of Service",
    PRIVACY_DOCUMENT_KEY: "Data Protection Declaration",
}


def _legal_documents_dir() -> Path:
    """Resolves the directory containing the bundled legal document markdown files (backend/legal/).

    Notes:
        This is resolved relative to this file rather than the working
        directory so these files are found regardless of where the app is
        launched from.

    Returns:
        Path -- directory containing the bundled terms.md/privacy-policy.md files.
    """
    return Path(__file__).resolve().parent.parent / "legal"


def _default_legal_document_path(document_key: str) -> Path:
    """Locates the bundled markdown file for a legal document (e.g. backend/legal/terms.md).

    Arguments:
        document_key {str} -- which document (e.g. terms, privacy) to locate.

    Notes:
        Used by _create_published_legal_document to load the initial text
        the first time a document is published, before any version exists
        in the database.

    Raises:
        ValueError: if document_key isn't one of the known documents.

    Returns:
        Path -- path to the bundled markdown file for this document.
    """
    filename = LEGAL_DOCUMENT_FILES.get(document_key)
    if filename is None:
        raise ValueError(f"Unsupported legal document: {document_key}")
    return _legal_documents_dir() / filename


def _latest_legal_document(document_key: str) -> dict | None:
    """Looks up the most recently published version of a document.

    Arguments:
        document_key {str} -- which document to look up.

    Returns:
        dict | None -- the most recently published version, or None if this
        document has never been published yet.
    """
    return db.legal_documents.find_one(
        {"document": document_key},
        sort=[("published_at", -1), ("_id", -1)],
    )


def insert_with_check(document: dict[str, Any], collection: Collection) -> dict[str, Any]:
    """Inserts a document into a collection and re-fetches it to confirm the write.

    Arguments:
        document {dict[str, Any]} -- the document to insert.
        collection {Collection} -- which collection to insert into.

    Notes:
        Re-fetching after inserting ensures callers get back the document as
        MongoDB actually stored it (with its real _id) rather than trusting
        the input dict was written unchanged.

    Returns:
        dict[str, Any] -- the inserted document, as read back from the database.
    """
    inserted_id = collection.insert_one(document).inserted_id

    inserted_document = collection.find_one({"_id": inserted_id})
    if inserted_document is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="error: could not save legal document")

    return inserted_document


def _serialize_legal_document(document: dict) -> dict:
    """Formats a raw legal document for API responses.

    Arguments:
        document {dict} -- the raw legal document from MongoDB.

    Notes:
        The body is re-normalized and the title re-derived on every read
        instead of trusting what's stored, so older documents saved before a
        normalization/title-derivation change still render consistently.

    Returns:
        dict -- document formatted for API responses.
    """
    body = normalize_legal_body(document["body"])

    return {
        "id": str(document["_id"]),
        "document": document["document"],
        "title": derive_legal_title(document["document"], body),
        "body": body,
        "version": document["version"],
        "published_at": document.get("published_at").isoformat() if document.get("published_at") else None,
    }


def _create_published_legal_document(document_key: str) -> dict:
    """Bootstraps the first published version of a document from the bundled markdown file.

    Arguments:
        document_key {str} -- which document to bootstrap.

    Notes:
        This ensures a fresh deployment always has a version to serve
        without requiring a manual admin publish step first.

    Returns:
        dict -- the newly created, published document.
    """
    now = utc_now()
    body = normalize_legal_body(_default_legal_document_path(document_key).read_text(encoding="utf-8"))
    version = compute_legal_version(body)

    return insert_with_check(
        {
            "document": document_key,
            "body": body,
            "version": version,
            "published_at": now,
        },
        db.legal_documents,
    )


def is_supported_legal_document(document_key: str) -> bool:
    """Checks whether document_key is a recognized legal document.

    Arguments:
        document_key {str} -- the key to check.

    Notes:
        This validates document_key against the known set before it's used
        to query or build a file path, since it can come straight from a URL
        parameter.

    Returns:
        bool -- True if this is a recognized legal document.
    """
    return document_key in LEGAL_DOCUMENT_FILES


def normalize_legal_body(body: str) -> str:
    """Normalizes line endings and trims whitespace from a document body.

    Arguments:
        body {str} -- the raw document body to normalize.

    Notes:
        Normalizing before hashing/storing ensures identical content always
        produces the same version hash, regardless of the OS/editor that
        authored it.

    Raises:
        ValueError: if body isn't a string, or is empty after normalizing.

    Returns:
        str -- normalized body.
    """
    if not isinstance(body, str):
        raise ValueError("Document body must be a string")

    normalized = body.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        raise ValueError("Document body is required")
    return normalized


def derive_legal_title(document_key: str, body: str) -> str:
    """Derives a document's title from its first markdown heading.

    Arguments:
        document_key {str} -- used for the fallback label if no heading is found.
        body {str} -- the document body to look for a heading in.

    Notes:
        Deriving the title from the body rather than storing it as a
        separate field means admins editing the document text can't
        accidentally leave the title out of sync with the content.

    Returns:
        str -- the derived title, or the document's default label if the
        body has no leading heading.
    """
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or LEGAL_DOCUMENT_LABELS[document_key]
        break
    return LEGAL_DOCUMENT_LABELS[document_key]


def compute_legal_version(body: str) -> str:
    """Computes a content-addressed version identifier for a document body.

    Arguments:
        body {str} -- the document body to hash.

    Returns:
        str -- a short, stable version identifier derived from the body's content.
    """
    normalized_body = normalize_legal_body(body)
    return hashlib.sha256(normalized_body.encode("utf-8")).hexdigest()[:12]


def ensure_published_legal_document(document_key: str) -> dict:
    """Gets the currently published document, bootstrapping it if none exists.

    Arguments:
        document_key {str} -- which document to fetch or bootstrap.

    Notes:
        This lazily creates the first published version from the bundled
        markdown file on first access instead of requiring a deploy-time
        migration step, so every environment always has a published
        version to serve.

    Raises:
        ValueError: if document_key isn't a known document.

    Returns:
        dict -- the currently published document (existing or newly created).
    """
    if not is_supported_legal_document(document_key):
        raise ValueError(f"Unsupported legal document: {document_key}")

    published_document = _latest_legal_document(document_key)
    if published_document is not None:
        return published_document

    return _create_published_legal_document(document_key)


def get_published_legal_document(document_key: str) -> dict:
    """Gets the currently published document, formatted for API responses.

    Arguments:
        document_key {str} -- which document to fetch.

    Notes:
        This is the public-facing accessor used by both the terms/privacy
        routes and the auth flow's terms-version checks, so both always see
        the same currently-published version.

    Returns:
        dict -- the currently published document, formatted for API responses.
    """
    return _serialize_legal_document(ensure_published_legal_document(document_key))


def get_legal_document_admin_view(document_key: str, published_doc: dict | None = None) -> dict:
    """Builds the admin view for a document, including its full version history.

    Arguments:
        document_key {str} -- which document to build the admin view for.

    Keyword Arguments:
        published_doc {dict | None} -- pass the just-published document to
        skip re-fetching it. (default: {None})

    Notes:
        Pass published_doc when the caller already has it (e.g. right after
        publish_admin_legal_document()) to skip a redundant lookup.

    Raises:
        ValueError: if document_key isn't a known document.

    Returns:
        dict -- the current version plus full publish history.
    """
    if not is_supported_legal_document(document_key):
        raise ValueError(f"Unsupported legal document: {document_key}")

    if published_doc is None:
        published_doc = ensure_published_legal_document(document_key)
    published_document = _serialize_legal_document(published_doc)
    history = list(db.legal_documents.find({"document": document_key}).sort("_id", -1))

    return {
        "document": document_key,
        "title": published_document["title"],
        "published": published_document,
        "history": [_serialize_legal_document(item) for item in history],
    }


def list_legal_document_admin_views() -> list[dict]:
    """Builds the admin view for every known legal document.

    Notes:
        This powers the admin legal-documents list page, which shows every
        document at once rather than one at a time.

    Returns:
        list[dict] -- admin view for every known legal document.
    """
    return [get_legal_document_admin_view(document_key) for document_key in LEGAL_DOCUMENT_FILES]


def publish_legal_document(document_key: str, body: str) -> dict:
    """Publishes a new version of a document.

    Arguments:
        document_key {str} -- which document to publish.
        body {str} -- the new document body.

    Notes:
        Rejected if the content hashes the same as the current version, so
        a no-op edit doesn't force every user to re-accept.

    Raises:
        ValueError: if document_key isn't a known document, or if the body
        matches the currently published version.

    Returns:
        dict -- the newly published document.
    """
    if not is_supported_legal_document(document_key):
        raise ValueError(f"Unsupported legal document: {document_key}")

    normalized_body = normalize_legal_body(body)
    now = utc_now()
    version = compute_legal_version(normalized_body)
    published_document = ensure_published_legal_document(document_key)
    if version == published_document["version"]:
        raise ValueError("Document matches the currently published version")

    return insert_with_check(
        {
            "document": document_key,
            "body": normalized_body,
            "version": version,
            "published_at": now,
        },
        db.legal_documents,
    )
