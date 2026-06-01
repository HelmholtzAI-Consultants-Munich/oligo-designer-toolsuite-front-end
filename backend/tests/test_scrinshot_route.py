import json
import os
from datetime import datetime

import pytest

from backend.extensions import db
from backend.tests.conftest import assert_invalid_run_id_error, create_test_run, post


@pytest.fixture
def dummy_form(run_id):
    # Full dummy form data for scrinshot API
    form_path = os.path.join(os.path.dirname(__file__), "data/scrinshot_mock_form_data.json")
    with open(form_path) as f:
        form = json.load(f)
    form["runid"] = str(run_id)
    return form


def test_scrinshot_authenticated(client, dummy_form, run_id, mock_celery, authenticated_user):
    # Ensure run exists with correct user_id for authenticated user
    create_test_run(run_id, user_id="test_user_id", status="created")

    response = post(client, "/api/scrinshot", dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = db.runs.find_one({"_id": run_id})
    assert updated["status"] in {"pending", "started"}
    assert isinstance(updated["timestamp"], datetime)
    assert isinstance(updated["output_path"], dict)


def test_scrinshot_unauthenticated(client, dummy_form, run_id, mock_celery, session_user):
    response = post(client, "/api/scrinshot", dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = db.runs.find_one({"_id": run_id})
    assert updated["status"] in {"pending", "started"}


def test_scrinshot_requires_terms_acceptance(client, dummy_form, run_id, mock_celery):
    response = client.post("/api/scrinshot", json=dummy_form)
    assert response.status_code == 403
    assert "accept the current Terms of Service and Privacy Policy" in response.get_json()["error"]


def test_invalid_session(client, dummy_form, mock_celery, run_id, session_user):
    # Ensure run exists with correct session_id
    create_test_run(run_id, user_id=None, session_id="anon-session-123", status="created")

    response = post(client, "/api/scrinshot", dummy_form)
    assert response.status_code == 200


# Error handling tests
def test_scrinshot_route_invalid_run_id(client, dummy_form, authenticated_user):
    """Test scrinshot route with invalid run ID returns sanitized error."""
    invalid_form = dummy_form.copy()
    invalid_form["runid"] = "invalid_id"

    response = post(client, "/api/scrinshot", invalid_form)
    assert_invalid_run_id_error(response)


def test_scrinshot_route_propagates_pipeline_runner_errors(client, run_id, authenticated_user):
    """Test scrinshot route propagates PipelineRunner errors correctly."""
    # Test with empty run ID to trigger PipelineRunner error
    form_with_empty_runid = {
        "formdata": {"file_regions": "Gene1"},
        "runid": "",
    }

    response = post(client, "/api/scrinshot", form_with_empty_runid)
    assert_invalid_run_id_error(response)


def test_scrinshot_session_without_directory(client, dummy_form, run_id, mock_celery, session_user):
    """Test scrinshot with existing session creates directory and succeeds."""
    # With makedirs mock disabled, directories will be created and request should succeed
    response = post(client, "/api/scrinshot", dummy_form)
    assert response.status_code == 200
