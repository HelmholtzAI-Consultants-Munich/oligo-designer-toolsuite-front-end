import copy
import hashlib
import json


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


def multiline_to_list(val):
    lines = [line.strip() for line in val.split("\n") if line.strip()]
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
