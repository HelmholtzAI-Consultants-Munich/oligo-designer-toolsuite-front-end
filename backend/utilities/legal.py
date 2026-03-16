import hashlib
from pathlib import Path

from backend.extensions import mongo
from backend.utilities.typed_values import utc_now

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

LEGAL_STATUS_PUBLISHED = "published"
LEGAL_STATUS_ARCHIVED = "archived"


def _legal_documents_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "legal"


def _default_legal_document_path(document_key: str) -> Path:
    filename = LEGAL_DOCUMENT_FILES.get(document_key)
    if filename is None:
        raise ValueError(f"Unsupported legal document: {document_key}")
    return _legal_documents_dir() / filename


def _latest_legal_document(document_key: str, status: str) -> dict | None:
    sort_field = "published_at"
    return mongo.db.legal_documents.find_one(
        {"document": document_key, "status": status},
        sort=[(sort_field, -1)],
    )


def _serialize_legal_document(document: dict | None) -> dict | None:
    if document is None:
        return None

    body = normalize_legal_body(document["body"])

    return {
        "id": str(document["_id"]),
        "document": document["document"],
        "label": LEGAL_DOCUMENT_LABELS[document["document"]],
        "title": derive_legal_title(document["document"], body),
        "body": body,
        "version": document["version"],
        "status": document["status"],
        "published_at": document.get("published_at").isoformat() if document.get("published_at") else None,
    }


def _create_published_legal_document(document_key: str) -> dict:
    now = utc_now()
    body = normalize_legal_body(_default_legal_document_path(document_key).read_text(encoding="utf-8"))
    version = compute_legal_version(body)

    inserted_id = mongo.db.legal_documents.insert_one(
        {
            "document": document_key,
            "body": body,
            "version": version,
            "status": LEGAL_STATUS_PUBLISHED,
            "published_at": now,
        }
    ).inserted_id

    return mongo.db.legal_documents.find_one({"_id": inserted_id})


def is_supported_legal_document(document_key: str) -> bool:
    return document_key in LEGAL_DOCUMENT_FILES


def normalize_legal_body(body: str) -> str:
    if not isinstance(body, str):
        raise ValueError("Document body must be a string")

    normalized = body.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        raise ValueError("Document body is required")
    return normalized


def derive_legal_title(document_key: str, body: str) -> str:
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or LEGAL_DOCUMENT_LABELS[document_key]
        break
    return LEGAL_DOCUMENT_LABELS[document_key]


def compute_legal_version(body: str) -> str:
    normalized_body = normalize_legal_body(body)
    return hashlib.sha256(normalized_body.encode("utf-8")).hexdigest()[:12]


def ensure_published_legal_document(document_key: str) -> dict:
    if not is_supported_legal_document(document_key):
        raise ValueError(f"Unsupported legal document: {document_key}")

    published_document = _latest_legal_document(document_key, LEGAL_STATUS_PUBLISHED)
    if published_document is not None:
        return published_document

    return _create_published_legal_document(document_key)


def get_published_legal_document(document_key: str) -> dict:
    return _serialize_legal_document(ensure_published_legal_document(document_key))


def get_legal_document_admin_view(document_key: str) -> dict:
    if not is_supported_legal_document(document_key):
        raise ValueError(f"Unsupported legal document: {document_key}")

    history = list(
        mongo.db.legal_documents.find(
            {
                "document": document_key,
                "status": {"$in": [LEGAL_STATUS_PUBLISHED, LEGAL_STATUS_ARCHIVED]},
            }
        ).sort("published_at", -1)
    )

    return {
        "document": document_key,
        "label": LEGAL_DOCUMENT_LABELS[document_key],
        "published": _serialize_legal_document(ensure_published_legal_document(document_key)),
        "history": [_serialize_legal_document(item) for item in history],
    }


def list_legal_document_admin_views() -> list[dict]:
    return [get_legal_document_admin_view(document_key) for document_key in LEGAL_DOCUMENT_FILES]


def publish_legal_document(document_key: str, body: str) -> dict:
    if not is_supported_legal_document(document_key):
        raise ValueError(f"Unsupported legal document: {document_key}")

    normalized_body = normalize_legal_body(body)
    now = utc_now()
    version = compute_legal_version(normalized_body)
    published_document = ensure_published_legal_document(document_key)
    if version == published_document["version"]:
        raise ValueError("Document matches the currently published version")

    mongo.db.legal_documents.update_many(
        {"document": document_key, "status": LEGAL_STATUS_PUBLISHED},
        {
            "$set": {
                "status": LEGAL_STATUS_ARCHIVED,
            }
        },
    )
    mongo.db.legal_documents.delete_many({"document": document_key, "status": "draft"})

    inserted_id = mongo.db.legal_documents.insert_one(
        {
            "document": document_key,
            "body": normalized_body,
            "version": version,
            "status": LEGAL_STATUS_PUBLISHED,
            "published_at": now,
        }
    ).inserted_id
    return mongo.db.legal_documents.find_one({"_id": inserted_id})
