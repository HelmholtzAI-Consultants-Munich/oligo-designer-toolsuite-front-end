import json
import os

from .pipeline_runner import PipelineRunner

PIPELINE_SUBPROCESS = {
    "scrinshot": "scrinshot_probe_designer",
    "seqfish": "seqfish_plus_probe_designer",
    "merfish": "merfish_probe_designer",
    "oligoseq": "oligo_seq_probe_designer",
}


def get_runner(pipeline_name) -> PipelineRunner:
    schema_path = os.path.join(os.path.dirname(__file__), f"schemas/{pipeline_name}.schema.json")
    with open(schema_path) as f:
        schema = json.load(f)
    return PipelineRunner(pipeline_name, PIPELINE_SUBPROCESS[pipeline_name], schema)
