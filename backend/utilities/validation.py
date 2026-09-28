"""
Functions for validating and converting request input: ObjectId strings, id arrays, and genomic form data.
"""

from http import HTTPStatus

from bson import ObjectId
from flask import abort


def parse_run_id(run_id_str: str | None) -> ObjectId:
    """Converts and validates a run_id string from the request JSON body.

    Arguments:
        run_id_str {str | None} -- the run id string from request JSON.

    Notes:
        For a run_id in the URL path, use the <ObjectId:run_id> route
        converter instead, which validates automatically.

    Raises:
        BadRequest: if run_id_str is empty or isn't a valid ObjectId.

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
    """Validates and converts a list of string ids to MongoDB ObjectIds.

    Arguments:
        id_strings {list[str]} -- ids to validate and convert.

    Notes:
        Lets bulk endpoints process the good ids and report which were
        invalid, rather than aborting the whole batch over one bad id.

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
    """Validates that the request body contains a non-empty array under the given key.

    Arguments:
        data {dict} -- request JSON body.
        key_name {str} -- which key holds the id array (e.g. "user_ids", "run_ids").

    Notes:
        Shared by every bulk admin endpoint, so they all reject a
        missing/empty/non-list payload the same way.

    Raises:
        BadRequest: if key_name is missing, empty, or not a list.

    Returns:
        list -- the id array, guaranteed non-empty.
    """
    ids = data.get(key_name, [])

    if not ids or not isinstance(ids, list):
        abort(400, description=f"{key_name} must be a non-empty array")

    return ids


def validate_genomic_form_data(form_data: dict, allowed_sources: list[str] | None = None) -> None:
    """Validates the shape of a submitted genomic region-generation form.

    Arguments:
        form_data {dict} -- the region-generation form to validate.

    Keyword Arguments:
        allowed_sources {list[str] | None} -- override when a pipeline
        supports a different/narrower set of sources than the default.
        (default: {None})

    Raises:
        BadRequest: if form_data is empty, source is missing or not in
        allowed_sources, genomic_regions is missing, or file_region_ids is
        missing for the "Custom" source.
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
