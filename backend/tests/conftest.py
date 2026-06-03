import json
import os
import shutil
import sys
import types
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from bson import ObjectId
from celery.contrib.pytest import (
    celery_enable_logging as celery_enable_logging,
)
from celery.contrib.pytest import (
    celery_includes as celery_includes,
)
from celery.contrib.pytest import (
    celery_worker as celery_worker,
)
from celery.contrib.pytest import (
    celery_worker_pool as celery_worker_pool,
)
from redis import Redis

from backend.app import create_app
from backend.config import Config
from backend.extensions import mongo
from backend.utilities.legal_acceptance import get_current_terms_version
from backend.utilities.typed_values import serialize_path, utc_now
from backend.worker import callbacks as worker_callbacks
from backend.worker import tasks as worker_tasks
from backend.worker.celery import app as worker_app

TEST_DB_NAME = f"odt_pytest_{uuid.uuid4().hex}"
TEST_MONGO_HOST = os.environ.get("PYTEST_MONGO_HOST", "odt-db")
TEST_MONGO_URI = f"mongodb://{TEST_MONGO_HOST}/{TEST_DB_NAME}?serverSelectionTimeoutMS=2000"
os.environ["MONGO_URI"] = TEST_MONGO_URI
os.environ["FLASK_MONGO_URI"] = TEST_MONGO_URI
Config.MONGO_URI = TEST_MONGO_URI

TEST_USER_ID = "507f1f77bcf86cd799439011"
OTHER_USER_ID = "507f1f77bcf86cd799439012"
TEST_SESSION_ID = "anon-session-123"
CELERY_TASK_TIMEOUT = 10

CELERY_TASK_MODULES = (worker_callbacks, worker_tasks)


class AnonymousUser:
    """Minimal Flask-Login anonymous user double used by the default client."""

    is_authenticated = False


class AuthenticatedUser:
    """Minimal Flask-Login authenticated user double with only the id we need."""

    is_authenticated = True

    def __init__(self, user_id: str = TEST_USER_ID) -> None:
        """Store the user id Flask route code reads from current_user.id."""
        self.id = user_id


@dataclass(frozen=True)
class DataRoots:
    """Temp filesystem roots used by tests and app config."""

    root: Path
    uploads: Path
    user_data: Path
    user_dir: Path
    anon_dir: Path


@pytest.fixture(scope="session")
def app(tmp_path_factory: pytest.TempPathFactory) -> Iterator[Any]:
    """Create one Flask app configured for isolated test Mongo and temp paths."""
    data_root = tmp_path_factory.mktemp("data-access")

    os.environ["FLASK_RELATIVE_DATA_ACCESS_PATH"] = str(data_root)
    os.environ["FLASK_RELATIVE_UPLOAD_PATH"] = "uploads"
    os.environ["FLASK_RELATIVE_USERDATA_PATH"] = "user_data"

    with patch("backend.app.initial_dropdown_prefetch"):
        flask_app = create_app()

    flask_app.config.update(
        TESTING=True,
        SECRET_KEY="test-key",
        DATA_ACCESS_PATH=str(data_root),
        UPLOAD_PATH=str(data_root / "uploads"),
        USERDATA_PATH=str(data_root / "user_data"),
        WTF_CSRF_ENABLED=False,
    )

    yield flask_app

    with flask_app.app_context():
        mongo.cx.drop_database(TEST_DB_NAME)
    shutil.rmtree(data_root, ignore_errors=True)


# autouse=True gives every test isolated temp data roots without each test
# needing to request the fixture explicitly.
@pytest.fixture(autouse=True)
def test_data_roots(app: Any, tmp_path: Path) -> Iterator[DataRoots]:
    """Create per-test upload/user-data roots and point Flask config at them."""
    root = tmp_path / "data-access"
    uploads = root / "uploads"
    user_data = root / "user_data"
    user_dir = user_data / TEST_USER_ID
    anon_dir = user_data / "anon" / TEST_SESSION_ID
    uploads.mkdir(parents=True)
    user_dir.mkdir(parents=True)
    anon_dir.mkdir(parents=True)

    app.config["DATA_ACCESS_PATH"] = str(root)
    app.config["UPLOAD_PATH"] = str(uploads)
    app.config["USERDATA_PATH"] = str(user_data)

    yield DataRoots(root=root, uploads=uploads, user_data=user_data, user_dir=user_dir, anon_dir=anon_dir)

    shutil.rmtree(root, ignore_errors=True)


# autouse=True keeps Mongo collections clean before and after every test,
# including tests that do not interact with the database directly.
@pytest.fixture(autouse=True)
def mongo_test_db(app: Any) -> Iterator[None]:
    """Clear every Mongo collection before and after each test."""
    with app.app_context():
        for name in mongo.db.list_collection_names():
            mongo.db[name].delete_many({})
        yield
        for name in mongo.db.list_collection_names():
            mongo.db[name].delete_many({})


@pytest.fixture
def client(app: Any) -> Iterator[Any]:
    """Return a Flask test client whose default current user is anonymous."""
    with patch("flask_login.utils._get_user", return_value=AnonymousUser()):
        with app.test_client() as test_client:
            with app.app_context():
                yield test_client


@pytest.fixture
def authenticate_as() -> Iterator[Callable[[str], AuthenticatedUser]]:
    """Factory fixture that patches Flask-Login to return a chosen user id."""
    active_patches = []

    def _authenticate(user_id: str = TEST_USER_ID) -> AuthenticatedUser:
        """Authenticate subsequent client requests as the given user id."""
        user = AuthenticatedUser(user_id)
        patcher = patch("flask_login.utils._get_user", return_value=user)
        patcher.start()
        active_patches.append(patcher)
        return user

    yield _authenticate

    for patcher in reversed(active_patches):
        patcher.stop()


def _insert_terms_acceptance(**query: str) -> None:
    """Insert current terms acceptance for either a user_id or session_id."""
    mongo.db.legal_acceptances.insert_one(
        {
            **query,
            "document": "terms",
            "terms_version": get_current_terms_version(),
            "timestamp": utc_now(),
        }
    )


@pytest.fixture
def authenticated_user(
    app: Any, client: Any, authenticate_as: Callable[[str], AuthenticatedUser]
) -> Iterator[AuthenticatedUser]:
    """Create and authenticate the default test user with current terms accepted."""
    user = authenticate_as(TEST_USER_ID)
    with app.app_context():
        mongo.db.users.insert_one({"_id": ObjectId(TEST_USER_ID), "username": "test-user", "role": "user"})
        _insert_terms_acceptance(user_id=TEST_USER_ID)
    yield user


@pytest.fixture
def anonymous_session(app: Any, client: Any) -> Iterator[str]:
    """Attach a known anonymous session id and current terms acceptance to client."""
    with client.session_transaction() as sess:
        sess["session_id"] = TEST_SESSION_ID
    with app.app_context():
        _insert_terms_acceptance(session_id=TEST_SESSION_ID)
    yield TEST_SESSION_ID


@pytest.fixture
def run_doc(app: Any) -> Callable[..., ObjectId]:
    """Factory fixture for seeding one pipeline run in MongoDB.

    Tests use this to create the minimal run document needed by route helpers,
    then override ownership, status, output path, or route-specific fields per case.
    """

    def _run_doc(
        *,
        run_id: ObjectId | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        status: str = "created",
        output_path: Path | str | None = None,
        pipeline: str = "merfish",
        **extra: Any,
    ) -> ObjectId:
        """Insert a run document and return its ObjectId.

        `extra` is intentionally kept as a narrow escape hatch for fields that only
        a few tests need, such as `pipeline_run_config` or `error_message`.
        """
        oid = run_id or ObjectId()
        doc = {
            "_id": oid,
            "status": status,
            "pipeline": pipeline,
            # Keep both ownership keys explicit so tests can assert the route wrote
            # the unused side as None rather than leaving stale ownership data behind.
            "user_id": user_id,
            "session_id": session_id,
            "created_at": utc_now(),
            "timestamp": utc_now(),
            **extra,
        }
        if output_path is not None:
            doc["output_path"] = serialize_path(Path(output_path))
        with app.app_context():
            mongo.db.runs.insert_one(doc)
        return oid

    return _run_doc


@pytest.fixture
def pipeline_payload() -> Callable[[str, ObjectId | None], dict[str, Any]]:
    """Return a loader for pipeline request payload JSON files.

    The route tests need real payload shapes, but most tests also need to tweak
    one field before posting, such as an invalid run id, missing formdata, or
    uploaded-file metadata. This fixture only loads a fresh payload copy and
    assigns the run id; the individual test remains responsible for any
    scenario-specific mutation.
    """

    def _load(payload_file: str, run_id: ObjectId | None = None) -> dict[str, Any]:
        with open(Path(__file__).parent / "data" / payload_file) as handle:
            payload = json.load(handle)
        payload["runid"] = str(run_id or ObjectId())
        return payload

    return _load


@pytest.fixture
def multipart_post(
    client: Any,
) -> Callable[[str, dict[str, Any] | None, dict[str, tuple[bytes, str]] | None], Any]:
    """Return a helper for posting pipeline-style multipart requests.

    Pipeline routes receive a JSON string in the `payload` form field and may
    also receive uploaded files in the same multipart request. The helper keeps
    that request encoding in one place while still requiring tests to build the
    payload and choose the route explicitly.
    """

    def _post(
        path: str, payload: dict[str, Any] | None = None, files: dict[str, tuple[bytes, str]] | None = None
    ):
        """Post to one route with an optional JSON payload and in-memory files."""
        data: dict[str, Any] = {}
        if payload is not None:
            data["payload"] = json.dumps(payload)
        for key, (contents, filename) in (files or {}).items():
            data[key] = (BytesIO(contents), filename)
        return client.post(path, data=data, content_type="multipart/form-data")

    return _post


@pytest.fixture
def celery_config() -> dict[str, Any]:
    """Configure celery.contrib.pytest with an isolated Redis DB for chord support."""
    test_redis_uri = f"{Config.REDIS_URI.rstrip('/')}/15"
    return {
        "broker_url": test_redis_uri,
        "result_backend": test_redis_uri,
        "task_always_eager": False,
        "task_store_eager_result": True,
        "task_serializer": "json",
        "result_serializer": "json",
        "accept_content": ["json"],
    }


@pytest.fixture
def celery_worker_parameters() -> dict[str, Any]:
    """Keep celery.contrib.pytest workers lightweight for app-local tasks."""
    return {"perform_ping_check": False, "shutdown_timeout": 10}


@pytest.fixture
def celery_app(celery_config: dict[str, Any]):
    """Use the real worker Celery app with in-memory test transport settings."""
    for task_module in CELERY_TASK_MODULES:
        worker_app.loader.import_task_module(task_module.__name__)
    worker_app.conf.update(celery_config)
    Redis.from_url(celery_config["broker_url"]).flushdb()
    return worker_app


def assert_sanitized_error(response: Any) -> None:
    """Assert an error response does not expose tracebacks, ObjectId internals, or paths."""
    data = response.get_json() or {}
    rendered = str(data)
    assert "Traceback" not in rendered
    assert "InvalidId" not in rendered
    assert "/user_data/" not in rendered
    assert "/uploads/" not in rendered


def pipeline_runner_module(runner_cls: Any):
    """Temporarily provide a lightweight PipelineRunner module for Celery task tests."""
    module = types.ModuleType("backend.worker.pipeline_runner")
    module.PipelineRunner = runner_cls
    return patch.dict(sys.modules, {"backend.worker.pipeline_runner": module})
