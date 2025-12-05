import copy
from typing import Dict, List
import hashlib
import json
import re
import os
import shutil

def get_form_cache_key(form: dict) -> str:
    relevant_part = {
        "source": form.get("source"),
        "source_params": form.get("source_params"),
        "genomic_regions": form.get("genomic_regions"),
    }
    serialized = json.dumps(relevant_part, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()

def generate_single_region_forms(form: Dict) -> List[Dict]:
    """
    Generate separate forms where each form has only one genomic region set to "true",
    and all others set to "false".

    :param form: Original form dictionary with possibly multiple "true" genomic regions
    :return: List of form dictionaries, each with only one "true" genomic region
    """
    true_regions = [
        key for key, val in form.get("genomic_regions", {}).items() if val["value"] == "true"
    ]

    form_variants = []

    for region in true_regions:
        new_form = copy.deepcopy(form)
        for key in new_form["genomic_regions"]:
            new_form["genomic_regions"][key]["value"] = "true" if key == region else "false"
        form_variants.append(new_form)

    return form_variants
def to_bool(val):
    return True if str(val).lower() == 'true' else False

def to_int(val):
    try:
        return int(val)
    except:
        return val

def to_null(val):
    return None if val == "" or str(val).lower() == "null" else val

def split_commas_and_newlines(val):
    lines = [line.strip() for line in re.split(',|\n', val) if line.strip()]
    return lines

def split_on_newline(s):
    if '\n' in s:
        result = []
        parts = s.split('\n')
        for i, part in enumerate(parts):
            if i > 0:
                result.append('\n')
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
    run = mongo.db.runs.find_one({'_id': run_id_obj})
    
    if not run:
        return False, "Pipeline run not found"
    
    # Delete output files/folders
    output_path = run.get('output_path', '')
    if output_path and os.path.exists(output_path):
        try:
            shutil.rmtree(output_path)
        except Exception as e:
            print(f"Warning: Failed to delete output directory {output_path}: {str(e)}")
            # Continue with DB deletion even if file deletion fails
    
    # Remove from database
    result = mongo.db.runs.delete_one({'_id': run_id_obj})
    
    if result.deleted_count == 0:
        return False, "Failed to delete pipeline run from database"
    
    return True, None

