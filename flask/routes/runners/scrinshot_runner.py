import json
import os
from .pipeline_runner import PipelineRunner

class ScrinshotRunner(PipelineRunner):
    def __init__(self):
        schema_path = os.path.join(os.path.dirname(__file__), 'schemas/scrinshot.schema.json')
        with open(schema_path, 'r') as f:
            schema = json.load(f)
        super().__init__('scrinshot', 'scrinshot_probe_designer', schema)
