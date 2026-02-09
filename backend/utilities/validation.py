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
