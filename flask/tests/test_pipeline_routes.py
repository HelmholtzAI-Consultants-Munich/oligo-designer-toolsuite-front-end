import os
import tempfile
import shutil
from bson import ObjectId
from unittest.mock import patch, MagicMock
import pytest
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app
from extensions import mongo


@pytest.fixture
def client(monkeypatch):
    app = create_app()
    app.config['TESTING'] = True
    app.secret_key = 'test-key'

    class AnonymousUser:
        is_authenticated = False

    monkeypatch.setattr("flask_login.utils._get_user", lambda: AnonymousUser())

    with app.test_client() as client:
        with app.app_context():
            yield client

@pytest.fixture()
def run_id():
    return ObjectId()

@pytest.fixture
def output_path(tmp_path, run_id):
    output_path = tmp_path / "run_output"
    output_path.mkdir()
    (output_path / "log.txt").write_text("log content")
    (output_path / "config.yaml").write_text("config content")

    mongo.db.runs.insert_one({
        "_id": run_id,
        "user_id": "dummy_user",
        "pipeline": "TestPipeline",
        "status": "completed",
        "timestamp": "2025_08_20",
        "output_path": str(output_path)
    })

    return str(output_path)


def test_init_run_id(client):
    response = client.post("/api/init_run_id")
    assert response.status_code == 200
    assert "run_id" in response.get_json()


def test_get_pipeline_runs_authenticated(client, monkeypatch):
    class DummyUser:
        is_authenticated = True
        id = "dummy_user"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

    mongo.db.runs.insert_one({
        "user_id": DummyUser.id,
        "pipeline": "TestPipeline",
        "status": "completed",
        "timestamp": "2025_08_20",
        "output_path": "/tmp/fake"
    })

    response = client.get("/api/pipelines")
    assert response.status_code == 200
    assert isinstance(response.get_json(), list)


def test_get_run_files(client, monkeypatch, run_id, output_path):
    class DummyUser:
        is_authenticated = True
        id = "dummy_user"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

    response = client.get(f"/api/runs/{run_id}/files")
    assert response.status_code == 200
    data = response.get_json()
    assert any("log.txt" in file["name"] for file in data)
    assert any("config.yaml" in file["name"] for file in data)


def test_get_run_file_success(client, monkeypatch, run_id, output_path):
    class DummyUser:
        is_authenticated = True
        id = "dummy_user"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

    response = client.get(f"/api/runs/{run_id}/files/log.txt")
    assert response.status_code == 200
    assert response.data == b"log content"


def test_delete_run_success(client, monkeypatch, run_id, output_path):
    class DummyUser:
        is_authenticated = True
        id = "dummy_user"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

    response = client.delete(f"/api/runs/{run_id}")
    assert response.status_code == 200
    assert not os.path.exists(output_path)


def test_get_run_file_not_found(client, monkeypatch, run_id):
    class DummyUser:
        is_authenticated = True
        id = "dummy_user"

    monkeypatch.setattr("flask_login.utils._get_user", lambda: DummyUser())

    response = client.get(f"/api/runs/{run_id}/files/nonexistent.txt")
    assert response.status_code == 404