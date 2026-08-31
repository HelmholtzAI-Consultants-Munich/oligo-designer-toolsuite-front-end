"""Serves the JSON Schemas the front-end builds its pipeline forms from.

The schemas are generated from ODT's Pydantic models (see `backend.worker.models`) rather than read
from disk, so a new ODT version changes the forms without a checked-in file to regenerate first.
"""

import json
from hashlib import sha256
from http import HTTPStatus

from flask import Blueprint, Response, abort, request

from backend.worker.models import FRONT_END_SCHEMAS, build_pipeline_schema

schemas_bp = Blueprint("schemas", __name__)

# The only place a schema is held. Filled by `warm_pipeline_schemas` at start-up rather than at
# import, because the Celery worker imports the models too and needs none of this.
_SERIALIZED: dict[str, tuple[bytes, str]] = {}


def _serialized_schema(pipeline_name: str) -> tuple[bytes, str]:
    """Returns the pipeline's schema as a response body and its ETag, serializing it once."""
    if pipeline_name not in _SERIALIZED:
        body = json.dumps(build_pipeline_schema(pipeline_name), separators=(",", ":")).encode()
        _SERIALIZED[pipeline_name] = (body, sha256(body).hexdigest())
    return _SERIALIZED[pipeline_name]


def warm_pipeline_schemas() -> None:
    """Builds and serializes every pipeline's schema, so no request is the one that pays for it."""
    for name in FRONT_END_SCHEMAS:
        _serialized_schema(name)


@schemas_bp.route("/api/pipelines/<pipeline_name>/schema", methods=["GET"])
def pipeline_schema(pipeline_name: str) -> Response:
    """Returns the JSON Schema the pipeline's form is built from, or 404 for an unknown name."""
    if pipeline_name not in FRONT_END_SCHEMAS:
        abort(HTTPStatus.NOT_FOUND, description=f'Pipeline "{pipeline_name}" does not exist')

    body, etag = _serialized_schema(pipeline_name)
    response = Response(body, mimetype="application/json")
    # The ETag is a fingerprint of the body: the browser sends it back and gets an empty 304 if
    # nothing changed. `no-cache` means "always ask", not "never cache", so a schema that changed
    # with a new ODT version is never served stale.
    response.set_etag(etag)
    response.cache_control.no_cache = True
    return response.make_conditional(request)
