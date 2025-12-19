from ruamel.yaml import YAML
from ruamel.yaml.comments import CommentedMap
import requests
import re


def fetch_yaml_from_github(raw_url):
    """Fetch YAML content from a GitHub raw URL"""
    response = requests.get(raw_url)
    if response.status_code == 200:
        return response.text
    else:
        raise Exception(f"Failed to fetch YAML: {response.status_code}")


def clean_yaml_text(yaml_text):
    """Removes section headers (### ...) and comments (# ...) before processing"""
    lines = yaml_text.split("\n")
    clean_lines = [line for line in lines if not line.strip().startswith("#")]
    return "\n".join(clean_lines)


def extract_inline_comment(d, key):
    """Extract only the inline comment for a key (ignore section headers)."""
    if hasattr(d, "ca") and key in d.ca.items:
        comment_tokens = d.ca.items[key]
        if len(comment_tokens) > 2 and comment_tokens[2]:
            return comment_tokens[2].value.strip().lstrip("#").strip()
    return ""


def escape_js_string(s):
    """Escape special characters for JavaScript strings"""
    return (
        str(s)
        .replace("\\", r"\\")  # Escape backslashes first
        .replace('"', r"\"")  # Then escape double quotes
        .replace("\n", r"\n")  # Escape newlines
        .replace("\r", r"\r")  # Escape carriage returns
        .replace("\t", r"\t")  # Escape tabs
    )


def normalize_key(key):
    """Replace hyphens with underscores in keys"""
    return re.sub(r"-", "", str(key))


def convert_value_to_js(value, comment=""):
    """Convert Python values to JS-like syntax with comments."""
    escaped_comment = escape_js_string(comment)

    if isinstance(value, dict):
        items = [f"    {normalize_key(k)}: {convert_value_to_js(v, comment)}" for k, v in value.items()]
        return "{\n" + ",\n".join(items) + "\n    }"
    elif isinstance(value, list):
        escaped_items = [escape_js_string(item) for item in value]
        return (
            f'{{ value: ["{", ".join(escaped_items)}"], comment: "{escaped_comment}" }}'
        )
    elif isinstance(value, bool):
        return f'{{ value: "{str(value).lower()}", comment: "{escaped_comment}" }}'  # Convert to lowercase string
    else:
        escaped_value = escape_js_string(value)
        return f'{{ value: "{escaped_value}", comment: "{escaped_comment}" }}'


def process_dict(d, indent=4):
    """Recursively process CommentedMap into JS object"""
    items = []
    for k, v in d.items():
        comment = extract_inline_comment(d, k)
        if k == "file_regions":
            v = ""
        normalized_key = normalize_key(k)

        if isinstance(v, CommentedMap):
            nested = process_dict(v, indent + 4)
            items.append(f"{' ' * indent}{normalized_key}: {nested}")
        else:
            items.append(f"{' ' * indent}{normalized_key}: {convert_value_to_js(v, comment)}")

    return "{\n" + ",\n".join(items) + f"\n{' ' * (indent - 4)}}}"


def yaml_to_js(yaml_text):
    """Convert YAML to JS with preserved inline comments and normalized keys"""
    yaml = YAML()
    yaml.preserve_quotes = True
    data = yaml.load(clean_yaml_text(yaml_text))

    # Set both fields to empty string if they exist
    for fasta_key in [
        "files_fasta_target_probe_database",
        "files_fasta_reference_database_target_probe",
        "files_fasta_reference_database_primer",
        "files_fasta_reference_database_readout_probe",
    ]:
        if fasta_key in data:
            data[fasta_key] = ""

    return process_dict(data)


github_raw_url = "https://raw.githubusercontent.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/refs/heads/main/data/configs/oligo_seq_probe_designer.yaml"
yaml_content = fetch_yaml_from_github(github_raw_url)


js_code = yaml_to_js(yaml_content)
full_js = f"const formDatas = {js_code};\n\nexport default formDatas;"
with open("src/forms/oligoseq_form.ts", "w") as f:
    f.write(full_js)
# Example usage
github_raw_url = "https://raw.githubusercontent.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/refs/heads/main/data/configs/scrinshot_probe_designer.yaml"
yaml_content = fetch_yaml_from_github(github_raw_url)


js_code = yaml_to_js(yaml_content)
full_js = f"const formDatas = {js_code};\n\nexport default formDatas;"
with open("src/forms/scrinshot_form.ts", "w") as f:
    f.write(full_js)

github_raw_url = "https://raw.githubusercontent.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/refs/heads/main/data/configs/merfish_probe_designer.yaml"
yaml_content = fetch_yaml_from_github(github_raw_url)


js_code = yaml_to_js(yaml_content)
full_js = f"const formDatas = {js_code};\n\nexport default formDatas;"
with open("src/forms/merfish_form.ts", "w") as f:
    f.write(full_js)


github_raw_url = "https://raw.githubusercontent.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/refs/heads/main/data/configs/seqfish_plus_probe_designer.yaml"
yaml_content = fetch_yaml_from_github(github_raw_url)


js_code = yaml_to_js(yaml_content)
full_js = f"const formDatas = {js_code};\n\nexport default formDatas;"
with open("src/forms/seqfish_form.ts", "w") as f:
    f.write(full_js)


github_raw_url = "https://raw.githubusercontent.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/refs/heads/main/data/configs/genomic_region_generator_custom.yaml"
yaml_content = fetch_yaml_from_github(github_raw_url)


js_code = yaml_to_js(yaml_content)
full_js = f"const form_Data_Custom= {js_code};\n\nexport default form_Data_Custom;"
with open("src/forms/genomic_custom_form.ts", "w") as f:
    f.write(full_js)


github_raw_url = "https://raw.githubusercontent.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/refs/heads/main/data/configs/genomic_region_generator_ncbi.yaml"
yaml_content = fetch_yaml_from_github(github_raw_url)


js_code = yaml_to_js(yaml_content)
full_js = f"const form_Data_Ncbi= {js_code};\n\nexport default form_Data_Ncbi;"
with open("src/forms/genomic_ncbi_form.ts", "w") as f:
    f.write(full_js)

github_raw_url = "https://raw.githubusercontent.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/refs/heads/main/data/configs/genomic_region_generator_ensemble.yaml"
yaml_content = fetch_yaml_from_github(github_raw_url)


js_code = yaml_to_js(yaml_content)
full_js = f"const form_Data_Ens= {js_code};\n\nexport default form_Data_Ens;"
with open("src/forms/genomic_ens_form.ts", "w") as f:
    f.write(full_js)
