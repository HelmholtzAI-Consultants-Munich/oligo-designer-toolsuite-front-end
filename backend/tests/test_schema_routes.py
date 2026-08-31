"""Tests the endpoint serving the JSON Schemas the front-end builds its pipeline forms from."""

import json
from pathlib import Path

import pytest
from glom import glom

from backend.worker.models import FRONT_END_SCHEMAS, build_pipeline_schema

SCHEMA_ROUTE = "/api/pipelines/{}/schema"

# The front-end tests cannot reach a running backend, so they read this committed copy of the
# oligoseq schema instead. The last test in this file compares the two, so it cannot fall behind
# the models without failing.
FIXTURE_PATH = Path(__file__).parents[2] / "src" / "tests" / "fixtures" / "oligoseq.schema.json"


@pytest.mark.parametrize("pipeline_name", FRONT_END_SCHEMAS)
def test_schema_is_served_for_every_pipeline(client, pipeline_name):
    """Every pipeline a form can be opened for answers with a usable schema."""
    response = client.get(SCHEMA_ROUTE.format(pipeline_name))

    assert response.status_code == 200
    assert response.mimetype == "application/json"

    schema = response.get_json()
    assert schema["type"] == "object"
    assert schema["properties"]
    assert schema["$defs"]


@pytest.mark.parametrize("pipeline_name", FRONT_END_SCHEMAS)
def test_schema_leaves_out_the_fields_the_server_fills_in(client, pipeline_name):
    """`general` is set from `PIPELINE_NON_EXPOSED_FIELDS`, so the form must never offer it."""
    schema = client.get(SCHEMA_ROUTE.format(pipeline_name)).get_json()

    assert "general" not in schema["properties"]


@pytest.mark.parametrize("pipeline_name", FRONT_END_SCHEMAS)
def test_schema_drops_the_docstrings_written_for_developers(client, pipeline_name):
    """The front-end renders a description as a tooltip, so `models.py`'s own must be stripped."""
    schema = client.get(SCHEMA_ROUTE.format(pipeline_name)).get_json()

    assert "description" not in schema


def test_schema_widens_the_fields_holding_an_uploaded_file(client):
    """A file input holds a `File` until submission, where the model wants the path it is saved to."""
    schema = client.get(SCHEMA_ROUTE.format("oligoseq")).get_json()

    vcf_files = glom(schema, "$defs.OligoSeqVariantFilterEnabled.properties.files_vcf_reference_database")

    assert vcf_files["items"]["anyOf"] == [{"type": "string"}, {"type": "object"}]


def test_unknown_pipeline_is_not_found(client):
    """A name with no model behind it is a 404, not a 500 from the missing key."""
    response = client.get(SCHEMA_ROUTE.format("does-not-exist"))

    assert response.status_code == 404
    assert "error" in response.get_json()


def test_unchanged_schema_is_not_sent_again(client):
    """The body runs to tens of kilobytes, so a reload should revalidate rather than refetch."""
    response = client.get(SCHEMA_ROUTE.format("oligoseq"))
    etag = response.headers["ETag"]

    assert response.cache_control.no_cache

    revalidated = client.get(SCHEMA_ROUTE.format("oligoseq"), headers={"If-None-Match": etag})

    assert revalidated.status_code == 304
    assert not revalidated.get_data()


def test_route_is_not_swallowed_by_the_pipeline_submission_route(client):
    """`/api/<pipeline_name>` accepts POSTs, so a POST here must fall through to it, not match."""
    response = client.post(SCHEMA_ROUTE.format("oligoseq"))

    assert response.status_code == 405


@pytest.mark.skipif(
    not FIXTURE_PATH.exists(),
    reason="the server image holds `backend/` alone, so there is no front-end fixture to compare",
)
def test_front_end_test_fixture_matches_the_generated_schema():
    """The schema the front-end tests run against is still the one the models produce.

    Notes:
        Vitest has no backend to fetch from, so two of its specs read a committed copy of this
        schema. This is the only checked-in schema left, and this test is what keeps it from
        drifting the way the deleted `schemas/` directory could.
    """
    fixture = json.loads(FIXTURE_PATH.read_text())

    assert fixture == build_pipeline_schema("oligoseq"), (
        f"{FIXTURE_PATH.name} is out of date. Refresh it with:\n"
        "  curl -s http://localhost:8000/api/pipelines/oligoseq/schema"
        f" | npx prettier --parser json > {FIXTURE_PATH}"
    )
