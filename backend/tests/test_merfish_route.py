import json
import os
import sys

import pytest

# Add project root to sys.path so backend module can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from backend.extensions import mongo
from .conftest import assert_invalid_run_id_error


@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for merfish API
    form_path = os.path.join(os.path.dirname(__file__), "data/merfish_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    form["runid"] = str(run_id)
    return form


def test_merfish_authenticated(client, run_id, dummy_form, mock_celery, authenticated_user):
    # Ensure run exists with correct user_id for authenticated user
    from .conftest import create_test_run

    create_test_run(run_id, user_id="test_user_id", status="created")

    response = client.post("/api/merfish", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] in {"pending", "started"}

    response = client.get(f"/api/runs/{run_id}/state")
    data = response.get_json()
    assert data["state"] == "success"

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] == "success"


# Test unauthenticated user flow for /api/merfish
def test_merfish_unauthenticated(client, run_id, dummy_form, mock_celery, session_user):
    response = client.post("/api/merfish", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] in {"pending", "started"}

    response = client.get(f"/api/runs/{run_id}/state")
    data = response.get_json()
    assert data["state"] == "success"

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] == "success"


# Error handling tests
def test_merfish_route_invalid_run_id(client, dummy_form, authenticated_user):
    """Test merfish route with invalid run ID returns sanitized error."""
    invalid_form = dummy_form.copy()
    invalid_form["runid"] = "invalid_id"

    response = client.post("/api/merfish", json=invalid_form)
    assert_invalid_run_id_error(response)


def test_merfish_route_propagates_pipeline_runner_errors(client, run_id, authenticated_user):
    """Test merfish route propagates PipelineRunner errors correctly."""
    # Test with empty run ID to trigger PipelineRunner error
    form_with_empty_runid = {
        "formdata": {"file_regions": "Gene1"},
        "runid": "",
    }

    response = client.post("/api/merfish", json=form_with_empty_runid)
    assert_invalid_run_id_error(response)


def test_merfish_session_without_directory(client, run_id, dummy_form, mock_celery):
    """Test merfish with existing session creates directory and succeeds."""
    with client.session_transaction() as session:
        # Set a session_id (simulating an existing permanent session)
        session["session_id"] = "existing-session-123"

    # With makedirs mock disabled, directories will be created and request should succeed
    response = client.post("/api/merfish", json=dummy_form)
    assert response.status_code == 200
