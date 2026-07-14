"""
Request-input validation shared across routes: converting/validating
ObjectId strings (single or batches) and checking submitted genomic form
shape, so every route rejects malformed input with the same clear 400
instead of failing later with an obscure error.
"""

from http import HTTPStatus

from bson import ObjectId
from flask import abort


def parse_run_id(run_id_str: str | None) -> ObjectId:
    """For run_id values coming from the JSON body rather than the URL path,
    where the ObjectId URL converter can't validate it automatically —
    converts and validates here instead, so a malformed id fails with a
    clear 400 instead of an obscure ObjectId construction error.

    Arguments:
        run_id_str {str | None} -- the run id string from request JSON.

    Notes:
        For URL path parameters, use the ObjectId URL converter instead:
            @app.route("/api/runs/<ObjectId:run_id>")

    Returns:
        ObjectId -- the validated ObjectId.
    """
    if not run_id_str:
        abort(400, description="Run ID is required")
    try:
        return ObjectId(run_id_str)
    except Exception:
        abort(400, description="Invalid run ID format")


def validate_and_convert_ids(id_strings: list[str]) -> tuple[list[ObjectId], list[str]]:
    """Splits ids into valid/invalid instead of failing on the first bad one,
    since bulk endpoints (bulk-delete, bulk-update) should still process the
    good ids and report which ones were invalid, rather than aborting the
    whole batch over a single malformed id.

    Arguments:
        id_strings {list[str]} -- ids to validate and convert.

    Returns:
        tuple[list[ObjectId], list[str]] -- (valid_object_ids, invalid_ids).
    """
    object_ids = []
    invalid_ids = []

    for id_str in id_strings:
        try:
            object_ids.append(ObjectId(id_str))
        except Exception:
            invalid_ids.append(id_str)

    return object_ids, invalid_ids


def validate_id_array(data: dict, key_name: str) -> list:
    """Shared by every bulk admin endpoint (bulk-delete/update for users and
    runs), so they all reject a missing/empty/non-list payload with the
    same error message instead of each re-implementing this check slightly
    differently.

    Arguments:
        data {dict} -- request JSON body.
        key_name {str} -- which key holds the id array (e.g. "user_ids", "run_ids").

    Returns:
        list -- the id array, guaranteed non-empty.
    """
    ids = data.get(key_name, [])

    if not ids or not isinstance(ids, list):
        abort(400, description=f"{key_name} must be a non-empty array")

    return ids


def validate_genomic_form_data(form_data: dict, allowed_sources: list[str] | None = None) -> None:
    """Requires file_region_ids specifically for the "Custom" source, since
    that's the only source where regions come from user-uploaded data
    rather than a database lookup by source — everything else can rely on
    genomic_regions alone.

    Arguments:
        form_data {dict} -- the region-generation form to validate.

    Keyword Arguments:
        allowed_sources {list[str] | None} -- override when a pipeline
        supports a different/narrower set of sources than the default.
        (default: {None})
    """
    if allowed_sources is None:
        allowed_sources = ["ncbi", "ensembl"]

    if not form_data:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: form data is required")
    if "source" not in form_data:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: source is required")
    if form_data["source"] not in allowed_sources:
        abort(
            HTTPStatus.BAD_REQUEST,
            description=f"Invalid input: source must be one of {', '.join(repr(s) for s in allowed_sources)}",
        )
    if "genomic_regions" not in form_data:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: genomic_regions is required")
    if form_data["source"] == "Custom" and "file_region_ids" not in form_data:
        abort(
            HTTPStatus.BAD_REQUEST, description="Invalid input: file_region_ids is required for Custom source"
        )
