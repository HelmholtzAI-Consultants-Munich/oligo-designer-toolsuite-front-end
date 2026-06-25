"""Celery task body tests.

These tests cover task bodies in isolation from the scheduler. External boundaries
(PipelineRunner, genomic region generators, and MongoDB) are mocked so tests can assert
on dispatch arguments and error propagation without running real pipelines or touching the
production database. Cleanup helpers use real temp filesystem paths because path-safety
checks (managed root enforcement, unexpected filesystem types) require actual directory
structures to exercise properly.
"""

import datetime
from unittest.mock import MagicMock, patch

import pytest
from bson import ObjectId

from backend.exceptions import ODTPipelineError
from backend.extensions import db
from backend.tests.conftest import CELERY_TASK_TIMEOUT, TEST_SESSION_ID, pipeline_runner_module
from backend.utilities.typed_values import serialize_path
from backend.utils import utc_now
from backend.worker import tasks as task_module
from backend.worker.tasks import (
    _cleanup_expired_anonymous_data,
    cleanup_anonymous_data,
    generate_monthly_report,
    run_genomic_region_generator,
    run_pipeline,
    trigger_dropdown_options_fetching,
)


class MongoClientForTestDb:
    """Context-manager test double that points worker tasks at the isolated test DB.

    Tasks create their own MongoClient connections, so intercepting at the
    constructor level is the only way to redirect them to the test database
    without modifying production code.
    """

    def __init__(self, db):
        """Store the isolated test database and track close calls.

        Arguments:
            db {Database} -- isolated pytest MongoDB database instance
        """
        self.db = db
        self.close = MagicMock()

    def __getitem__(self, name):
        """Return the isolated test database for any requested Mongo database name."""
        return self.db

    def __enter__(self):
        """Support task code that uses MongoClient as a context manager."""
        return self

    def __exit__(self, exc_type, exc, tb):
        """Mirror MongoClient cleanup by closing the test double."""
        self.close()


def test_run_pipeline_task_calls_pipeline_runner(celery_worker, tmp_path):
    """The pipeline task must instantiate PipelineRunner with the pipeline name and pass all task arguments through to run so the correct pipeline executes with the correct inputs.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
        tmp_path (Path): pytest-provided temp directory used as the pipeline output path
    """
    output_path = str(tmp_path / "out")
    runner_cls = MagicMock()
    with pipeline_runner_module(runner_cls):
        runner = runner_cls.return_value

        run_pipeline.delay(
            [("input", ["generated.fna"])], "merfish", {"file_regions": "AARS1"}, output_path
        ).get(timeout=CELERY_TASK_TIMEOUT)

    runner_cls.assert_called_once_with("merfish", logger=task_module.logger)
    runner.run.assert_called_once_with({"file_regions": "AARS1"}, output_path, [["input", ["generated.fna"]]])


def test_run_pipeline_task_propagates_runner_error(celery_worker, tmp_path):
    """Pipeline errors must propagate through the Celery result so lifecycle hooks can set the run status to failed and surface a user-readable message.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
        tmp_path (Path): pytest-provided temp directory used as the pipeline output path
    """
    output_path = str(tmp_path / "out")
    runner_cls = MagicMock()
    with pipeline_runner_module(runner_cls):
        runner_cls.return_value.run.side_effect = ODTPipelineError("failed")

        with pytest.raises(ODTPipelineError):
            run_pipeline.delay([], "merfish", {"file_regions": "AARS1"}, output_path).get(
                timeout=CELERY_TASK_TIMEOUT
            )


def test_run_genomic_region_generator_returns_id_and_paths(celery_worker):
    """The task must return the input field id paired with generated file paths so the chord callback can inject the paths into the correct form data field.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """
    with patch("backend.worker.tasks.GenomicRegionGeneratorRunner") as runner_cls:
        runner_cls.return_value.run.return_value = ["region.fna"]

        result = run_genomic_region_generator.delay({"source": "NCBI"}, "target").get(
            timeout=CELERY_TASK_TIMEOUT
        )

    assert result == ["target", ["region.fna"]]


def test_run_genomic_region_generator_propagates_error(celery_worker):
    """Errors from the generator must propagate through the Celery result so failed header tasks abort the chord before the pipeline body task runs.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """
    with patch("backend.worker.tasks.GenomicRegionGeneratorRunner") as runner_cls:
        runner_cls.return_value.run.side_effect = RuntimeError("bad source")

        with pytest.raises(RuntimeError):
            run_genomic_region_generator.delay({}, "target").get(timeout=CELERY_TASK_TIMEOUT)


def test_trigger_dropdown_options_fetching_calls_fetch(celery_worker):
    """The prefetch task must delegate to the dropdown fetcher so cached database options are populated before users open the submission form.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """
    with patch("backend.worker.tasks.fetch_dropdown_options", return_value={"ncbi": {}}) as fetch:
        trigger_dropdown_options_fetching.delay().get(timeout=CELERY_TASK_TIMEOUT)

    fetch.assert_called_once_with()


def _seed_march_report_source_data() -> None:
    """Seed one reporting period plus previous-period data so monthly report tests have a stable baseline for aggregate and delta assertions."""
    start = datetime.datetime(2026, 3, 1)
    db.users.insert_one({"_id": ObjectId.from_datetime(start), "role": "user"})
    db.runs.insert_many(
        [
            {
                "_id": ObjectId(),
                "created_at": start,
                "status": "success",
                "pipeline": "merfish",
                "user_id": "u1",
            },
            {
                "_id": ObjectId(),
                "created_at": start,
                "status": "failure",
                "pipeline": "seqfish",
                "user_id": None,
            },
            {
                "_id": ObjectId(),
                "created_at": start,
                "status": "pending",
                "pipeline": "scrinshot",
                "user_id": "u2",
                "transferred_from_anon": True,
            },
        ]
    )
    db.feedback.insert_one({"_id": ObjectId(), "created_at": start, "message": "good"})
    db.monthly_reports.insert_one(
        {
            "_id": "2026-02",
            "users": {"new_registrations": 1, "active": 1},
            "runs": {"total": 1, "success_rate": 1.0},
            "conversions": {"anon_to_registered": 0, "conversion_rate": 0.0},
            "feedback": {"total": 0},
        }
    )


def _generate_march_report(celery_worker) -> dict:
    """Trigger report generation for March 2026 with the test DB wired in and return the persisted report so test functions can assert on its content.

    Arguments:
        celery_worker {Any} -- celery.contrib.pytest worker that executes tasks synchronously

    Returns:
        dict -- the MongoDB monthly report document written by the task
    """
    with patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(db)):
        generate_monthly_report.delay(target_year=2026, target_month=3).get(timeout=CELERY_TASK_TIMEOUT)

    return db.monthly_reports.find_one({"_id": "2026-03"})


def test_generate_monthly_report_for_manual_period_writes_identity_and_structure(celery_worker):
    """A manually triggered report must be persisted with the correct period identity and top-level sections so the admin panel can retrieve and display it by year-month key.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """
    _seed_march_report_source_data()

    report = _generate_march_report(celery_worker)

    assert report["_id"] == "2026-03"
    assert report["year"] == 2026
    assert report["month"] == 3
    assert report["generated_by"] == "manual"
    assert report["generated_at"] is not None
    assert set(report) >= {"users", "runs", "conversions", "feedback"}


def test_generate_monthly_report_for_manual_period_aggregates_counts(celery_worker):
    """Aggregate counts must reflect all runs and users in the reporting period so the admin panel shows accurate usage statistics.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """
    _seed_march_report_source_data()

    report = _generate_march_report(celery_worker)

    assert report["users"]["new_registrations"] == 1
    assert report["users"]["active"] == 2
    assert report["runs"]["total"] == 3
    assert report["runs"]["by_status"]["success"] == 1
    assert report["runs"]["by_status"]["failure"] == 1
    assert report["runs"]["by_status"]["pending"] == 1
    assert report["runs"]["by_pipeline"]["merfish"] == 1
    assert report["runs"]["by_pipeline"]["seqfish"] == 1
    assert report["runs"]["by_pipeline"]["scrinshot"] == 1
    assert report["runs"]["anonymous"] == 1
    assert report["runs"]["authenticated"] == 2
    assert report["feedback"]["total"] == 1


def test_generate_monthly_report_for_manual_period_calculates_rates_and_deltas(celery_worker):
    """Rates and period deltas must be computed from the stored previous-period report so trend changes are visible on the admin dashboard.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """
    _seed_march_report_source_data()

    report = _generate_march_report(celery_worker)

    assert report["runs"]["success_rate"] == 0.5
    assert report["runs"]["failure_rate"] == 0.5
    assert report["runs"]["delta_total"] == 2
    assert report["runs"]["delta_success_rate"] == -0.5
    # anon_to_registered counts runs that were originally submitted anonymously
    # and later claimed by a registered user — a proxy for product engagement.
    assert report["conversions"]["anon_to_registered"] == 1
    assert report["conversions"]["conversion_rate"] == 1.0
    assert report["conversions"]["delta_anon_to_registered"] == 1
    assert report["conversions"]["delta_conversion_rate"] == 1.0
    assert report["users"]["delta_new_registrations"] == 0
    assert report["users"]["delta_active"] == 1
    assert report["feedback"]["delta_total"] == 1


def test_generate_monthly_report_default_uses_previous_month(celery_worker):
    """The scheduled task must target the previous calendar month so reports are generated for a complete period rather than the current in-progress month.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """

    class FixedDate(datetime.date):
        """Make datetime.date.today() return a deterministic value so the scheduled report targets a predictable month."""

        @classmethod
        def today(cls):
            """Return a stable date whose previous month is April 2026."""
            return cls(2026, 5, 27)

    with (
        patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(db)),
        patch("backend.worker.tasks.datetime.date", FixedDate),
    ):
        generate_monthly_report.delay().get(timeout=CELERY_TASK_TIMEOUT)

    report = db.monthly_reports.find_one({"_id": "2026-04"})
    assert report["generated_by"] == "scheduled"


def test_generate_monthly_report_handles_no_runs(celery_worker):
    """Rates must become None when the denominator is zero so the frontend can distinguish "no runs yet" from a genuine 0% rate.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously

    Notes:
        Rates become None (not 0) when the denominator is zero, so the frontend
        can distinguish "no runs yet" from a genuine 0% rate.
    """
    with patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(db)):
        generate_monthly_report.delay(target_year=2026, target_month=3).get(timeout=CELERY_TASK_TIMEOUT)

    report = db.monthly_reports.find_one({"_id": "2026-03"})
    assert report["runs"]["total"] == 0
    assert report["runs"]["success_rate"] is None
    assert report["conversions"]["conversion_rate"] is None


def test_generate_monthly_report_replaces_existing_report(celery_worker):
    """Re-running report generation for the same period must overwrite the existing document so stale data does not persist alongside the updated figures.

    Args:
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """
    db.monthly_reports.insert_one({"_id": "2026-03", "year": 2026, "month": 3, "old": True})

    with patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(db)):
        generate_monthly_report.delay(target_year=2026, target_month=3).get(timeout=CELERY_TASK_TIMEOUT)

    assert db.monthly_reports.count_documents({"_id": "2026-03"}) == 1
    assert "old" not in db.monthly_reports.find_one({"_id": "2026-03"})


def test_cleanup_anonymous_data_deletes_expired_session_data(test_data_roots):
    """Expired anonymous sessions must have all their associated runs, uploads, consent records, and output files deleted so storage is fully reclaimed.

    Args:
        test_data_roots (DataRoots): per-test temp filesystem roots providing managed upload and output directories
    """
    upload_file = test_data_roots.uploads / "upload.fna"
    upload_file.write_text(">x\nAC\n")
    output_dir = test_data_roots.anon_dir / "output"
    output_dir.mkdir()
    cutoff = utc_now()
    db.anonymous_sessions.insert_one(
        {
            "_id": ObjectId(),
            "session_id": TEST_SESSION_ID,
            "last_activity_at": cutoff - datetime.timedelta(days=1),
        }
    )
    db.runs.insert_one(
        {"_id": ObjectId(), "session_id": TEST_SESSION_ID, "output_path": serialize_path(output_dir)}
    )
    db.uploads.insert_one({"_id": ObjectId(), "session_id": TEST_SESSION_ID, "path": str(upload_file)})
    db.legal_acceptances.insert_one({"_id": ObjectId(), "session_id": TEST_SESSION_ID})

    result = _cleanup_expired_anonymous_data(db, test_data_roots.uploads, test_data_roots.user_data, cutoff)

    assert result["deleted_runs"] == 1
    assert result["deleted_uploads"] == 1
    assert not output_dir.exists()
    assert not upload_file.exists()
    assert db.anonymous_sessions.count_documents({}) == 0


def test_cleanup_anonymous_data_keeps_unexpired_sessions(test_data_roots):
    """Sessions newer than the cutoff must not be touched so active anonymous users do not lose their work mid-session.

    Args:
        test_data_roots (DataRoots): per-test temp filesystem roots
    """
    db.anonymous_sessions.insert_one(
        {"_id": ObjectId(), "session_id": TEST_SESSION_ID, "last_activity_at": utc_now()}
    )

    result = _cleanup_expired_anonymous_data(
        db,
        test_data_roots.uploads,
        test_data_roots.user_data,
        utc_now() - datetime.timedelta(days=1),
    )

    assert result["deleted_sessions"] == 0
    assert db.anonymous_sessions.count_documents({}) == 1


def test_cleanup_anonymous_data_retains_records_for_paths_outside_root(test_data_roots, tmp_path):
    """Records whose file paths resolve outside the managed data roots must be skipped so a misconfigured UPLOAD_PATH or USERDATA_PATH cannot trigger accidental deletion.

    Args:
        test_data_roots (DataRoots): per-test temp filesystem roots used as the cleanup boundaries
        tmp_path (Path): pytest-provided temp directory simulating a path outside the managed roots

    Notes:
        A mis-configured UPLOAD_PATH or USERDATA_PATH could point cleanup at the
        wrong directory. Skipping records outside the expected roots prevents
        accidental data loss from configuration errors.
    """
    outside = tmp_path / "outside.fna"
    outside.write_text("keep")
    cutoff = utc_now()
    db.anonymous_sessions.insert_one(
        {
            "_id": ObjectId(),
            "session_id": TEST_SESSION_ID,
            "last_activity_at": cutoff - datetime.timedelta(days=1),
        }
    )
    db.uploads.insert_one({"_id": ObjectId(), "session_id": TEST_SESSION_ID, "path": str(outside)})

    result = _cleanup_expired_anonymous_data(db, test_data_roots.uploads, test_data_roots.user_data, cutoff)

    assert result["retained_uploads"] == 1
    assert outside.exists()
    assert db.uploads.count_documents({}) == 1


def test_cleanup_anonymous_data_retains_records_when_path_type_unexpected(test_data_roots):
    """Records must be kept when tracked paths exist as the wrong filesystem type so cleanup never deletes something it cannot safely remove.

    Args:
        test_data_roots (DataRoots): per-test temp filesystem roots containing the mistyped paths
    """
    upload_dir = test_data_roots.uploads / "directory-instead-of-file"
    upload_dir.mkdir()
    output_file = test_data_roots.anon_dir / "file-instead-of-directory"
    output_file.write_text("unexpected")
    cutoff = utc_now()
    db.anonymous_sessions.insert_one(
        {
            "_id": ObjectId(),
            "session_id": TEST_SESSION_ID,
            "last_activity_at": cutoff - datetime.timedelta(days=1),
        }
    )
    db.uploads.insert_one({"_id": ObjectId(), "session_id": TEST_SESSION_ID, "path": str(upload_dir)})
    db.runs.insert_one(
        {"_id": ObjectId(), "session_id": TEST_SESSION_ID, "output_path": serialize_path(output_file)}
    )

    result = _cleanup_expired_anonymous_data(db, test_data_roots.uploads, test_data_roots.user_data, cutoff)

    assert result["retained_uploads"] == 1
    assert result["retained_runs"] == 1
    assert db.uploads.count_documents({}) == 1
    assert db.runs.count_documents({}) == 1


def test_cleanup_anonymous_data_task_uses_configured_roots(test_data_roots, celery_worker):
    """The Celery task must read data roots from config and target the isolated test DB so it can be exercised without touching production paths or the real broker.

    Args:
        test_data_roots (DataRoots): per-test temp filesystem roots injected via the data-roots patch
        celery_worker: celery.contrib.pytest worker that executes tasks synchronously
    """
    with (
        patch(
            "backend.worker.tasks._get_data_roots",
            return_value=(test_data_roots.uploads, test_data_roots.user_data),
        ),
        patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(db)),
    ):
        result = cleanup_anonymous_data.delay().get(timeout=CELERY_TASK_TIMEOUT)

    assert result["deleted_sessions"] == 0
