"""
Tests for the one rule error relaying relies on: every path handed to the toolsuite is absolute.

error_messages.clean only recognises absolute paths, so a relative one would leak into the
messages shown to users.
"""

import json
import os

import pytest
from glom import glom

from backend.constants import PIPELINE_FILE_INPUT, PIPELINE_MODELS
from backend.tests.conftest import post


@pytest.mark.parametrize("pipeline_name", sorted(PIPELINE_MODELS))
def test_paths_handed_to_the_toolsuite_are_absolute(client, mock_celery, authenticated_user, pipeline_name):
    with open(os.path.join(os.path.dirname(__file__), f"data/{pipeline_name}_mock_form_data.json")) as handle:
        form = json.load(handle)

    response = post(client, f"/api/{pipeline_name}", form)
    assert response.status_code == 200

    _, form_data, output_path = mock_celery.call_args.args[0].body.args
    uploaded_paths = [
        path for field in PIPELINE_FILE_INPUT.get(pipeline_name, []) for path in glom(form_data, field)
    ]

    assert all(os.path.isabs(path) for path in [output_path, *uploaded_paths])
