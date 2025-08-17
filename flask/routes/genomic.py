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
from .helpers import to_bool, to_int

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

        # Build config for the pipeline
        config_genomic['dir_output'] = output_path
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'taxon': form_data['source_params']['taxon']['value'],
            'species': form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
        }
        config_genomic['genomic_regions'] = {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['utr']['value']),
            'cds': to_bool(form_data['genomic_regions']['cds']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

        # Write config to YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        try:
            # Run external genomic region generator
            result = subprocess.run(
                ['genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )
            status = "completed" if result.returncode == 0 else "error"
            print("STDERR:", result.stderr)
            print("STDOUT (partial logs):", result.stdout)

            # Gather .fna files to pass to downstream process, filtering for GCF/GCA
            fna_files = []
            skipped_files = []
            if os.path.exists(output_gen):
                for fname in os.listdir(output_gen):
                    if fname.endswith('.fna'):
                        if 'GCF' in fname or 'GCA' in fname:
                            skipped_files.append(fname)
                        else:
                            fna_files.append(os.path.join(output_gen, fname))

                fna_string = "\n".join(fna_files)
                print("Skipped files (no GCF/GCA):", skipped_files)
            else:
                fna_string = ""

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
                "message": "Genomic processing completed successfully.",
                "output": fna_string
            }), 200
        except subprocess.CalledProcessError as e:
            return jsonify({
                "status": "error",
                "message": "An error occurred during genomic processing.",
                "error": e.stderr
            }), 500
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
        output_path = os.path.join(user_dir, f'output_genomic_ensemble_{timestamp}')
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
        config_genomic['dir_output'] = output_path
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'species': form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
        }
        config_genomic['genomic_regions'] = {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['utr']['value']),
            'cds': to_bool(form_data['genomic_regions']['cds']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

        # Write config to YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        try:
            # Run external genomic region generator
            result = subprocess.run(
                ['genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )
            status = "completed" if result.returncode == 0 else "error"
            print("STDERR:", result.stderr)
            print("STDOUT (partial logs):", result.stdout)
            # Gather .fna files for downstream process
            fna_files = []
            skipped_files = []
            if os.path.exists(output_gen):
                for fname in os.listdir(output_gen):
                    if fname.endswith('.fna'):
                        if 'GCF' in fname or 'GCA' in fname:
                            skipped_files.append(fname)
                        else:
                            fna_files.append(os.path.join(output_gen, fname))

                fna_string = "\n".join(fna_files)
                print("Skipped files (no GCF/GCA):", skipped_files)
            else:
                fna_string = ""

            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": status}}
            )
            return jsonify({
                "status": "success",
                "message": "Genomic processing completed successfully.",
                "output": fna_string
            }), 200
        except subprocess.CalledProcessError as e:
            return jsonify({
                "status": "error",
                "message": "An error occurred during genomic processing.",
                "error": e.stderr
            }), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500