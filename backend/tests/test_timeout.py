# TODO(#197): These tests import worker-side code and its dependencies, which means they cannot
# be run in the Flask server container as documented in docs/tests.md. They are commented out
# until the pytest suite is rewritten from scratch as part of issue #197.
#
# """Tests for the pipeline timeout feature.
#
# Covers:
# - extract_gene_count (utilities/pipeline.py)
# - resolve_timeout (utilities/pipeline.py)
# - start_pipeline: ordering guarantee and enqueue failure rollback
# - get_run_status: shared status refresh path
# - run_pipeline: task outcome propagates without self-updating the DB
# - worker signals: started_at / finished_at / timeout tracking
# - refresh_pipeline_duration_stats: per-pipeline aggregation (tasks.py)
# - enqueue_pipeline: soft_time_limit and time_limit passed to Celery
# - call_subprocess: subprocess failures propagate (pipeline_runner.py)
# """

# import datetime
# from contextlib import contextmanager
# from pathlib import Path
# from unittest.mock import MagicMock, mock_open, patch
#
# import pytest
# from celery.exceptions import SoftTimeLimitExceeded, TimeLimitExceeded
#
# from backend.config import CeleryConfig
# from backend.constants import PIPELINE_RUN_LIFECYCLE_COLLECTION, PIPELINE_TIMEOUTS_CACHE_KEY
# from backend.extensions import mongo
# from backend.routes.pipelines import enqueue_pipeline
# from backend.tests.conftest import create_test_run
# from backend.utilities.pipeline import extract_gene_count, resolve_pipeline_task_status, resolve_timeout
# from backend.worker.pipeline_runner import PipelineRunner
# from backend.worker.signals import on_task_postrun, on_task_prerun
# from backend.worker.tasks import refresh_pipeline_duration_stats, run_pipeline
#
# # ---------------------------------------------------------------------------
# # Shared helpers and fixtures
# # ---------------------------------------------------------------------------
#
# _MERFISH_CACHE_DOC = {
#     "_id": PIPELINE_TIMEOUTS_CACHE_KEY,
#     "data": {"merfish": {"seconds_per_gene": 2.0, "sample_count": 10}},
# }
#
#
# @pytest.fixture
# def merfish_heuristic_cache(client):
#     """Seed MongoDB cache with a merfish heuristic percentile rate of 2.0 s/gene."""
#     mongo.db.cache.replace_one({"_id": PIPELINE_TIMEOUTS_CACHE_KEY}, _MERFISH_CACHE_DOC, upsert=True)
#
#
# def make_async_result(state: str, *, successful: bool, return_value=None) -> MagicMock:
#     """Build a minimal Celery AsyncResult mock."""
#     result = MagicMock()
#     result.successful.return_value = successful
#     result.state = state
#     if successful:
#         result.get.return_value = return_value
#     return result
#
#
# def make_run_docs(pipeline: str, count: int, duration_seconds: int, gene_count: int) -> list[dict]:
#     """Return a list of synthetic successful run documents."""
#     now = datetime.datetime.utcnow()
#     return [
#         {
#             "pipeline": pipeline,
#             "status": "success",
#             "started_at": now - datetime.timedelta(days=i, hours=2),
#             "finished_at": now
#             - datetime.timedelta(days=i, hours=2)
#             + datetime.timedelta(seconds=duration_seconds),
#             "gene_count": gene_count,
#         }
#         for i in range(count)
#     ]
#
#
# def pipeline_find(all_docs: list[dict]):
#     """Return a find() side_effect that filters by pipeline name from the query,
#     mirroring what MongoDB actually does. Without this, every pipeline in the
#     loop would receive the same docs regardless of the query filter."""
#
#     def _find(query, *args, **kwargs):
#         name = query.get("pipeline")
#         return [d for d in all_docs if d["pipeline"] == name]
#
#     return _find
#
#
# @contextmanager
# def patch_worker_db(module_path: str):
#     """Patch get_worker_db for a worker module and yield (mock_ctx, mock_db).
#
#     Usage::
#
#         with patch_worker_db("backend.worker.tasks") as (mock_ctx, mock_db):
#             mock_db.runs.find.return_value = [...]
#     """
#     mock_db = MagicMock()
#     with patch(f"{module_path}.get_worker_db") as mock_ctx:
#         mock_ctx.return_value.__enter__.return_value = mock_db
#         yield mock_ctx, mock_db
#
#
# @pytest.fixture
# def pipeline_runner():
#     """A PipelineRunner instance with schema loading bypassed."""
#     mock_task = MagicMock()
#     mock_task.name = "backend.worker.tasks.run_pipeline"
#     with patch("builtins.open", mock_open(read_data="{}")):
#         with patch("json.load", return_value={"properties": {}}):
#             return PipelineRunner("merfish", task=mock_task)
#
#
# # ---------------------------------------------------------------------------
# # extract_gene_count
# # ---------------------------------------------------------------------------
#
#
# def test_extract_gene_count_comma_separated():
#     assert extract_gene_count({"file_regions": "BRCA1,TP53,EGFR"}) == 3
#
#
# def test_extract_gene_count_trims_whitespace():
#     assert extract_gene_count({"file_regions": "BRCA1, TP53 , EGFR"}) == 3
#
#
# def test_extract_gene_count_single_gene():
#     assert extract_gene_count({"file_regions": "BRCA1"}) == 1
#
#
# def test_extract_gene_count_txt_file(tmp_path):
#     gene_file = tmp_path / "genes.txt"
#     gene_file.write_text("BRCA1\nTP53\nEGFR\n")
#     assert extract_gene_count({"file_regions": str(gene_file)}) == 3
#
#
# def test_extract_gene_count_txt_file_ignores_empty_lines(tmp_path):
#     gene_file = tmp_path / "genes.txt"
#     gene_file.write_text("BRCA1\n\nTP53\n\nEGFR\n")
#     assert extract_gene_count({"file_regions": str(gene_file)}) == 3
#
#
# def test_extract_gene_count_empty_string():
#     assert extract_gene_count({"file_regions": ""}) is None
#
#
# def test_extract_gene_count_missing_field():
#     assert extract_gene_count({}) is None
#
#
# def test_extract_gene_count_txt_file_not_found(app):
#     with app.app_context():
#         result = extract_gene_count({"file_regions": "/nonexistent/path/genes.txt"})
#     assert result is None
#
#
# # ---------------------------------------------------------------------------
# # resolve_timeout
# # ---------------------------------------------------------------------------
#
#
# def test_resolve_timeout_config_mode_anonymous(app):
#     with app.app_context():
#         with patch.multiple(CeleryConfig, pipeline_timeout_mode="config", pipeline_timeout_anon=3600):
#             result = resolve_timeout("merfish", is_authenticated=False, gene_count=100)
#     assert result == 3600
#
#
# def test_resolve_timeout_config_mode_authenticated(app):
#     with app.app_context():
#         with patch.multiple(
#             CeleryConfig,
#             pipeline_timeout_mode="config",
#             pipeline_timeout_anon=3600,
#             pipeline_timeout_authenticated_multiplier=2.0,
#         ):
#             result = resolve_timeout("merfish", is_authenticated=True, gene_count=100)
#     assert result == 7200
#
#
# def test_resolve_timeout_heuristic_uses_cache(client, merfish_heuristic_cache):
#     with patch.multiple(
#         CeleryConfig, pipeline_timeout_mode="heuristic", pipeline_timeout_heuristic_factor=3.0
#     ):
#         result = resolve_timeout("merfish", is_authenticated=False, gene_count=100)
#     assert result == 600  # 2.0 * 100 * 3.0
#
#
# def test_resolve_timeout_heuristic_auth_doubles_limit(client, merfish_heuristic_cache):
#     with patch.multiple(
#         CeleryConfig,
#         pipeline_timeout_mode="heuristic",
#         pipeline_timeout_heuristic_factor=3.0,
#         pipeline_timeout_authenticated_multiplier=2.0,
#     ):
#         result = resolve_timeout("merfish", is_authenticated=True, gene_count=100)
#     assert result == 1200  # 2.0 * 100 * 3.0 * 2
#
#
# def test_resolve_timeout_heuristic_no_cache_falls_back(client):
#     mongo.db.cache.delete_many({"_id": PIPELINE_TIMEOUTS_CACHE_KEY})
#     with patch.multiple(CeleryConfig, pipeline_timeout_mode="heuristic", pipeline_timeout_anon=3600):
#         result = resolve_timeout("merfish", is_authenticated=False, gene_count=100)
#     assert result == 3600
#
#
# def test_resolve_timeout_heuristic_no_gene_count_falls_back(client, merfish_heuristic_cache):
#     with patch.multiple(CeleryConfig, pipeline_timeout_mode="heuristic", pipeline_timeout_anon=3600):
#         result = resolve_timeout("merfish", is_authenticated=False, gene_count=None)
#     assert result == 3600
#
#
# # ---------------------------------------------------------------------------
# # start_pipeline: ordering and failure rollback
# # ---------------------------------------------------------------------------
#
#
# def test_db_write_before_enqueue(client, run_id, session_user):
#     """DB write must happen before pipeline enqueue so the run document
#     exists in the DB"""
#     call_order = []
#
#     def tracking_write(*args, **kwargs):
#         call_order.append("write")
#         result = MagicMock()
#         result.matched_count = 1
#         return result
#
#     def tracking_enqueue(*args, **kwargs):
#         call_order.append("enqueue")
#         return MagicMock(id="fake-task-id")
#
#     with patch("backend.routes.pipelines.write_run_to_DB", side_effect=tracking_write):
#         with patch("backend.routes.pipelines.enqueue_pipeline", side_effect=tracking_enqueue):
#             client.post(
#                 "/api/merfish", json={"runid": str(run_id), "formdata": {"file_regions": "BRCA1,TP53"}}
#             )
#
#     assert call_order == ["write", "enqueue"]
#
#
# def test_task_id_matches_between_db_and_enqueue(client, run_id, session_user):
#     """The same pre-generated task_id must be passed to both write_run_to_DB and enqueue_pipeline."""
#     written_task_ids: list[str] = []
#     enqueued_task_ids: list[str] = []
#
#     def tracking_write(pipeline_name, run_id, context, task_id, gene_count=None):
#         written_task_ids.append(task_id)
#         result = MagicMock()
#         result.matched_count = 1
#         return result
#
#     def tracking_enqueue(
#         pipeline_name,
#         form_data,
#         upload_path,
#         output_path,
#         is_authenticated,
#         task_id,
#         run_id,
#         user_id,
#         session_id,
#         gene_count=None,
#     ):
#         enqueued_task_ids.append(task_id)
#         return MagicMock(id=task_id)
#
#     with patch("backend.routes.pipelines.write_run_to_DB", side_effect=tracking_write):
#         with patch("backend.routes.pipelines.enqueue_pipeline", side_effect=tracking_enqueue):
#             client.post(
#                 "/api/merfish", json={"runid": str(run_id), "formdata": {"file_regions": "BRCA1,TP53"}}
#             )
#
#     assert written_task_ids and enqueued_task_ids
#     assert written_task_ids[0] == enqueued_task_ids[0]
#
#
# def test_enqueue_failure_marks_run_as_failed(client, run_id, session_user):
#     """If publishing to RabbitMQ fails after the run doc is written, the run must
#     be marked as failure so the user isn't left with a permanently pending run."""
#     write_called = []
#
#     def tracking_write(*args, **kwargs):
#         write_called.append(True)
#         result = MagicMock()
#         result.matched_count = 1
#         return result
#
#     with patch("backend.routes.pipelines.write_run_to_DB", side_effect=tracking_write):
#         with patch("backend.routes.pipelines.enqueue_pipeline", side_effect=ConnectionError("broker down")):
#             with patch("backend.routes.pipelines.update_run_in_DB") as mock_update:
#                 response = client.post(
#                     "/api/merfish",
#                     json={"runid": str(run_id), "formdata": {"file_regions": "BRCA1,TP53"}},
#                 )
#
#     assert response.status_code == 500
#     assert write_called, "run must have been written to DB before enqueue attempt"
#     mock_update.assert_called_once_with(run_id, {"status": "failure"})
#
#
# # ---------------------------------------------------------------------------
# # get_run_status: shared refresh path
# # ---------------------------------------------------------------------------
#
#
# def test_get_run_status_returns_success_status(client, run_id, dummy_user):
#     create_test_run(run_id, user_id=dummy_user.id, status="started", task_id="test-task-id")
#
#     with patch(
#         "backend.extensions.celery_app.AsyncResult",
#         return_value=make_async_result("SUCCESS", successful=True, return_value=True),
#     ):
#         response = client.get(f"/api/runs/{run_id}/status")
#
#     assert response.status_code == 200
#     assert response.get_json()["status"] == "success"
#     assert mongo.db.runs.find_one({"_id": run_id})["status"] == "success"
#
#
# def test_get_run_status_returns_timeout_status(client, run_id, dummy_user):
#     create_test_run(run_id, user_id=dummy_user.id, status="started", task_id="test-task-id")
#
#     mock_result = make_async_result("FAILURE", successful=False)
#     mock_result.info = SoftTimeLimitExceeded()
#     with patch("backend.extensions.celery_app.AsyncResult", return_value=mock_result):
#         response = client.get(f"/api/runs/{run_id}/status")
#
#     assert response.status_code == 200
#     assert response.get_json()["status"] == "timeout"
#     assert mongo.db.runs.find_one({"_id": run_id})["status"] == "timeout"
#
#
# def test_get_run_status_no_update_if_state_unchanged(client, run_id, dummy_user):
#     create_test_run(run_id, user_id=dummy_user.id, status="success")
#     response = client.get(f"/api/runs/{run_id}/status")
#     assert response.status_code == 200
#     assert response.get_json()["status"] == "success"
#
#
# # ---------------------------------------------------------------------------
# # run_pipeline task: task outcome propagation
# # ---------------------------------------------------------------------------
#
#
# def test_run_pipeline_propagates_soft_time_limit_without_db_write():
#     with patch("backend.worker.tasks.PipelineRunner") as mock_runner_class:
#         mock_runner_class.return_value.run.side_effect = SoftTimeLimitExceeded()
#         with patch("backend.worker.tasks.get_worker_db") as mock_ctx:
#             with pytest.raises(SoftTimeLimitExceeded):
#                 run_pipeline.run("merfish", {}, "/upload", "/output")
#             mock_ctx.assert_not_called()
#
#
# def test_run_pipeline_does_not_catch_time_limit_exceeded():
#     """Hard limit sends SIGKILL — TimeLimitExceeded is never raised inside the task.
#     This is a policy test confirming we don't accidentally swallow it with a broad except."""
#     with patch("backend.worker.tasks.PipelineRunner") as mock_runner_class:
#         mock_runner_class.return_value.run.side_effect = TimeLimitExceeded(1800)
#         with patch("backend.worker.tasks.get_worker_db") as mock_ctx:
#             with pytest.raises(TimeLimitExceeded):
#                 run_pipeline.run("merfish", {}, "/upload", "/output")
#             mock_ctx.assert_not_called()
#
#
# def test_run_pipeline_does_not_write_to_db_on_success():
#     with patch("backend.worker.tasks.PipelineRunner") as mock_runner_class:
#         mock_runner_class.return_value.run.return_value = True
#         with patch("backend.worker.tasks.get_worker_db") as mock_ctx:
#             run_pipeline.run("merfish", {}, "/upload", "/output")
#             mock_ctx.assert_not_called()
#
#
# # ---------------------------------------------------------------------------
# # worker signals: started_at / finished_at tracking
# # ---------------------------------------------------------------------------
#
#
# def test_on_task_prerun_writes_started_at_for_run_pipeline():
#     mock_task = MagicMock()
#     mock_task.name = "backend.worker.tasks.run_pipeline"
#     mock_task.request = MagicMock(
#         headers={"run_id": "run-1", "pipeline": "merfish", "user_id": "user-1", "session_id": "session-1"}
#     )
#
#     with patch_worker_db("backend.worker.signals") as (_, mock_db):
#         lifecycle_collection = MagicMock()
#         mock_db.__getitem__.return_value = lifecycle_collection
#         on_task_prerun(task_id="test-task-id", task=mock_task)
#
#     mock_db.__getitem__.assert_called_once_with(PIPELINE_RUN_LIFECYCLE_COLLECTION)
#     filter_arg, update_arg = lifecycle_collection.update_one.call_args[0]
#     assert lifecycle_collection.update_one.call_args.kwargs["upsert"] is True
#     assert filter_arg == {"task_id": "test-task-id"}
#     assert update_arg["$set"]["status"] == "started"
#     assert update_arg["$set"]["run_id"] == "run-1"
#     assert "started_at" in update_arg["$set"]
#     assert isinstance(update_arg["$set"]["started_at"], datetime.datetime)
#
#
# def test_on_task_prerun_ignores_other_tasks():
#     mock_task = MagicMock()
#     mock_task.name = "backend.worker.tasks.fetch_dropdown_options"
#
#     with patch("backend.worker.signals.get_worker_db") as mock_ctx:
#         on_task_prerun(task_id="test-id", task=mock_task)
#         mock_ctx.assert_not_called()
#
#
# def test_on_task_postrun_marks_timeout(client):
#     mock_task = MagicMock()
#     mock_task.name = "backend.worker.tasks.run_pipeline"
#     mock_task.request = MagicMock(
#         headers={"pipeline": "merfish", "run_id": "run-1", "gene_count": 100, "publish_time": 1.0},
#         prerun_time=2.0,
#         started_at=datetime.datetime.now(datetime.UTC),
#     )
#
#     with patch_worker_db("backend.worker.signals") as (_, mock_db):
#         lifecycle_collection = MagicMock()
#         mock_db.__getitem__.return_value = lifecycle_collection
#         with patch("backend.worker.signals.time.time", return_value=5.0):
#             on_task_postrun(task_id="task-1", task=mock_task, state="FAILURE", retval=SoftTimeLimitExceeded())
#
#     mock_db.__getitem__.assert_called_once_with(PIPELINE_RUN_LIFECYCLE_COLLECTION)
#     _, update_arg = lifecycle_collection.update_one.call_args[0]
#     assert update_arg["$set"]["status"] == "timeout"
#     assert update_arg["$set"]["finished_at"]
#     assert lifecycle_collection.update_one.call_args.kwargs["upsert"] is True
#
#
# def test_on_task_postrun_persists_success_lifecycle_metrics(client):
#     mock_task = MagicMock()
#     mock_task.name = "backend.worker.tasks.run_pipeline"
#     started_at = datetime.datetime.now(datetime.UTC)
#     mock_task.request = MagicMock(
#         headers={
#             "pipeline": "merfish",
#             "run_id": "run-1",
#             "user_id": "user-1",
#             "session_id": "session-1",
#             "gene_count": 100,
#             "publish_time": 1.0,
#         },
#         prerun_time=2.0,
#         started_at=started_at,
#     )
#
#     with patch_worker_db("backend.worker.signals") as (_, mock_db):
#         lifecycle_collection = MagicMock()
#         mock_db.__getitem__.return_value = lifecycle_collection
#         with patch("backend.worker.signals.time.time", return_value=5.0):
#             on_task_postrun(task_id="task-1", task=mock_task, state="SUCCESS", retval=True)
#
#     mock_db.__getitem__.assert_called_once_with(PIPELINE_RUN_LIFECYCLE_COLLECTION)
#     _, update_arg = lifecycle_collection.update_one.call_args[0]
#     assert update_arg["$set"]["status"] == "success"
#     assert update_arg["$set"]["pipeline"] == "merfish"
#     assert update_arg["$set"]["gene_count"] == 100
#     assert update_arg["$set"]["execution_seconds"] == 3.0
#     assert update_arg["$set"]["queue_wait_seconds"] == 1.0
#     assert update_arg["$set"]["total_seconds"] == 4.0
#
#
# def test_resolve_pipeline_task_status_maps_timeout():
#     assert resolve_pipeline_task_status("FAILURE", SoftTimeLimitExceeded()) == "timeout"
#
#
# # ---------------------------------------------------------------------------
# # refresh_pipeline_duration_stats: per-pipeline aggregation
# # ---------------------------------------------------------------------------
#
#
# def test_refresh_pipeline_duration_stats_computes_seconds_per_gene():
#     # 10 merfish runs, 200s each for 100 genes → 2.0 s/gene
#     # Other pipelines return no docs so only merfish appears in output.
#     runs_data = make_run_docs("merfish", count=10, duration_seconds=200, gene_count=100)
#
#     with patch_worker_db("backend.worker.tasks") as (_, mock_db):
#         lifecycle_collection = MagicMock()
#         lifecycle_collection.find.side_effect = pipeline_find(runs_data)
#         mock_db.__getitem__.return_value = lifecycle_collection
#         refresh_pipeline_duration_stats.run()
#
#     _, update_arg = mock_db.cache.update_one.call_args[0]
#     data = update_arg["$set"]["data"]
#     assert "merfish" in data
#     assert abs(data["merfish"]["seconds_per_gene"] - 2.0) < 0.01
#     assert data["merfish"]["sample_count"] == 10
#
#
# def test_refresh_pipeline_duration_stats_skips_pipeline_with_fewer_than_5_runs():
#     runs_data = make_run_docs("merfish", count=4, duration_seconds=3600, gene_count=100)
#
#     with patch_worker_db("backend.worker.tasks") as (_, mock_db):
#         lifecycle_collection = MagicMock()
#         lifecycle_collection.find.side_effect = pipeline_find(runs_data)
#         mock_db.__getitem__.return_value = lifecycle_collection
#         refresh_pipeline_duration_stats.run()
#
#     _, update_arg = mock_db.cache.update_one.call_args[0]
#     assert "merfish" not in update_arg["$set"]["data"]
#
#
# def test_refresh_pipeline_duration_stats_always_writes_cache_even_when_empty():
#     """Cache must be written even with no data so stale keys are cleared."""
#     with patch_worker_db("backend.worker.tasks") as (_, mock_db):
#         lifecycle_collection = MagicMock()
#         lifecycle_collection.find.side_effect = pipeline_find([])
#         mock_db.__getitem__.return_value = lifecycle_collection
#         refresh_pipeline_duration_stats.run()
#
#     mock_db.cache.update_one.assert_called_once()
#     _, update_arg = mock_db.cache.update_one.call_args[0]
#     assert update_arg["$set"]["data"] == {}
#
#
# # ---------------------------------------------------------------------------
# # End-to-end mechanism: timeout reaches Celery, subprocess is killed
# # ---------------------------------------------------------------------------
#
#
# def test_enqueue_pipeline_passes_soft_time_limit_to_send_task(app):
#     """soft_time_limit and time_limit must reach celery send_task —
#     this is the single call that arms the timeout in the worker."""
#     with app.app_context():
#         with patch("backend.routes.pipelines.celery_app") as mock_celery:
#             mock_celery.send_task.return_value = MagicMock(id="fake-id")
#             with patch.multiple(
#                 CeleryConfig,
#                 pipeline_timeout_mode="config",
#                 pipeline_timeout_anon=3600,
#                 pipeline_timeout_hard_margin=300,
#             ):
#                 enqueue_pipeline(
#                     pipeline_name="merfish",
#                     form_data={},
#                     upload_path=Path("/tmp/upload"),
#                     output_path=Path("/tmp/output"),
#                     is_authenticated=False,
#                     task_id="test-task-id",
#                     run_id="run-id",
#                     user_id="user-id",
#                     session_id="session-id",
#                     gene_count=None,
#                 )
#
#     _, kwargs = mock_celery.send_task.call_args
#     assert kwargs["soft_time_limit"] == 3600
#     assert kwargs["time_limit"] == 3900  # soft + hard margin
#     assert kwargs["headers"]["run_id"] == "run-id"
#     assert kwargs["headers"]["pipeline"] == "merfish"
#
#
# def test_call_subprocess_propagates_soft_time_limit(pipeline_runner):
#     """SoftTimeLimitExceeded should propagate when subprocess execution is interrupted."""
#     with patch("subprocess.run", side_effect=SoftTimeLimitExceeded()):
#         with pytest.raises(SoftTimeLimitExceeded):
#             pipeline_runner.call_subprocess("/tmp/config.yml")
