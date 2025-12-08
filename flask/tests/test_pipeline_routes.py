import os
from bson import ObjectId
from unittest.mock import patch
import pytest
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture(autouse=True)
def mock_make_dir():
    with patch("os.makedirs"):
        yield

@pytest.fixture()
def run_id():
    return ObjectId()

@pytest.fixture
def output_path(mongo, tmp_path, run_id, dummy_current_user):
    output_path = tmp_path / "run_output"
    output_path.mkdir()
    (output_path / "log.txt").write_text("log content")
    (output_path / "config.yaml").write_text("config content")

    mongo.db.runs.insert_one({
        "_id": run_id,
        "user_id": dummy_current_user.id,
        "pipeline": "TestPipeline",
        "status": "completed",
        "timestamp": "2025_08_20",
        "output_path": str(output_path)
    })

    return str(output_path)


def test_init_run_id(client, session_user):
    response = client.post("/api/init_run_id")
    assert response.status_code == 200
    assert "run_id" in response.get_json()


def test_get_pipeline_runs_authenticated(client, mongo, monkeypatch, dummy_current_user, authenticated_user):
    mongo.db.runs.insert_one({
        "user_id": dummy_current_user.id,
        "pipeline": "TestPipeline",
        "status": "completed",
        "timestamp": "2025_08_20",
        "output_path": "/tmp/fake"
    })

    response = client.get("/api/pipelines")
    assert response.status_code == 200
    assert isinstance(response.get_json(), list)


def test_get_run_files(client, monkeypatch, authenticated_user, run_id, output_path):
    with client.session_transaction() as session:
        print("HEY", session["session_id"])
        print(output_path)

    response = client.get(f"/api/runs/{run_id}/files")
    print(response.get_json())
    assert response.status_code == 200
    data = response.get_json()
    assert any("log.txt" in file["name"] for file in data)
    assert any("config.yaml" in file["name"] for file in data)


def test_get_run_file_success(client, monkeypatch, authenticated_user, run_id, output_path):
    response = client.get(f"/api/runs/{run_id}/files/log.txt")
    assert response.status_code == 200
    assert response.data == b"log content"


def test_delete_run_success(client, monkeypatch, authenticated_user, run_id, output_path):
    response = client.delete(f"/api/runs/{run_id}")
    assert response.status_code == 200
    assert not os.path.exists(output_path)


def test_get_run_file_not_found(client, monkeypatch, authenticated_user, run_id):
    response = client.get(f"/api/runs/{run_id}/files/nonexistent.txt")
    assert response.status_code == 404

def test_runid_null(client, session_user):
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "success"
        mock_run.return_value.stderr = ""

        form = {
            "runid": None
        }

        response = client.post("/api/scrinshot", json=form)
        assert response.status_code == 400

def test_get_files_valid_runid_unused(client, session_user):
        response = client.get(f"/api/runs/{ObjectId()}/files")
        assert response.status_code == 404

def test_get_files_invalid_runid(client, session_user):
        run_id = "hallo"

        response = client.get(f"/api/runs/{run_id}/files")
        assert response.status_code == 400
