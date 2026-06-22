import json
import os

import pytest

from backend.extensions import db
from backend.tests.conftest import assert_invalid_run_id_error, create_test_run, get_with_check, post

pytest.skip("Merfish currently disabled", allow_module_level=True)


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

    create_test_run(run_id, user_id="507f1f77bcf86cd799439011", status="created")

    response = post(client, "/api/merfish", dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = get_with_check({"_id": run_id}, db.runs)
    assert updated["status"] in {"pending", "started"}


# Test unauthenticated user flow for /api/merfish
def test_merfish_unauthenticated(client, run_id, dummy_form, mock_celery, session_user):
    response = post(client, "/api/merfish", dummy_form)
    assert response.status_code == 200
    data = response.get_json()
    assert data["run_id"] == str(run_id)

    # Confirm Mongo updated status
    updated = get_with_check({"_id": run_id}, db.runs)
    assert updated["status"] in {"pending", "started"}


# Error handling tests
def test_merfish_route_invalid_run_id(client, dummy_form, authenticated_user):
    """Test merfish route with invalid run ID returns sanitized error."""
    invalid_form = dummy_form.copy()
    invalid_form["runid"] = "invalid_id"

    response = post(client, "/api/merfish", invalid_form)
    assert_invalid_run_id_error(response)


def test_merfish_route_propagates_pipeline_runner_errors(client, run_id, authenticated_user):
    """Test merfish route propagates PipelineRunner errors correctly."""
    # Test with empty run ID to trigger PipelineRunner error
    form_with_empty_runid = {
        "formdata": {"file_regions": "Gene1"},
        "runid": "",
    }

    response = post(client, "/api/merfish", form_with_empty_runid)
    assert_invalid_run_id_error(response)


def test_merfish_session_without_directory(client, run_id, dummy_form, mock_celery, session_user):
    """Test merfish with existing session creates directory and succeeds."""
    # With makedirs mock disabled, directories will be created and request should succeed
    response = post(client, "/api/merfish", dummy_form)
    assert response.status_code == 200
