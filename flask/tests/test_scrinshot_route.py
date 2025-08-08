import os
import io
import json
import types
import builtins
from datetime import datetime
from bson import ObjectId
import pytest
from flask import Flask
from importlib import import_module

# ---------- Helpers to build formdata with all required keys ----------

def _v(x):
    return {"value": x}

def build_formdata(tmpdir):
    # Create some temp files that the route will later delete
    fasta1 = tmpdir.join("targets1.fasta")
    fasta2 = tmpdir.join("targets2.fasta")
    ref1 = tmpdir.join("refs1.fasta")
    ref2 = tmpdir.join("refs2.fasta")
    for f in [fasta1, fasta2, ref1, ref2]:
        f.write(">x\nACGT\n")

    # file_regions as a comma-separated string (so endpoint writes a .txt, then deletes it)
    regions_value = "GeneA,GeneB"

    return {
        "n_jobs": _v("2"),
        "dir_output": _v(""),  # ignored, route builds its own output_path
        "write_intermediate_steps": _v("true"),
        "top_n_sets": _v("3"),

        "file_regions": _v(regions_value),  # triggers creation of a tmp .txt then deletion
        "files_fasta_target_probe_database": _v(f"{str(fasta1)}\n{str(fasta2)}"),
        "files_fasta_reference_database_target_probe": _v(f"{str(ref1)}\n{str(ref2)}"),
        "target_probe_length_min": _v("18"),
        "target_probe_length_max": _v("25"),
        "target_probe_isoform_consensus": _v("1"),

        "target_probe_GC_content_min": _v("30"),
        "target_probe_GC_content_opt": _v("45"),
        "target_probe_GC_content_max": _v("60"),
        "target_probe_Tm_min": _v("50"),
        "target_probe_Tm_opt": _v("60"),
        "target_probe_Tm_max": _v("70"),

        "target_probe_homopolymeric_base_n": {
            "A": _v("4"),
            "T": _v("4"),
            "C": _v("4"),
            "G": _v("4"),
        },

        "target_probe_padlock_arm_Tm_dif_max": _v("5"),
        "target_probe_padlock_arm_length_min": _v("12"),
        "target_probe_padlock_arm_Tm_min": _v("55"),
        "target_probe_padlock_arm_Tm_max": _v("65"),

        "detection_oligo_min_thymines": _v("1"),
        "detection_oligo_length_min": _v("18"),
        "detection_oligo_length_max": _v("25"),

        "target_probe_ligation_region_size": _v("5"),

        "target_probe_isoform_weight": _v("1"),
        "target_probe_GC_weight": _v("1"),
        "target_probe_Tm_weight": _v("1"),
        "set_size_min": _v("20"),
        "set_size_opt": _v("24"),
        "distance_between_target_probes": _v("10"),
        "n_sets": _v("2"),

        "detection_oligo_U_distance": _v("3"),
        "detection_oligo_Tm_opt": _v("60"),

        "target_probe_specificity_blastn_search_parameters": {
            "perc_identity": _v("90"),
            "strand": _v("both"),
            "word_size": _v("11"),
            "dust": _v("yes"),
            "soft_masking": _v("true"),
            "max_target_seqs": _v("10"),
            "max_hsps": _v("1"),
        },
        "target_probe_specificity_blastn_hit_parameters": {
            "coverage": _v("80")
        },

        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": _v("85"),
            "strand": _v("both"),
            "word_size": _v("11"),
            "dust": _v("yes"),
            "soft_masking": _v("true"),
            "max_target_seqs": _v("10"),
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "coverage": _v("75")
        },

        "max_graph_size": _v("1000"),
        "n_attempts": _v("5"),
        "heuristic": _v("true"),
        "heuristic_n_attempts": _v("3"),

        "target_probe_Tm_parameters": {
            "nn_table": _v("dna_NN4"),
            "tmm_table": _v("dna_TMM1"),
            "imm_table": _v("dna_IMM1"),
            "de_table": _v("dna_DE1"),
            "dnac1": _v("50"),
            "dnac2": _v("50"),
            "saltcorr": _v("1"),
            "Na": _v("50"),
            "K": _v("0"),
            "Tris": _v("10"),
            "Mg": _v("1"),
            "dNTPs": _v("0"),
        },

        "target_probe_Tm_chem_correction_parameters": {
            "DMSO": _v("0"),
            "fmd": _v("0"),
            "DMSOfactor": _v("0.0"),
            "fmdfactor": _v("0.0"),
            "fmdmethod": _v("0"),
            "GC": _v(""),  # to_null(None)
        },

        "detection_oligo_Tm_parameters": {
            "nn_table": _v("dna_NN4"),
            "tmm_table": _v("dna_TMM1"),
            "imm_table": _v("dna_IMM1"),
            "de_table": _v("dna_DE1"),
            "dnac1": _v("50"),
            "dnac2": _v("50"),
            "saltcorr": _v("1"),
            "Na": _v("50"),
            "K": _v("0"),
            "Tris": _v("10"),
            "Mg": _v("1"),
            "dNTPs": _v("0"),
        },
        "detection_oligo_Tm_chem_correction_parameters": {
            "DMSO": _v("0"),
            "fmd": _v("0"),
            "DMSOfactor": _v("0.0"),
            "fmdfactor": _v("0.0"),
            "fmdmethod": _v("0"),
            "GC": _v(""),
        },
    }


# ---------- Fake Mongo to capture calls ----------

class FakeUpdateResult:
    def __init__(self, matched_count):
        self.matched_count = matched_count

class FakeRunsCollection:
    def __init__(self):
        self.calls = []

    def update_one(self, filter_doc, set_doc):
        # record call for assertions
        self.calls.append((filter_doc, set_doc))
        # first call should be "started", second "completed" or "error"
        # we always return matched_count=1 for success tests unless overridden
        return FakeUpdateResult(matched_count=1)

class FakeMongo:
    def __init__(self):
        self.runs = FakeRunsCollection()

    @property
    def db(self):
        # mimic extensions.mongo.db.runs
        return types.SimpleNamespace(runs=self.runs)


# ---------- Pytest fixtures ----------

@pytest.fixture
def app(tmp_path, monkeypatch):
    # Create a minimal Flask app and register your blueprint
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.secret_key = "test"  # needed for sessions

    # Make root_path point to a temp dir so user_data writes land there
    app.root_path = str(tmp_path)

    # Import the module containing the blueprint AFTER we set up a fake mongo
    # We patch the 'mongo' that was imported into that module.
    fake_mongo = FakeMongo()

    scrinshot_mod = import_module("scrinshot")  # <-- adjust if your module path differs
    # Replace the imported 'mongo' inside the module
    monkeypatch.setattr(scrinshot_mod, "mongo", fake_mongo, raising=True)

    # Register blueprint
    app.register_blueprint(scrinshot_mod.scrinshot_bp)

    return app


@pytest.fixture
def client(app):
    return app.test_client()


# ---------- Tests ----------

def test_scrinshot_success(client, app, monkeypatch, tmp_path):
    # Anonymous session
    with client.session_transaction() as sess:
        sess["session_id"] = "anon-123"

    # Mock subprocess.run -> success returncode
    class FakeCompleted:
        def __init__(self):
            self.returncode = 0
            self.stdout = "OK"
            self.stderr = ""

    def fake_run(args, capture_output, text):
        # Ensure we are calling the right CLI with -c <config_path>
        assert args[0] == "scrinshot_probe_designer"
        assert args[1] == "-c"
        assert os.path.exists(args[2]), "config.yaml was not written"
        return FakeCompleted()

    monkeypatch.setattr("scrinshot.subprocess.run", fake_run)

    # Build full formdata including actual temp files to be deleted
    formdata = build_formdata(tmp_path)

    # Keep references to files that should be deleted by the route
    target_files = [
        p for p in formdata["files_fasta_target_probe_database"]["value"].split("\n")
        if p.strip()
    ]
    ref_files = [
        p for p in formdata["files_fasta_reference_database_target_probe"]["value"].split("\n")
        if p.strip()
    ]

    runid = str(ObjectId())

    resp = client.post(
        "/api/scrinshot",
        data=json.dumps({"formdata": formdata, "runid": runid}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["run_id"] == runid

    # Assert temp fasta files are deleted
    for p in target_files + ref_files:
        assert not os.path.exists(p), f"File {p} should have been deleted"

    # The regions .txt file was created internally; we can't know its name, but we can at least trust no leftover .txt in tmp
    leftover_txts = list(tmp_path.glob("*.txt"))
    assert leftover_txts == [], f"Should not leave stray .txt files: {leftover_txts}"

def test_invalid_run_id_returns_400(client, app):
    with client.session_transaction() as sess:
        sess["session_id"] = "anon-123"

    bad_runid = "NOT_A_VALID_OBJECT_ID"
    # Minimal formdata to hit the id check branch; content won't be used
    formdata = {"file_regions": {"value": ""}}

    resp = client.post(
        "/api/scrinshot",
        data=json.dumps({"formdata": formdata, "runid": bad_runid}),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "Invalid run ID" in resp.get_data(as_text=True)

def test_run_id_not_found_returns_404(client, app, monkeypatch, tmp_path):
    with client.session_transaction() as sess:
        sess["session_id"] = "anon-123"

    # Force first update_one to return matched_count=0
    scrinshot_mod = import_module("scrinshot")
    original_update_one = scrinshot_mod.mongo.db.runs.update_one

    def fake_update_one(filter_doc, set_doc):
        # Simulate not found *on the first call* (status='started')
        return type("R", (), {"matched_count": 0})()

    monkeypatch.setattr(scrinshot_mod.mongo.db.runs, "update_one", fake_update_one)

    formdata = build_formdata(tmp_path)
    runid = str(ObjectId())

    resp = client.post(
        "/api/scrinshot",
        data=json.dumps({"formdata": formdata, "runid": runid}),
        content_type="application/json",
    )
    assert resp.status_code == 404
    assert "Run ID not found" in resp.get_data(as_text=True)

def test_subprocess_failure_sets_error_status(client, app, monkeypatch, tmp_path):
    with client.session_transaction() as sess:
        sess["session_id"] = "anon-123"

    # Make subprocess fail
    class FakeCompleted:
        def __init__(self):
            self.returncode = 1
            self.stdout = "boom"
            self.stderr = "boom"

    def fake_run(args, capture_output, text):
        return FakeCompleted()

    monkeypatch.setattr("scrinshot.subprocess.run", fake_run)

    # Spy on the second update_one call to see status="error"
    scrinshot_mod = import_module("scrinshot")
    calls = []

    def spy_update_one(filter_doc, set_doc):
        calls.append((filter_doc, set_doc))
        # pretend found
        return type("R", (), {"matched_count": 1})()

    monkeypatch.setattr(scrinshot_mod.mongo.db.runs, "update_one", spy_update_one)

    formdata = build_formdata(tmp_path)
    runid = str(ObjectId())

    resp = client.post(
        "/api/scrinshot",
        data=json.dumps({"formdata": formdata, "runid": runid}),
        content_type="application/json",
    )
    assert resp.status_code == 200

    # Last update should set status=error
    last_call = calls[-1][1]["$set"]
    assert last_call["status"] == "error"
