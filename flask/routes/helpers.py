import copy
import hashlib
import json
import os
import re
import shutil

from bson import ObjectId


def get_form_cache_key(form: dict) -> str:
    relevant_part = {
        "source": form.get("source"),
        "source_params": form.get("source_params"),
        "genomic_regions": form.get("genomic_regions"),
    }
    serialized = json.dumps(relevant_part, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


def generate_single_region_forms(form: dict) -> list[dict]:
    """
    Generate separate forms where each form has only one genomic region set to "true",
    and all others set to "false".

    :param form: Original form dictionary with possibly multiple "true" genomic regions
    :return: List of form dictionaries, each with only one "true" genomic region
    """
    true_regions = [key for key, val in form.get("genomic_regions", {}).items() if val["value"] == "true"]

    form_variants = []

    for region in true_regions:
        new_form = copy.deepcopy(form)
        for key in new_form["genomic_regions"]:
            new_form["genomic_regions"][key]["value"] = "true" if key == region else "false"
        form_variants.append(new_form)

    return form_variants


def to_bool(val):
    return True if str(val).lower() == "true" else False


def to_int(val):
    try:
        return int(val)
    except Exception:
        return val


def to_null(val):
    return None if val == "" or str(val).lower() == "null" else val


def split_commas_and_newlines(val):
    lines = [line.strip() for line in re.split(",|\n", val) if line.strip()]
    return lines


def split_on_newline(s):
    if "\n" in s:
        result = []
        parts = s.split("\n")
        for i, part in enumerate(parts):
            if i > 0:
                result.append("\n")
            result.append(part)
        return result
    else:
        return [s]


def delete_pipeline_run_files_and_db(mongo, run_id_obj):
    """
    Shared helper to delete a pipeline run's output files and database entry.

    :param mongo: MongoDB instance
    :param run_id_obj: ObjectId of the run to delete
    :returns: Tuple of (success: bool, error_message: str or None)
    :rtype: tuple
    """
    # Fetch the run
    run = mongo.db.runs.find_one({"_id": run_id_obj})

    if not run:
        return False, "Pipeline run not found"

    # Delete output files/folders
    output_path = run.get("output_path", "")
    if output_path and os.path.exists(output_path):
        try:
            shutil.rmtree(output_path)
        except Exception as e:
            print(f"Warning: Failed to delete output directory {output_path}: {e!s}")
            # Continue with DB deletion even if file deletion fails

    # Remove from database
    result = mongo.db.runs.delete_one({"_id": run_id_obj})

    if result.deleted_count == 0:
        return False, "Failed to delete pipeline run from database"

    return True, None


def validate_and_convert_ids(id_strings: list[str]) -> tuple[list[ObjectId], list[str]]:
    """
    Validate and convert a list of string IDs to MongoDB ObjectIds.

    :param id_strings: List of string IDs to validate and convert
    :type id_strings: List[str]
    :returns: Tuple of (valid_object_ids, invalid_ids)
    :rtype: Tuple[List[ObjectId], List[str]]
    """
    object_ids = []
    invalid_ids = []

    for id_str in id_strings:
        try:
            object_ids.append(ObjectId(id_str))
        except Exception:
            invalid_ids.append(id_str)

    return object_ids, invalid_ids


def execute_bulk_pipeline_run_deletion(mongo, run_id_objects: list[ObjectId]) -> dict:
    """
    Bulk delete multiple pipeline runs using the shared deletion helper.
    Handles partial failures gracefully.

    :param mongo: MongoDB instance
    :param run_id_objects: List of run ID ObjectIds to delete (already validated)
    :type run_id_objects: List[ObjectId]
    :returns: Dictionary with deletion results (deleted_count, failed, errors)
    :rtype: Dict
    """
    # Delete each run using the shared helper
    deleted_count = 0
    failed = []
    errors = []

    for run_id_obj in run_id_objects:
        try:
            success, error = delete_pipeline_run_files_and_db(mongo, run_id_obj)
            if success:
                deleted_count += 1
            else:
                failed.append(str(run_id_obj))
                if error:
                    errors.append(error)
        except Exception as e:
            failed.append(str(run_id_obj))
            errors.append(str(e))

    return {
        "deleted_count": deleted_count,
        "failed": failed,
        "errors": errors,
    }


def validate_id_array(data: dict, key_name: str) -> tuple[list, tuple[dict, int] | None]:
    """
    Validate that a request data dictionary contains a non-empty array of IDs.

    :param data: Request JSON data dictionary
    :type data: Dict
    :param key_name: The key name in the data dict (e.g., 'user_ids', 'run_ids')
    :type key_name: str
    :returns: Tuple of (id_list, error_response) where error_response is None if valid,
              or (error_dict, status_code) if invalid
    :rtype: Tuple[List, Optional[Tuple[Dict, int]]]
    """
    ids = data.get(key_name, [])

    if not ids or not isinstance(ids, list):
        return [], ({"error": f"{key_name} must be a non-empty array"}, 400)

    return ids, None
