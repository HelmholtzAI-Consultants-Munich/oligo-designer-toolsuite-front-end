"""
Legal document (terms/privacy) storage and versioning. Versions are
content-addressed (hashed from the body) rather than manually numbered, so
publishing identical content twice is a no-op and users are only asked to
re-accept when the actual text changes.
"""

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
    """Resolved relative to this file rather than the working directory, so
    the seed documents are found regardless of where the app is launched from.

    Returns:
        Path -- directory containing the bundled seed legal documents.
    """
    return Path(__file__).resolve().parent.parent / "legal"


def _default_legal_document_path(document_key: str) -> Path:
    """Used to bootstrap the very first published version of a document from
    a bundled markdown file, before anything exists in the database yet.

    Arguments:
        document_key {str} -- which document (e.g. terms, privacy) to locate.

    Raises:
        ValueError: if document_key isn't one of the known documents.

    Returns:
        Path -- path to the bundled seed file for this document.
    """
    filename = LEGAL_DOCUMENT_FILES.get(document_key)
    if filename is None:
        raise ValueError(f"Unsupported legal document: {document_key}")
    return _legal_documents_dir() / filename


def _latest_legal_document(document_key: str) -> dict | None:
    """Sorts by published_at then _id, since two versions can theoretically
    share a published_at timestamp and _id is the tiebreaker for "most recent".

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
    """Re-fetches after inserting and aborts if it's missing, so callers get
    back the document as MongoDB actually stored it (with its real _id)
    rather than trusting the input dict was written unchanged.

    Arguments:
        document {dict[str, Any]} -- the document to insert.
        collection {Collection} -- which collection to insert into.

    Returns:
        dict[str, Any] -- the inserted document, as read back from the database.
    """
    inserted_id = collection.insert_one(document).inserted_id

    inserted_document = collection.find_one({"_id": inserted_id})
    if inserted_document is None:
        abort(HTTPStatus.INTERNAL_SERVER_ERROR, description="error: could not save legal document")

    return inserted_document


def _serialize_legal_document(document: dict) -> dict:
    """Re-normalizes the body and re-derives the title on every read instead
    of trusting what's stored, so older documents saved before a
    normalization/title-derivation change still render consistently.

    Arguments:
        document {dict} -- the raw legal document from MongoDB.

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
    """Bootstraps the first published version straight from the bundled
    markdown file, so a fresh deployment always has a version to serve
    without requiring a manual admin publish step first.

    Arguments:
        document_key {str} -- which document to bootstrap.

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
    """Validates document_key against the known set before it's used to
    query/build a file path, since it can come straight from a URL parameter.

    Arguments:
        document_key {str} -- the key to check.

    Returns:
        bool -- True if this is a recognized legal document.
    """
    return document_key in LEGAL_DOCUMENT_FILES


def normalize_legal_body(body: str) -> str:
    """Normalizes line endings and trims whitespace before hashing/storing,
    so the same content always produces the same version hash regardless of
    the OS/editor that authored it (e.g. CRLF vs LF).

    Arguments:
        body {str} -- the raw document body to normalize.

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
    """Pulls the title from the body's first markdown heading rather than
    storing it as a separate field, so admins editing the document text
    can't accidentally leave the title out of sync with the content.

    Arguments:
        document_key {str} -- used for the fallback label if no heading is found.
        body {str} -- the document body to look for a heading in.

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
    """Content-addressed version instead of a manually incremented number,
    so identical text always yields the identical version — this is what
    lets publish_legal_document detect "nothing actually changed" and lets
    has_current_terms_acceptance compare versions without a central counter.

    Arguments:
        body {str} -- the document body to hash.

    Returns:
        str -- a short, stable version identifier derived from the body's content.
    """
    normalized_body = normalize_legal_body(body)
    return hashlib.sha256(normalized_body.encode("utf-8")).hexdigest()[:12]


def ensure_published_legal_document(document_key: str) -> dict:
    """Lazily bootstraps from the bundled seed file on first access instead
    of requiring a deploy-time migration step, so every environment always
    has a published version to serve.

    Arguments:
        document_key {str} -- which document to fetch or bootstrap.

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
    """The public-facing accessor used by both the terms/privacy routes and
    the auth flow's terms-version checks, so both always see the same
    currently-published version.

    Arguments:
        document_key {str} -- which document to fetch.

    Returns:
        dict -- the currently published document, formatted for API responses.
    """
    return _serialize_legal_document(ensure_published_legal_document(document_key))


def get_legal_document_admin_view(document_key: str, published_doc: dict | None = None) -> dict:
    """Includes full version history (unlike the public-facing accessor),
    since admins need to see what changed and when. Accepts an
    already-fetched published_doc to avoid a redundant lookup right after
    publish_admin_legal_document() just created it.

    Arguments:
        document_key {str} -- which document to build the admin view for.

    Keyword Arguments:
        published_doc {dict | None} -- pass the just-published document to
        skip re-fetching it. (default: {None})

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
    """Powers the admin legal-documents list page, which shows every
    document at once rather than one at a time.

    Returns:
        list[dict] -- admin view for every known legal document.
    """
    return [get_legal_document_admin_view(document_key) for document_key in LEGAL_DOCUMENT_FILES]


def publish_legal_document(document_key: str, body: str) -> dict:
    """Rejects publishing if the content hashes the same as the current
    version, so re-saving an admin edit that changed nothing doesn't create
    a pointless new version that would force every user to re-accept.

    Arguments:
        document_key {str} -- which document to publish.
        body {str} -- the new document body.

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
