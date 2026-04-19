from http import HTTPStatus

from bson import ObjectId
from flask import abort


def parse_run_id(run_id_str: str | None) -> ObjectId:
    """Convert a run_id string from JSON body to ObjectId.

    Use this for validating run_id from request JSON body (e.g., pipelines.py).
    For URL path parameters, use the ObjectId URL converter instead:
        @app.route("/api/runs/<ObjectId:run_id>")

    :param run_id_str: The ObjectId string from request JSON
    :type run_id_str: str | None
    :returns: The validated ObjectId
    :rtype: ObjectId
    :raises: 400 if the string is empty or not a valid ObjectId format
    """
    if not run_id_str:
        abort(400, description="Run ID is required")
    try:
        return ObjectId(run_id_str)
    except Exception:
        abort(400, description="Invalid run ID format")


def validate_and_convert_ids(id_strings: list[str]) -> tuple[list[ObjectId], list[str]]:
    """
    Validate and convert a list of string IDs to MongoDB ObjectIds.

    :param id_strings: List of string IDs to validate and convert
    :type id_strings: list[str]
    :returns: Tuple of (valid_object_ids, invalid_ids)
    :rtype: tuple[list[ObjectId], list[str]]
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
    """
    Validate that a request data dictionary contains a non-empty array of IDs.

    :param data: Request JSON data dictionary
    :type data: dict
    :param key_name: The key name in the data dict (e.g., 'user_ids', 'run_ids')
    :type key_name: str
    :returns: The validated list of ID strings
    :rtype: list
    :raises: 400 if the key is missing or not a non-empty array
    """
    ids = data.get(key_name, [])

    if not ids or not isinstance(ids, list):
        abort(400, description=f"{key_name} must be a non-empty array")

    return ids


def get_valid_file_keys():
    """
    Get the list of valid form data keys that a generated
    genomic regions file can be used for.
    """
    return [
        "files_fasta_target_probe_database",
        "files_fasta_reference_database_target_probe",
        "files_fasta_reference_database_readout_probe",
        "files_fasta_reference_database_primer",
    ]


def validate_file_key(id: str) -> None:
    if id not in get_valid_file_keys():
        abort(
            HTTPStatus.BAD_REQUEST,
            description="Invalid input: genomic region generation cannot be used for specified key",
        )


def validate_genomic_form_data(form_data: dict, allowed_sources: list[str] | None = None) -> None:
    """
    Validate genomic form data structure and required fields.

    Args:
        form_data: The form data dictionary to validate
        allowed_sources: List of allowed source values. Defaults to ["NCBI", "Ensembl"]

    Raises:
        400: If validation fails
    """
    if allowed_sources is None:
        allowed_sources = ["NCBI", "Ensembl"]

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
    if form_data["source"] == "Custom" and "file_regions" not in form_data:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid input: file_regions is required for Custom source")
