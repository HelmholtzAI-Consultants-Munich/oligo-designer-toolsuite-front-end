"""Shared pytest fixtures for all backend tests.

Notes:
    Provides test database isolation, per-test filesystem roots, and authentication
    helpers so individual test modules stay focused on route/task behavior.
"""

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
from backend.extensions import client as mongo_client
from backend.extensions import db
from backend.utilities.legal_acceptance import get_current_terms_version
from backend.utilities.typed_values import serialize_path
from backend.utils import utc_now
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

    def get_id(self) -> str:
        """Return the user id as Flask-Login's UserMixin.get_id() would, for rate-limit key funcs."""
        return self.id


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
    """Create one Flask app per test session, pointed at the isolated Mongo and temp filesystem.

    Arguments:
        tmp_path_factory {pytest.TempPathFactory} -- pytest factory for session-scoped temp directories

    Notes:
        Session scope means startup cost is paid once, while per-test fixtures
        handle data isolation.

    Yields:
        Iterator[Any] -- Flask application instance configured for testing
    """
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
        mongo_client.drop_database(TEST_DB_NAME)
    shutil.rmtree(data_root, ignore_errors=True)


@pytest.fixture(autouse=True)
def test_data_roots(app: Any, tmp_path: Path) -> Iterator[DataRoots]:
    """Create per-test upload and user-data directories.

    Arguments:
        app {Any} -- Flask application instance whose config is updated to point at the fresh roots
        tmp_path {Path} -- pytest-provided per-test temp directory

    Notes:
        Per-test directories ensure path-existence assertions in one test are
        never affected by files left by another.

    Yields:
        Iterator[DataRoots] -- per-test temp filesystem roots with Flask config pointing at them
    """
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


@pytest.fixture(autouse=True)
def mongo_test_db(app: Any) -> Iterator[None]:
    """Clear every MongoDB collection before and after each test.

    Arguments:
        app {Any} -- Flask application instance providing the app context

    Notes:
        This prevents contamination from a previously failed test run that
        skipped teardown.

    Yields:
        Iterator[None] -- yields inside the app context with a clean database
    """
    with app.app_context():
        for name in db.list_collection_names():
            db[name].delete_many({})
        yield
        for name in db.list_collection_names():
            db[name].delete_many({})


@pytest.fixture
def client(app: Any) -> Iterator[Any]:
    """Provide a Flask test client with an anonymous current_user.

    Arguments:
        app {Any} -- Flask application instance

    Notes:
        Tests can use this to assert on routes that behave differently for
        unauthenticated callers. We patch the internal `flask_login.utils._get_user`
        because Flask-Login has no public testing hook for overriding `current_user`.

    Yields:
        Iterator[Any] -- Flask test client with anonymous current_user
    """
    with patch("flask_login.utils._get_user", return_value=AnonymousUser()):
        with app.test_client() as test_client:
            with app.app_context():
                yield test_client


@pytest.fixture
def authenticate_as() -> Iterator[Callable[[str], AuthenticatedUser]]:
    """Provide a factory that patches Flask-Login to return a chosen user.

    Notes:
        Tests can authenticate without inserting a user document or accepted
        terms.

    Yields:
        Iterator[Callable[[str], AuthenticatedUser]] -- callable that accepts a user_id and patches current_user for the remainder of the test
    """
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
    db.legal_acceptances.insert_one(
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
    """Insert a real user document and current terms acceptance, and authenticate as that user.

    Arguments:
        app {Any} -- Flask application instance providing the app context
        client {Any} -- Flask test client (unused directly but ensures the client fixture is active)
        authenticate_as {Callable[[str], AuthenticatedUser]} -- factory that patches Flask-Login to return the test user

    Notes:
        Routes that query MongoDB for role and consent status need this data
        seeded directly, so no extra per-test setup is required.

    Yields:
        Iterator[AuthenticatedUser] -- the patched current_user for the default test user
    """
    user: AuthenticatedUser = authenticate_as(TEST_USER_ID)
    with app.app_context():
        db.users.insert_one({"_id": ObjectId(TEST_USER_ID), "username": "test-user", "role": "user"})
        _insert_terms_acceptance(user_id=TEST_USER_ID)
    yield user


@pytest.fixture
def anonymous_session(app: Any, client: Any) -> Iterator[str]:
    """Attach a known session_id and current terms acceptance to the client.

    Arguments:
        app {Any} -- Flask application instance providing the app context
        client {Any} -- Flask test client whose session receives the known session_id

    Notes:
        This lets anonymous routes be exercised and assertions reference the
        fixed TEST_SESSION_ID.

    Yields:
        Iterator[str] -- the fixed anonymous session id
    """
    with client.session_transaction() as sess:
        sess["session_id"] = TEST_SESSION_ID
    with app.app_context():
        _insert_terms_acceptance(session_id=TEST_SESSION_ID)
    yield TEST_SESSION_ID


@pytest.fixture
def run_doc(app: Any) -> Callable[..., ObjectId]:
    """Factory fixture — pytest injects the returned callable, not a document.

    Arguments:
        app {Any} -- Flask application instance providing the app context

    Notes:
        Calling run_doc(...) inside a test inserts one run document and returns its
        ObjectId. Tests can call it multiple times with different arguments to seed
        several documents in the same test (e.g. one owned run and one unowned run).

    Returns:
        Callable[..., ObjectId] -- callable that inserts a run document and returns its ObjectId
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

        Keyword Arguments:
            run_id {ObjectId | None} -- pass a known id only when the test asserts on a specific document lookup; generates a fresh one otherwise (default: {None})
            user_id {str | None} -- omit for anonymous-owned runs (default: {None})
            session_id {str | None} -- omit for user-owned runs (default: {None})
            status {str} -- initial run status; most tests use the default (default: {"created"})
            output_path {Path | str | None} -- omit for tests that don't exercise file serving or deletion (default: {None})
            pipeline {str} -- pipeline name stored on the document (default: {"merfish"})

        Returns:
            ObjectId -- id of the inserted run document
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
            db.runs.insert_one(doc)
        return oid

    return _run_doc


@pytest.fixture
def pipeline_payload() -> Callable[[str, ObjectId | None], dict[str, Any]]:
    """Return a loader for pipeline request payload JSON files.

    Notes:
        Each call produces a fresh copy so tests can mutate it without
        affecting sibling tests.

    Returns:
        Callable[[str, ObjectId | None], dict[str, Any]] -- loader that accepts a filename and optional run_id
    """

    def _load(payload_file: str, run_id: ObjectId | None = None) -> dict[str, Any]:
        """Load a payload JSON file and return a fresh copy with runid set.

        Arguments:
            payload_file {str} -- which pipeline's payload shape to load from tests/data/

        Keyword Arguments:
            run_id {ObjectId | None} -- pass a known id only when the test needs to assert the server ignored it; omit otherwise (default: {None})

        Notes:
            Returning a fresh copy prevents mutations in one test from bleeding
            into another.

        Returns:
            dict[str, Any] -- payload dict with runid set, ready to post
        """
        with open(Path(__file__).parent / "data" / payload_file) as handle:
            payload = json.load(handle)
        payload["runid"] = str(run_id or ObjectId())
        return payload

    return _load


@pytest.fixture
def multipart_post(
    client: Any,
) -> Callable[[str, dict[str, Any] | None, dict[str, tuple[bytes, str]] | None], Any]:
    """Return a helper that encodes and posts pipeline-style multipart requests.

    Arguments:
        client {Any} -- Flask test client that will send the requests

    Notes:
        This lets tests state only what they want to send, not how to
        serialize it.

    Returns:
        Callable[[str, dict[str, Any] | None, dict[str, tuple[bytes, str]] | None], Any] -- post helper that handles JSON serialization and BytesIO wrapping
    """

    def _post(
        path: str, payload: dict[str, Any] | None = None, files: dict[str, tuple[bytes, str]] | None = None
    ):
        """Encode and post a multipart request.

        Arguments:
            path {str} -- route to post to

        Keyword Arguments:
            payload {dict[str, Any] | None} -- pipeline submission data; serialized into the `payload` form field as the route expects (default: {None})
            files {dict[str, tuple[bytes, str]] | None} -- uploaded files keyed by form field name; each value is (raw bytes, filename) (default: {None})

        Notes:
            This means tests don't have to manually serialize JSON or construct
            BytesIO wrappers.

        Returns:
            Any -- Flask test client response
        """
        data: dict[str, Any] = {}
        if payload is not None:
            data["payload"] = json.dumps(payload)
        for key, (contents, filename) in (files or {}).items():
            data[key] = (BytesIO(contents), filename)
        return client.post(path, data=data, content_type="multipart/form-data")

    return _post


@pytest.fixture
def celery_config() -> dict[str, Any]:
    """Configure the test Celery worker to use an isolated Redis database.

    Notes:
        Redis DB #15 is used so test tasks don't share state with the dev or
        production broker (typically DB 0).

    Returns:
        dict[str, Any] -- Celery configuration overrides for the test worker
    """
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
def isolated_redis(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Point Config.REDIS_URI at the isolated test Redis database (#15) and flush it around each test.

    Arguments:
        monkeypatch {pytest.MonkeyPatch} -- reverts the patched config after the test

    Notes:
        queue_accounting.py and cache.py read Config.REDIS_URI at call time,
        so patching the shared class attribute is enough without patching
        each call site.

    Yields:
        Iterator[None] -- yields with Config.REDIS_URI already pointed at the isolated database
    """
    test_redis_uri = f"{Config.REDIS_URI.rstrip('/')}/15"
    monkeypatch.setattr(Config, "REDIS_URI", test_redis_uri)
    client = Redis.from_url(test_redis_uri)
    client.flushdb()
    yield
    client.flushdb()
    client.close()


@pytest.fixture
def celery_worker_parameters() -> dict[str, Any]:
    """Disable the ping check and cap shutdown timeout for celery.contrib.pytest workers.

    Notes:
        This keeps workers lightweight so slow tasks don't hang the test
        suite.

    Returns:
        dict[str, Any] -- celery.contrib.pytest worker parameter overrides
    """
    return {"perform_ping_check": False, "shutdown_timeout": 10}


@pytest.fixture
def celery_app(celery_config: dict[str, Any]):
    """Configure the real worker Celery app to use the test broker.

    Arguments:
        celery_config {dict[str, Any]} -- Celery configuration overrides from the celery_config fixture

    Notes:
        Using the real app rather than a fake one ensures task routing and
        chords behave identically to production.

    Returns:
        Celery -- the production worker app reconfigured to use the test broker and flushed before each test
    """
    for task_module in CELERY_TASK_MODULES:
        worker_app.loader.import_task_module(task_module.__name__)
    worker_app.conf.update(celery_config)
    Redis.from_url(celery_config["broker_url"]).flushdb()
    return worker_app


def assert_sanitized_error(response: Any) -> None:
    """Assert an error response does not expose tracebacks, ObjectId internals, or filesystem paths.

    Arguments:
        response {Any} -- Flask test client response whose JSON body must not contain internal details

    Notes:
        Each forbidden fragment is checked individually so a partial leak of one
        pattern cannot be masked by the absence of another.
    """
    data = response.get_json() or {}
    rendered = str(data)
    assert "Traceback" not in rendered
    assert "InvalidId" not in rendered
    assert "/user_data/" not in rendered
    assert "/uploads/" not in rendered


def pipeline_runner_module(runner_cls: Any):
    """Swap the real pipeline_runner module for a fake one in sys.modules.

    Arguments:
        runner_cls {Any} -- mock or stub class to expose as PipelineRunner in the fake module

    Notes:
        pipeline_runner.py imports genomic_regions_file.py, which pulls in Biopython
        and oligo_designer_toolsuite visualization packages not installed in CI. Those
        imports run at module load time so the file crashes before any mock can help.
        Injecting a fake module into sys.modules means Python never touches the
        real file, so its visualization imports never run.

    Returns:
        patch.dict -- context manager that installs the fake module for the test duration
    """
    module = types.ModuleType("backend.worker.pipeline_runner")
    module.PipelineRunner = runner_cls
    return patch.dict(sys.modules, {"backend.worker.pipeline_runner": module})
