import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import pytest

from extensions import mongo
from conftest import assert_invalid_run_id_error


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
    from conftest import create_test_run

    create_test_run(run_id, user_id="test_user_id", status="created")

    response = client.post("/api/scrinshot", json=dummy_form)
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


def test_scrinshot_unauthenticated(client, dummy_form, run_id, mock_celery, session_user):
    response = client.post("/api/scrinshot", json=dummy_form)
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


@pytest.mark.xfail(reason="User directory creation gets mocked")
def test_invalid_session(client, dummy_form, run_id, mock_celery):
    # Ensure run exists with correct session_id
    from conftest import create_test_run

    create_test_run(run_id, user_id=None, session_id="gaeuhfwuahfuagdzgawuzdgauwgdu", status="created")

    with client.session_transaction() as session:
        session["session_id"] = "gaeuhfwuahfuagdzgawuzdgauwgdu"

    response = client.post("/api/scrinshot", json=dummy_form)
    assert response.status_code == 200


# Error handling tests
def test_scrinshot_route_invalid_run_id(client, dummy_form, authenticated_user):
    """Test scrinshot route with invalid run ID returns sanitized error."""
    invalid_form = dummy_form.copy()
    invalid_form["runid"] = "invalid_id"

    response = client.post("/api/scrinshot", json=invalid_form)
    assert_invalid_run_id_error(response)


def test_scrinshot_route_propagates_pipeline_runner_errors(client, run_id, authenticated_user):
    """Test scrinshot route propagates PipelineRunner errors correctly."""
    # Test with empty run ID to trigger PipelineRunner error
    form_with_empty_runid = {
        "formdata": {"file_regions": "Gene1"},
        "runid": "",
    }

    response = client.post("/api/scrinshot", json=form_with_empty_runid)
    assert_invalid_run_id_error(response)
