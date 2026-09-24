"""Tests the endpoint serving the JSON Schemas the front-end builds its pipeline forms from."""

import json
from pathlib import Path

import pytest
from glom import glom

from backend.routes import schemas
from backend.worker import models
from backend.worker.models import FRONT_END_SCHEMAS, build_pipeline_schema

SCHEMA_ROUTE = "/api/pipelines/{}/schema"

# The front-end tests cannot reach a running backend, so they read this committed copy of the
# oligoseq schema instead. The last test in this file compares the two, so it cannot fall behind
# the models without failing.
FIXTURE_PATH = Path(__file__).parents[2] / "src" / "tests" / "fixtures" / "oligoseq.schema.json"


def get_schema(client, pipeline_name: str) -> dict:
    """Returns the pipeline's schema as the front-end receives it."""
    return client.get(SCHEMA_ROUTE.format(pipeline_name)).get_json()


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
    schema = get_schema(client, pipeline_name)

    assert "general" not in schema["properties"]


@pytest.mark.parametrize("pipeline_name", FRONT_END_SCHEMAS)
def test_schema_drops_the_docstrings_written_for_developers(client, pipeline_name):
    """The front-end renders a description as a tooltip, so `models.py`'s own must be stripped.

    Notes:
        The models declared in `models.py` are checked as well as the root, since their docstrings
        say why an ODT model is overridden and would otherwise reach users as help text.
    """
    schema = get_schema(client, pipeline_name)
    local_models = {
        name for name, model in vars(models).items() if getattr(model, "__module__", None) == models.__name__
    }

    assert "description" not in schema
    assert not [
        name for name in schema["$defs"].keys() & local_models if "description" in schema["$defs"][name]
    ]


def test_schema_widens_the_fields_holding_an_uploaded_file(client):
    """A file input holds a `File` until submission, where the model wants the path it is saved to."""
    schema = get_schema(client, "oligoseq")

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


PRESETS_ROUTE = "/api/pipelines/{}/presets"


@pytest.fixture
def preset_dir(tmp_path, monkeypatch):
    """Stands in for the configs ODT ships, with a default and a variant for HCR."""
    (tmp_path / "hcr_probe_designer.yaml").write_text(
        "required_parameters:\n  targets: data/genes/custom_3.txt\n"
        "target_probes:\n  oligo_generation:\n    L_probe_sequence_length: 45\n"
        "schema_version: 2\ngeneral:\n  n_jobs: 2\n"
    )
    (tmp_path / "hcr_probe_designer_gandin.yaml").write_text("target_probes: {}\nschema_version: 2\n")
    (tmp_path / "genomic_region_generator_ncbi.yaml").write_text("source: ncbi\n")
    monkeypatch.setattr(schemas, "files", lambda _: tmp_path)
    schemas.load_presets.cache_clear()
    yield
    schemas.load_presets.cache_clear()


def test_presets_are_served_as_importable_configs(client, preset_dir):
    """Each YAML becomes a preset in the export shape, without ODT's local paths or `general`."""
    presets = client.get(PRESETS_ROUTE.format("hcr")).get_json()

    assert [(p["id"], p["label"]) for p in presets] == [("default", "Default"), ("gandin", "Gandin")]
    assert presets[0]["payload"] == {
        "_meta": {"version": 2, "pipeline": "hcr"},
        "config": {"target_probes": {"oligo_generation": {"L_probe_sequence_length": 45}}},
    }


def test_presets_are_empty_without_matching_configs(client, preset_dir):
    """A pipeline without shipped configs keeps the schema defaults."""
    assert client.get(PRESETS_ROUTE.format("merfish")).get_json() == []


def test_presets_404_for_unknown_pipeline(client):
    assert client.get(PRESETS_ROUTE.format("unknown")).status_code == 404


@pytest.mark.parametrize("pipeline_name", FRONT_END_SCHEMAS)
def test_shipped_presets_match_the_models(pipeline_name):
    """The configs ODT ships fit its models, so a preset never loads fields the form cannot hold."""
    schemas.load_presets.cache_clear()
    presets = schemas.load_presets(pipeline_name)
    if not presets:
        pytest.skip("the installed ODT version ships no configs")

    model = FRONT_END_SCHEMAS[pipeline_name].__bases__[0]
    for preset in presets:
        model.model_validate(preset["payload"]["config"])
