import json
import os

import pytest

from backend.extensions import mongo
from backend.tests.conftest import post
from backend.utilities.validation import parse_run_id


@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for oligoseq API
    form_path = os.path.join(os.path.dirname(__file__), "data/oligoseq_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    return form


def test_oligoseq_authenticated(client, dummy_form, mock_celery, authenticated_user):
    response = post(client, "/api/oligoseq", dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    run_id = parse_run_id(data["run_id"])

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] in {"pending", "started"}


def test_oligoseq_unauthenticated(client, dummy_form, mock_celery, session_user):
    response = post(client, "/api/oligoseq", dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    run_id = parse_run_id(data["run_id"])

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] in {"pending", "started"}


def test_oligoseq_session_without_directory(client, run_id, dummy_form, mock_celery, session_user):
    """Test oligoseq with existing session creates directory and succeeds."""
    # With makedirs mock disabled, directories will be created and request should succeed
    response = post(client, "/api/oligoseq", dummy_form)
    print(response.get_json())
    assert response.status_code == 200
