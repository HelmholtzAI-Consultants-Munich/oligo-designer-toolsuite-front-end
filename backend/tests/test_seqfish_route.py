import json
import os

import pytest

from backend.extensions import mongo
from backend.tests.conftest import assert_invalid_run_id_error, create_test_run


@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for seqfish API
    form_path = os.path.join(os.path.dirname(__file__), "data/seqfish_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    form["runid"] = str(run_id)
    return form


def test_seqfish_authenticated(client, run_id, dummy_form, mock_celery, authenticated_user):
    # Ensure run exists with correct user_id for authenticated user
    create_test_run(run_id, user_id="test_user_id", status="created")

    response = client.post("/api/seqfish", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] in {"pending", "started"}

    response = client.get(f"/api/runs/{run_id}/status")
    data = response.get_json()
    assert data["state"] == "success"

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] == "success"


def test_seqfish_unauthenticated(client, run_id, dummy_form, mock_celery, session_user):
    response = client.post("/api/seqfish", json=dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] in {"pending", "started"}

    response = client.get(f"/api/runs/{run_id}/status")
    data = response.get_json()
    assert data["state"] == "success"

    # Confirm Mongo updated status
    updated = mongo.db.runs.find_one({"_id": run_id})
    assert updated["status"] == "success"


# Error handling tests
def test_seqfish_route_invalid_run_id(client, dummy_form, authenticated_user):
    """Test seqfish route with invalid run ID returns sanitized error."""
    invalid_form = dummy_form.copy()
    invalid_form["runid"] = "invalid_id"

    response = client.post("/api/seqfish", json=invalid_form)
    assert_invalid_run_id_error(response)


def test_seqfish_route_propagates_pipeline_runner_errors(client, run_id, authenticated_user):
    """Test seqfish route propagates PipelineRunner errors correctly."""
    # Test with empty run ID to trigger PipelineRunner error
    form_with_empty_runid = {
        "formdata": {"file_regions": "Gene1"},
        "runid": "",
    }

    response = client.post("/api/seqfish", json=form_with_empty_runid)
    assert_invalid_run_id_error(response)


def test_seqfish_session_without_directory(client, run_id, dummy_form, mock_celery):
    """Test seqfish with existing session creates directory and succeeds."""
    with client.session_transaction() as session:
        # Set a session_id (simulating an existing permanent session)
        session["session_id"] = "existing-session-123"

    # With makedirs mock disabled, directories will be created and request should succeed
    response = client.post("/api/seqfish", json=dummy_form)
    assert response.status_code == 200
