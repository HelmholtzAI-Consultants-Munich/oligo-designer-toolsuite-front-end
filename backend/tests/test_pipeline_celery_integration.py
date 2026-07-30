"""Integration tests that verify the full route-to-Celery task chain executes correctly."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from bson import ObjectId
from glom import assign

from backend.config import CeleryConfig
from backend.extensions import db
from backend.tests.conftest import CELERY_TASK_TIMEOUT, pipeline_runner_module
from backend.worker import tasks as task_module


@pytest.fixture
def route_celery_app(celery_app):
    """Redirect Flask route dispatching to the test worker.

    Arguments:
        celery_app {Celery} -- test-configured Celery app from the celery_app fixture

    Notes:
        Routes import the Celery app at module load time, so it must be patched
        per test rather than configured globally.

    Yields:
        Celery -- the same celery_app, while the route patch is active
    """
    with patch("backend.routes.pipelines.celery_app", celery_app):
        yield celery_app


def _clear_generated_regions(payload):
    """Strip genomic region inputs from the payload.

    Arguments:
        payload {dict} -- pipeline submission payload loaded from a JSON fixture file

    Notes:
        This lets tests isolate the pipeline body task without header tasks
        running first.

    Returns:
        dict -- the same payload with all generated-region database fields set to empty lists
    """
    assign(payload["formdata"], "target_probe.oligo_generation.files_fasta_probe_database", [])
    assign(
        payload["formdata"],
        "target_probe.specificity_filters.specificity_blastn_filter.files_fasta_reference_database",
        [],
    )
    return payload


def test_start_pipeline_runs_generated_regions_then_pipeline_task(
    authenticated_user,
    pipeline_payload,
    multipart_post,
    route_celery_app,
    celery_worker,
):
    """Header tasks must complete and pass their generated file paths to the pipeline body task before it runs.

    Arguments:
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what authenticates client, which the route requires
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        route_celery_app {Celery} -- test Celery app patched into the route
        celery_worker -- not referenced by name; requesting the fixture is what
        starts the embedded worker that actually processes the dispatched task
    """
    payload = pipeline_payload("oligoseq_mock_form_data.json")
    pipeline_runner_cls = MagicMock()

    with (
        patch("backend.routes.pipelines.add_pending_run", return_value=(0, 0)),
        patch("backend.worker.tasks.GenomicRegionGeneratorRunner") as generator_cls,
        pipeline_runner_module(pipeline_runner_cls),
    ):
        generator_cls.return_value.run.return_value = ["generated.fna"]

        response = multipart_post("/api/oligoseq", payload)

        assert response.status_code == 200
        run_id = ObjectId(response.get_json()["run_id"])
        route_celery_app.AsyncResult(str(run_id)).get(timeout=CELERY_TASK_TIMEOUT)

    # The test payload contains exactly 2 genomic region sources, so 2 header
    # tasks are expected. This count is load-bearing — the pipeline body task
    # only runs after all header tasks complete via Celery chord.
    expected_generated_region_count = 2
    assert generator_cls.return_value.run.call_count == expected_generated_region_count
    pipeline_runner_cls.assert_called_once_with("oligoseq", logger=task_module.logger)
    pipeline_runner_cls.return_value.run.assert_called_once()

    form_data, output_path, generated_regions = pipeline_runner_cls.return_value.run.call_args.args
    assert form_data["target_probe"]["oligo_generation"]["file_region_ids"] == "GFB69_RS14600"
    assert output_path == str(Path(*db.runs.find_one({"_id": run_id})["output_path"]["parts"]))
    assert len(generated_regions) == expected_generated_region_count
    assert all(paths == ["generated.fna"] for _field, paths in generated_regions)


def test_start_pipeline_without_generated_regions_runs_pipeline_task(
    authenticated_user,
    pipeline_payload,
    multipart_post,
    route_celery_app,
    celery_worker,
):
    """When no genomic region inputs are present the route must dispatch the pipeline task directly without any header tasks.

    Arguments:
        authenticated_user {AuthenticatedUser} -- not referenced by name; requesting
        the fixture is what authenticates client, which the route requires
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        route_celery_app {Celery} -- test Celery app patched into the route
        celery_worker -- not referenced by name; requesting the fixture is what
        starts the embedded worker that actually processes the dispatched task
    """
    payload = _clear_generated_regions(pipeline_payload("oligoseq_mock_form_data.json"))
    pipeline_runner_cls = MagicMock()

    with (
        patch("backend.routes.pipelines.add_pending_run", return_value=(0, 0)),
        patch("backend.routes.pipelines.validate_pipeline_config"),
        patch("backend.worker.tasks.GenomicRegionGeneratorRunner") as generator_cls,
        pipeline_runner_module(pipeline_runner_cls),
    ):
        response = multipart_post("/api/oligoseq", payload)

        assert response.status_code == 200
        run_id = ObjectId(response.get_json()["run_id"])
        route_celery_app.AsyncResult(str(run_id)).get(timeout=CELERY_TASK_TIMEOUT)

    generator_cls.return_value.run.assert_not_called()
    pipeline_runner_cls.return_value.run.assert_called_once()
    assert pipeline_runner_cls.return_value.run.call_args.args[2] == []


@pytest.mark.parametrize(
    ("user_fixture", "expected_priority"),
    [
        ("authenticated_user", CeleryConfig.task_high_priority),
        ("anonymous_session", CeleryConfig.task_default_priority),
    ],
)
def test_pipeline_route_dispatches_task_with_expected_priority(
    request,
    pipeline_payload,
    multipart_post,
    route_celery_app,
    celery_worker,
    user_fixture,
    expected_priority,
):
    """Authenticated users receive higher broker priority than anonymous users.

    Arguments:
        request {Any} -- pytest request fixture for dynamic fixture resolution
        pipeline_payload {Callable} -- factory that loads a pipeline payload JSON file
        multipart_post {Callable} -- helper that posts multipart pipeline requests
        route_celery_app {Celery} -- test Celery app patched into the route
        celery_worker -- not referenced by name; requesting the fixture is what
        starts the embedded worker that actually processes the dispatched task
        user_fixture {str} -- one of the parametrized fixture names that sets up the session
        expected_priority {int} -- broker-level priority the route must assign for this user type

    Notes:
        This keeps registered work from being starved by anonymous submissions.
    """
    request.getfixturevalue(user_fixture)
    payload = _clear_generated_regions(pipeline_payload("oligoseq_mock_form_data.json"))
    observed_priorities = []
    pipeline_runner_cls = MagicMock()

    def record_priority(*_args, **_kwargs):
        # delivery_info is read from inside the running task because Celery does
        # not surface broker-level priority through the standard AsyncResult API.
        observed_priorities.append(
            task_module.run_pipeline.request.delivery_info.get("priority", CeleryConfig.task_default_priority)
        )

    with (
        patch("backend.routes.pipelines.add_pending_run", return_value=(0, 0)),
        patch("backend.routes.pipelines.validate_pipeline_config"),
        pipeline_runner_module(pipeline_runner_cls),
    ):
        pipeline_runner_cls.return_value.run.side_effect = record_priority

        response = multipart_post("/api/oligoseq", payload)

        assert response.status_code == 200
        run_id = ObjectId(response.get_json()["run_id"])
        route_celery_app.AsyncResult(str(run_id)).get(timeout=CELERY_TASK_TIMEOUT)

    assert observed_priorities == [expected_priority]
