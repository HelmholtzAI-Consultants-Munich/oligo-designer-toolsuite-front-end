"""
Genomic endpoints for region generation and processing.

Cascaded endpoints (under `/api/genomic/cascaded/`) are designed to be used as intermediate steps in pipeline workflows:
they generate genomic regions and pass the locations of created files/directories to downstream processes.
Other endpoints are standalone: they run the full pipeline and return the output directly to the user.
"""
from flask import Blueprint, request, jsonify, current_app, session
from flask_login import current_user
from bson import ObjectId
import os
import subprocess
from datetime import datetime
import yaml
import traceback
from extensions import mongo
from .helpers import to_bool, to_int, generate_single_region_forms, get_form_cache_key

genomic_bp = Blueprint('genomic', __name__)

@genomic_bp.route('/api/genomic/cascaded/ncbi', methods=['POST'])
def genomic_cascaded_ncbi():
    """
    Cascaded endpoint: Generate genomic regions from NCBI for downstream pipeline steps.

    :input:
        :param formdata: Dictionary of region extraction parameters and NCBI source info.
        :type formdata: dict

    :output:
        :returns: JSON with status, message, and annotation file paths (for .fna files).
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Set up user/session-specific working directory.
        3. Insert new MongoDB run document.
        4. Build YAML config for NCBI region extraction.
        5. Run genomic region generator.
        6. Gather annotation output file paths for downstream steps.
        7. Update MongoDB status and return result.
    """
    try:
        # Handle authentication/session to determine user directory
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            config_path = os.path.join(user_dir, "config_genomic_ensemble.yaml")
            session_id = None
        else:
            user_id = None
            session_id = session['session_id']
            user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session_id)
            config_path = os.path.join(user_dir, 'config.yaml')
        config_genomic = {}

        # Parse JSON data from the request
        form_data = request.json
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_genomic_ncbi_{timestamp}')
        output_gen = output_path + "/annotation"

        # Insert run document in MongoDB
        run_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": output_path,
            "status": "started",
            "pipeline": 'Genomic Region Generator'
        }
        run_result = mongo.db.runs.insert_one(run_doc)
        run_id = run_result.inserted_id
        single_region_forms = generate_single_region_forms(form_data)

        all_fna_files = []
        cached_skips = []
        cache_dir= os.path.join(current_app.root_path, 'cache')
        for single_form in single_region_forms:
            cache_key = get_form_cache_key(single_form)
            output_path = os.path.join(cache_dir, f"cached_genomic_{cache_key}")
            output_gen = os.path.join(output_path, "annotation")

            # Check if cached output already exists
            if os.path.exists(output_gen) and any(fname.endswith('.fna') for fname in os.listdir(output_gen)):
                # Cached hit, reuse
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))
                cached_skips.append(cache_key)
                continue

            # Not cached — generate YAML and run pipeline
            config_path = os.path.join(cache_dir, f"config_genomic_{cache_key}.yaml")
            config_genomic = {
                "dir_output": output_path,
                "source": single_form['source']['value'],
                "source_params": {
                    'taxon': single_form['source_params']['taxon']['value'],
                    "species": single_form['source_params']['species']['value'],
                    "annotation_release": to_int(single_form['source_params']['annotation_release']['value']),
                },
                "genomic_regions": {
                    key: to_bool(val['value'])
                    for key, val in single_form['genomic_regions'].items()
                },
                "exon_exon_junction_block_size": to_int(single_form['exon_exon_junction_block_size']['value'])
            }

            with open(config_path, 'w') as yaml_file:
                yaml.dump(config_genomic, yaml_file)

            result = subprocess.run(
                ['genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )
            status = "completed" if result.returncode == 0 else "error"


            if result.returncode != 0:
                raise RuntimeError(f"Pipeline failed: {result.stderr}")

            # Collect output .fna files (ignore GCF/GCA)
            if os.path.exists(output_gen):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))


            # Update run status in MongoDB
            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": status}}
            )

            if result.returncode != 0:
                return jsonify({
                    "status": "error",
                    "message": "An error occurred during genomic processing.",
                    "error": result.stderr
                }), 500

        return jsonify({
            "status": "success",
            "message": f"Genomic processing completed successfully. {len(cached_skips)} used from cache.",
            "output": all_fna_files,
            "cached": cached_skips
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": "Internal server error",
            "error": str(e)
        }), 500

@genomic_bp.route('/api/genomic/cascaded/ensembl', methods=['POST'])
def genomic_cascaded_ensemble():
    """
    Cascaded endpoint: Generate genomic regions from Ensembl for downstream pipeline steps.

    :input:
        :param formdata: Dictionary of region extraction parameters and Ensembl source info.
        :type formdata: dict

    :output:
        :returns: JSON with status, message, and annotation file paths (for .fna files).
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Set up user/session-specific working directory.
        3. Insert new MongoDB run document.
        4. Build YAML config for Ensembl region extraction.
        5. Run genomic region generator.
        6. Gather annotation output file paths for downstream steps.
        7. Update MongoDB status and return result.
    """
    try:
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            session_id = None
        else:
            user_id = None
            session_id = session['session_id']
            user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session_id)

        form_data = request.json
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        run_output_path = os.path.join(user_dir, f'output_genomic_ensemble_{timestamp}')

        run_doc = {
            "session_id": session_id,
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": run_output_path,
            "status": "started",
            "pipeline": 'Genomic Region Generator'
        }
        run_result = mongo.db.runs.insert_one(run_doc)
        run_id = run_result.inserted_id

        single_region_forms = generate_single_region_forms(form_data)

        all_fna_files = []
        cached_skips = []
        cache_dir = os.path.join(current_app.root_path, 'cache')

        for single_form in single_region_forms:
            cache_key = get_form_cache_key(single_form)
            output_path = os.path.join(cache_dir, f"cached_genomic_{cache_key}")
            output_gen = os.path.join(output_path, "annotation")

            if os.path.exists(output_gen) and any(fname.endswith('.fna') for fname in os.listdir(output_gen)):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))
                cached_skips.append(cache_key)
                continue

            config_path = os.path.join(cache_dir, f"config_genomic_{cache_key}.yaml")
            config_genomic = {
                "dir_output": output_path,
                "source": single_form['source']['value'],
                "source_params": {
                        "species": single_form['source_params']['species']['value'],
                    "annotation_release": to_int(single_form['source_params']['annotation_release']['value']),
                },
                "genomic_regions": {
                    key: to_bool(val['value'])
                    for key, val in single_form['genomic_regions'].items()
                },
                "exon_exon_junction_block_size": to_int(single_form['exon_exon_junction_block_size']['value'])
            }

            with open(config_path, 'w') as yaml_file:
                yaml.dump(config_genomic, yaml_file)

            result = subprocess.run(
                ['genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )
            status = "completed" if result.returncode == 0 else "error"

            if result.returncode != 0:
                raise RuntimeError(f"Pipeline failed: {result.stderr}")

            if os.path.exists(output_gen):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        all_fna_files.append(os.path.join(output_gen, fname))

            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": status}}
            )

        return jsonify({
            "status": "success",
            "message": f"Genomic processing completed successfully. {len(cached_skips)} used from cache.",
            "output": all_fna_files,
            "cached": cached_skips
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500