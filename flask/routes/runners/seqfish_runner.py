import json
import os
from .pipeline_runner import PipelineRunner

class SeqfishRunner(PipelineRunner):
    def __init__(self):
        schema_path = os.path.join(os.path.dirname(__file__), 'schemas/seqfish.schema.json')
        with open(schema_path, 'r') as f:
            schema = json.load(f)
        super().__init__('seqfish', 'seqfish_plus_probe_designer', schema)
