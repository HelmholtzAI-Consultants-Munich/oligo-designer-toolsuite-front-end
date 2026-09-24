"""Serves the JSON Schemas the front-end builds its pipeline forms from.

The schemas are generated from ODT's Pydantic models (see `backend.worker.models`) rather than read
from disk, so a new ODT version changes the forms without a checked-in file to regenerate first.
"""

import json
from functools import cache
from hashlib import sha256
from http import HTTPStatus
from importlib.resources import files

import yaml
from flask import Blueprint, Response, abort, jsonify, request
from glom import delete

from backend.constants import PIPELINE_FILE_INPUT
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


# The file name prefix of each pipeline's example configs shipped by ODT. A suffix after it names a
# variant, e.g. `cycle_hcr_probe_designer_gandin.yaml` holds the defaults from Gandin et al.
PRESET_FILE_PREFIXES = {
    "oligoseq": "oligo_seq_probe_designer",
    "scrinshot": "scrinshot_probe_designer",
    "merfish": "merfish_probe_designer",
    "seqfish": "seqfish_plus_probe_designer",
    "hcr": "hcr_probe_designer",
    "cyclehcr": "cycle_hcr_probe_designer",
}


@cache
def load_presets(pipeline_name: str) -> list[dict]:
    """Reads the pipeline's example configs shipped with ODT as importable form configs.

    Arguments:
        pipeline_name {str} -- the pipeline's key in `FRONT_END_SCHEMAS`

    Returns:
        {list[dict]} -- one `{id, label, payload}` per config, where `payload` has the shape of an
        exported form config; empty for an ODT version that does not ship its configs
    """
    try:
        config_dir = files("oligo_designer_toolsuite.configs")
    except ModuleNotFoundError:
        return []

    prefix = PRESET_FILE_PREFIXES[pipeline_name]
    presets = []
    for file in sorted(config_dir.iterdir(), key=lambda f: f.name):
        if not (file.name.startswith(prefix) and file.name.endswith(".yaml")):
            continue
        preset_id = file.name.removeprefix(prefix).removesuffix(".yaml").lstrip("_") or "default"
        config = yaml.safe_load(file.read_text())
        # the file paths are local to ODT's repository, so the user uploads or generates their
        # own; `general` is not part of the form
        schema_version = config.pop("schema_version", None)
        config.pop("required_parameters", None)
        config.pop("general", None)
        for path in PIPELINE_FILE_INPUT.get(pipeline_name, []):
            delete(config, path, ignore_missing=True)
        presets.append(
            {
                "id": preset_id,
                "label": preset_id.replace("_", " ").title(),
                "payload": {
                    "_meta": {"version": schema_version, "pipeline": pipeline_name},
                    "config": config,
                },
            }
        )
    return presets


@schemas_bp.route("/api/pipelines/<pipeline_name>/presets", methods=["GET"])
def pipeline_presets(pipeline_name: str) -> Response:
    """Returns the pipeline's default configs to choose from, or 404 for an unknown name."""
    if pipeline_name not in FRONT_END_SCHEMAS:
        abort(HTTPStatus.NOT_FOUND, description=f'Pipeline "{pipeline_name}" does not exist')
    return jsonify(load_presets(pipeline_name))
