"""Celery task body tests.

Celery task tests dispatch through celery.contrib.pytest's in-memory worker.
External work is mocked at runner/Mongo boundaries while cleanup helpers use
real temp filesystem paths.
"""

import datetime
from unittest.mock import MagicMock, patch

import pytest
from bson import ObjectId

from backend.exceptions import ODTPipelineError
from backend.extensions import mongo
from backend.tests.conftest import CELERY_TASK_TIMEOUT, TEST_SESSION_ID, pipeline_runner_module
from backend.utilities.typed_values import serialize_path, utc_now
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
    """Context-manager test double that points worker tasks at the isolated DB."""

    def __init__(self, db):
        """Store the isolated test database and track close calls."""
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
    """The pipeline task delegates execution to PipelineRunner with the task args."""
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
    """Pipeline task failures from PipelineRunner propagate through the Celery result."""
    output_path = str(tmp_path / "out")
    runner_cls = MagicMock()
    with pipeline_runner_module(runner_cls):
        runner_cls.return_value.run.side_effect = ODTPipelineError("failed")

        with pytest.raises(ODTPipelineError):
            run_pipeline.delay([], "merfish", {"file_regions": "AARS1"}, output_path).get(
                timeout=CELERY_TASK_TIMEOUT
            )


def test_run_genomic_region_generator_returns_id_and_paths(celery_worker):
    """Genomic-region task returns the input id paired with generated file paths."""
    with patch("backend.worker.tasks.GenomicRegionGeneratorRunner") as runner_cls:
        runner_cls.return_value.run.return_value = ["region.fna"]

        result = run_genomic_region_generator.delay({"source": "NCBI"}, "target").get(
            timeout=CELERY_TASK_TIMEOUT
        )

    assert result == ["target", ["region.fna"]]


def test_run_genomic_region_generator_propagates_error(celery_worker):
    """Genomic-region task failures propagate through the Celery result."""
    with patch("backend.worker.tasks.GenomicRegionGeneratorRunner") as runner_cls:
        runner_cls.return_value.run.side_effect = RuntimeError("bad source")

        with pytest.raises(RuntimeError):
            run_genomic_region_generator.delay({}, "target").get(timeout=CELERY_TASK_TIMEOUT)


def test_trigger_dropdown_options_fetching_calls_fetch(celery_worker):
    """Dropdown prefetch task delegates to the genomic database dropdown fetcher."""
    with patch("backend.worker.tasks.fetch_dropdown_options", return_value={"ncbi": {}}) as fetch:
        trigger_dropdown_options_fetching.delay().get(timeout=CELERY_TASK_TIMEOUT)

    fetch.assert_called_once_with()


def _seed_march_report_source_data() -> None:
    """Seed one reporting period plus previous-period data for monthly report tests."""
    start = datetime.datetime(2026, 3, 1)
    mongo.db.users.insert_one({"_id": ObjectId.from_datetime(start), "role": "user"})
    mongo.db.runs.insert_many(
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
    mongo.db.feedback.insert_one({"_id": ObjectId(), "created_at": start, "message": "good"})
    mongo.db.monthly_reports.insert_one(
        {
            "_id": "2026-02",
            "users": {"new_registrations": 1, "active": 1},
            "runs": {"total": 1, "success_rate": 1.0},
            "conversions": {"anon_to_registered": 0, "conversion_rate": 0.0},
            "feedback": {"total": 0},
        }
    )


def _generate_march_report(celery_worker) -> dict:
    """Run the report task for March 2026 and return the persisted report."""
    with patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(mongo.db)):
        generate_monthly_report.delay(target_year=2026, target_month=3).get(timeout=CELERY_TASK_TIMEOUT)

    return mongo.db.monthly_reports.find_one({"_id": "2026-03"})


def test_generate_monthly_report_for_manual_period_writes_identity_and_structure(celery_worker):
    """Manual report generation persists the expected report identity and top-level sections."""
    _seed_march_report_source_data()

    report = _generate_march_report(celery_worker)

    assert report["_id"] == "2026-03"
    assert report["year"] == 2026
    assert report["month"] == 3
    assert report["generated_by"] == "manual"
    assert report["generated_at"] is not None
    assert set(report) >= {"users", "runs", "conversions", "feedback"}


def test_generate_monthly_report_for_manual_period_aggregates_counts(celery_worker):
    """Manual report generation aggregates user, run, pipeline, and feedback counts."""
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
    """Manual report generation calculates rates, conversions, and previous-period deltas."""
    _seed_march_report_source_data()

    report = _generate_march_report(celery_worker)

    assert report["runs"]["success_rate"] == 0.5
    assert report["runs"]["failure_rate"] == 0.5
    assert report["runs"]["delta_total"] == 2
    assert report["runs"]["delta_success_rate"] == -0.5
    assert report["conversions"]["anon_to_registered"] == 1
    assert report["conversions"]["conversion_rate"] == 1.0
    assert report["conversions"]["delta_anon_to_registered"] == 1
    assert report["conversions"]["delta_conversion_rate"] == 1.0
    assert report["users"]["delta_new_registrations"] == 0
    assert report["users"]["delta_active"] == 1
    assert report["feedback"]["delta_total"] == 1


def test_generate_monthly_report_default_uses_previous_month(celery_worker):
    """Scheduled report generation targets the month before today's month."""

    class FixedDate(datetime.date):
        """Fixed date class that makes the scheduled report period deterministic."""

        @classmethod
        def today(cls):
            """Return a stable date whose previous month is April 2026."""
            return cls(2026, 5, 27)

    with (
        patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(mongo.db)),
        patch("backend.worker.tasks.datetime.date", FixedDate),
    ):
        generate_monthly_report.delay().get(timeout=CELERY_TASK_TIMEOUT)

    report = mongo.db.monthly_reports.find_one({"_id": "2026-04"})
    assert report["generated_by"] == "scheduled"


def test_generate_monthly_report_handles_no_runs(celery_worker):
    """Monthly report generation handles an empty reporting period without rates."""
    with patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(mongo.db)):
        generate_monthly_report.delay(target_year=2026, target_month=3).get(timeout=CELERY_TASK_TIMEOUT)

    report = mongo.db.monthly_reports.find_one({"_id": "2026-03"})
    assert report["runs"]["total"] == 0
    assert report["runs"]["success_rate"] is None
    assert report["conversions"]["conversion_rate"] is None


def test_generate_monthly_report_replaces_existing_report(celery_worker):
    """Monthly report generation replaces an existing report for the same period."""
    mongo.db.monthly_reports.insert_one({"_id": "2026-03", "year": 2026, "month": 3, "old": True})

    with patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(mongo.db)):
        generate_monthly_report.delay(target_year=2026, target_month=3).get(timeout=CELERY_TASK_TIMEOUT)

    assert mongo.db.monthly_reports.count_documents({"_id": "2026-03"}) == 1
    assert "old" not in mongo.db.monthly_reports.find_one({"_id": "2026-03"})


def test_cleanup_anonymous_data_deletes_expired_session_data(test_data_roots):
    """Expired anonymous sessions delete owned files, runs, uploads, and consent rows."""
    upload_file = test_data_roots.uploads / "upload.fna"
    upload_file.write_text(">x\nAC\n")
    output_dir = test_data_roots.anon_dir / "output"
    output_dir.mkdir()
    cutoff = utc_now()
    mongo.db.anonymous_sessions.insert_one(
        {
            "_id": ObjectId(),
            "session_id": TEST_SESSION_ID,
            "last_activity_at": cutoff - datetime.timedelta(days=1),
        }
    )
    mongo.db.runs.insert_one(
        {"_id": ObjectId(), "session_id": TEST_SESSION_ID, "output_path": serialize_path(output_dir)}
    )
    mongo.db.uploads.insert_one({"_id": ObjectId(), "session_id": TEST_SESSION_ID, "path": str(upload_file)})
    mongo.db.legal_acceptances.insert_one({"_id": ObjectId(), "session_id": TEST_SESSION_ID})

    result = _cleanup_expired_anonymous_data(
        mongo.db, test_data_roots.uploads, test_data_roots.user_data, cutoff
    )

    assert result["deleted_runs"] == 1
    assert result["deleted_uploads"] == 1
    assert not output_dir.exists()
    assert not upload_file.exists()
    assert mongo.db.anonymous_sessions.count_documents({}) == 0


def test_cleanup_anonymous_data_keeps_unexpired_sessions(test_data_roots):
    """Anonymous cleanup leaves sessions newer than the cutoff untouched."""
    mongo.db.anonymous_sessions.insert_one(
        {"_id": ObjectId(), "session_id": TEST_SESSION_ID, "last_activity_at": utc_now()}
    )

    result = _cleanup_expired_anonymous_data(
        mongo.db,
        test_data_roots.uploads,
        test_data_roots.user_data,
        utc_now() - datetime.timedelta(days=1),
    )

    assert result["deleted_sessions"] == 0
    assert mongo.db.anonymous_sessions.count_documents({}) == 1


def test_cleanup_anonymous_data_retains_records_for_paths_outside_root(test_data_roots, tmp_path):
    """Cleanup refuses to delete records whose paths resolve outside managed roots."""
    outside = tmp_path / "outside.fna"
    outside.write_text("keep")
    cutoff = utc_now()
    mongo.db.anonymous_sessions.insert_one(
        {
            "_id": ObjectId(),
            "session_id": TEST_SESSION_ID,
            "last_activity_at": cutoff - datetime.timedelta(days=1),
        }
    )
    mongo.db.uploads.insert_one({"_id": ObjectId(), "session_id": TEST_SESSION_ID, "path": str(outside)})

    result = _cleanup_expired_anonymous_data(
        mongo.db, test_data_roots.uploads, test_data_roots.user_data, cutoff
    )

    assert result["retained_uploads"] == 1
    assert outside.exists()
    assert mongo.db.uploads.count_documents({}) == 1


def test_cleanup_anonymous_data_retains_records_when_path_type_unexpected(test_data_roots):
    """Cleanup keeps DB records when tracked paths have unexpected filesystem types."""
    upload_dir = test_data_roots.uploads / "directory-instead-of-file"
    upload_dir.mkdir()
    output_file = test_data_roots.anon_dir / "file-instead-of-directory"
    output_file.write_text("unexpected")
    cutoff = utc_now()
    mongo.db.anonymous_sessions.insert_one(
        {
            "_id": ObjectId(),
            "session_id": TEST_SESSION_ID,
            "last_activity_at": cutoff - datetime.timedelta(days=1),
        }
    )
    mongo.db.uploads.insert_one({"_id": ObjectId(), "session_id": TEST_SESSION_ID, "path": str(upload_dir)})
    mongo.db.runs.insert_one(
        {"_id": ObjectId(), "session_id": TEST_SESSION_ID, "output_path": serialize_path(output_file)}
    )

    result = _cleanup_expired_anonymous_data(
        mongo.db, test_data_roots.uploads, test_data_roots.user_data, cutoff
    )

    assert result["retained_uploads"] == 1
    assert result["retained_runs"] == 1
    assert mongo.db.uploads.count_documents({}) == 1
    assert mongo.db.runs.count_documents({}) == 1


def test_cleanup_anonymous_data_task_uses_configured_roots(test_data_roots, celery_worker):
    """Cleanup Celery task reads configured roots and runs against the isolated test DB."""
    with (
        patch(
            "backend.worker.tasks._get_data_roots",
            return_value=(test_data_roots.uploads, test_data_roots.user_data),
        ),
        patch("backend.worker.tasks.MongoClient", return_value=MongoClientForTestDb(mongo.db)),
    ):
        result = cleanup_anonymous_data.delay().get(timeout=CELERY_TASK_TIMEOUT)

    assert result["deleted_sessions"] == 0
