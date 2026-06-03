"""Pipeline route-to-Celery integration tests using celery.contrib.pytest."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from backend.config import CeleryConfig
from backend.extensions import mongo
from backend.tests.conftest import (
    CELERY_TASK_TIMEOUT,
    TEST_SESSION_ID,
    TEST_USER_ID,
    pipeline_runner_module,
)
from backend.worker import tasks as task_module


@pytest.fixture
def route_celery_app(celery_app):
    """Make the Flask route dispatch to the Celery app managed by celery_worker."""
    with patch("backend.routes.pipelines.celery_app", celery_app):
        yield celery_app


def _clear_generated_regions(payload):
    """Remove generated-region forms so the route dispatches only the pipeline body task."""
    for field, value in payload["formdata"].items():
        if isinstance(value, dict) and "fasta_form" in value:
            value["fasta_form"] = []
    return payload


def test_start_pipeline_runs_generated_regions_then_pipeline_task(
    client,
    authenticated_user,
    run_doc,
    pipeline_payload,
    multipart_post,
    route_celery_app,
    celery_worker,
):
    """Generated-region header tasks feed their results into the pipeline body task."""
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = pipeline_payload("merfish_mock_form_data.json", run_id)
    pipeline_runner_cls = MagicMock()

    with (
        patch("backend.routes.pipelines.calculate_queue_position", return_value=(0, 0)),
        patch("backend.worker.tasks.GenomicRegionGeneratorRunner") as generator_cls,
        pipeline_runner_module(pipeline_runner_cls),
    ):
        generator_cls.return_value.run.return_value = ["generated.fna"]

        response = multipart_post("/api/merfish", payload)

        assert response.status_code == 200
        run = mongo.db.runs.find_one({"_id": run_id})
        route_celery_app.AsyncResult(run["task_id"]).get(timeout=CELERY_TASK_TIMEOUT)

    # Current MERFISH fixture payload contains four generated FASTA region forms.
    expected_generated_region_count = 4
    assert generator_cls.return_value.run.call_count == expected_generated_region_count
    pipeline_runner_cls.assert_called_once_with("merfish", logger=task_module.logger)
    pipeline_runner_cls.return_value.run.assert_called_once()

    form_data, output_path, generated_regions = pipeline_runner_cls.return_value.run.call_args.args
    assert form_data["file_regions"] == payload["formdata"]["file_regions"]
    assert output_path == str(Path(*mongo.db.runs.find_one({"_id": run_id})["output_path"]["parts"]))
    assert len(generated_regions) == expected_generated_region_count
    assert all(paths == ["generated.fna"] for _field, paths in generated_regions)


def test_start_pipeline_without_generated_regions_runs_pipeline_task(
    client,
    authenticated_user,
    run_doc,
    pipeline_payload,
    multipart_post,
    route_celery_app,
    celery_worker,
):
    """The route still dispatches the pipeline task when no header tasks are needed."""
    run_id = run_doc(user_id=TEST_USER_ID)
    payload = _clear_generated_regions(pipeline_payload("merfish_mock_form_data.json", run_id))
    pipeline_runner_cls = MagicMock()

    with (
        patch("backend.routes.pipelines.calculate_queue_position", return_value=(0, 0)),
        patch("backend.worker.tasks.GenomicRegionGeneratorRunner") as generator_cls,
        pipeline_runner_module(pipeline_runner_cls),
    ):
        response = multipart_post("/api/merfish", payload)

        assert response.status_code == 200
        run = mongo.db.runs.find_one({"_id": run_id})
        route_celery_app.AsyncResult(run["task_id"]).get(timeout=CELERY_TASK_TIMEOUT)

    generator_cls.return_value.run.assert_not_called()
    pipeline_runner_cls.return_value.run.assert_called_once()
    assert pipeline_runner_cls.return_value.run.call_args.args[2] == []


@pytest.mark.parametrize(
    ("user_fixture", "owner", "expected_priority"),
    [
        ("authenticated_user", {"user_id": TEST_USER_ID}, CeleryConfig.task_high_priority),
        ("anonymous_session", {"session_id": TEST_SESSION_ID}, CeleryConfig.task_default_priority),
    ],
)
def test_pipeline_route_dispatches_task_with_expected_priority(
    request,
    client,
    run_doc,
    pipeline_payload,
    multipart_post,
    route_celery_app,
    celery_worker,
    user_fixture,
    owner,
    expected_priority,
):
    """Authenticated and anonymous submissions preserve priority through Celery dispatch."""
    request.getfixturevalue(user_fixture)
    run_id = run_doc(**owner)
    payload = _clear_generated_regions(pipeline_payload("merfish_mock_form_data.json", run_id))
    observed_priorities = []
    pipeline_runner_cls = MagicMock()

    def record_priority(*_args, **_kwargs):
        """Capture the Celery delivery priority visible inside the running task."""
        observed_priorities.append(
            task_module.run_pipeline.request.delivery_info.get("priority", CeleryConfig.task_default_priority)
        )

    with (
        patch("backend.routes.pipelines.calculate_queue_position", return_value=(0, 0)),
        pipeline_runner_module(pipeline_runner_cls),
    ):
        pipeline_runner_cls.return_value.run.side_effect = record_priority

        response = multipart_post("/api/merfish", payload)

        assert response.status_code == 200
        run = mongo.db.runs.find_one({"_id": run_id})
        route_celery_app.AsyncResult(run["task_id"]).get(timeout=CELERY_TASK_TIMEOUT)

    assert observed_priorities == [expected_priority]
