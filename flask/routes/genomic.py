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

@genomic_bp.route('/api/genomic/ncbi', methods=['POST'])
def genomic_ncbi():
    """
    Standalone endpoint: Generate genomic regions from NCBI and run the full pipeline.

    :input:
        :param formdata: Dictionary of region extraction parameters and NCBI source info.
        :type formdata: dict
        :param runid: MongoDB run document ID.
        :type runid: str

    :output:
        :returns: JSON with status, message, output logs, and error details if any.
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Set up user/session-specific working directory.
        3. Update MongoDB run document.
        4. Build YAML config for NCBI region extraction.
        5. Run genomic region generator.
        6. Update MongoDB status and return result/logs.
    """
    try:
        user_dir = ''
        # Handle authentication/session to determine user directory
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            config_path = os.path.join(user_dir, "config_genomic_ncbi.yaml")
            session_id = None
        else:
            user_id = None
            session_id = session['session_id']
            user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session_id)
            config_path = os.path.join(user_dir, 'config.yaml')
        config_genomic = {}

        # Parse JSON data from the request
        form_data = request.json.get('formdata')
        run_idd = request.json.get('runid')  # Run ID from React
        try:
            run_id = ObjectId(run_idd)
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "Invalid run ID"}), 400

        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_genomic_ncbi_{timestamp}')

        # Update run document in MongoDB
        update_result = mongo.db.runs.update_one(
            {"_id": run_id},
            {"$set": {
                "session_id": session_id,
                "user_id": user_id,
                "timestamp": timestamp,
                "output_path": output_path,
                "status": "started",
                "pipeline": "genomic"
            }}
        )
        if update_result.matched_count == 0:
            return jsonify({"error": "Run ID not found"}), 404

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

            # Update run status in MongoDB
            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": status}}
            )

            # Check for errors from subprocess
            if result.returncode != 0:
                return jsonify({
                    "status": "error",
                    "message": "An error occurred during genomic processing.",
                    "error": result.stderr
                }), 500

            return jsonify({
                "status": "success",
                "message": "Genomic processing completed successfully.",
                "output": result.stdout
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

@genomic_bp.route('/api/genomic/ensembl', methods=['POST'])
def genomic_ensemble():
    """
    Standalone endpoint: Generate genomic regions from Ensembl and run the full pipeline.

    :input:
        :param formdata: Dictionary of region extraction parameters and Ensembl source info.
        :type formdata: dict
        :param runid: MongoDB run document ID.
        :type runid: str

    :output:
        :returns: JSON with status, message, output logs, and error details if any.
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Set up user/session-specific working directory.
        3. Update MongoDB run document.
        4. Build YAML config for Ensembl region extraction.
        5. Run genomic region generator.
        6. Update MongoDB status and return result/logs.
    """
    try:
        user_dir = ''
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
        form_data = request.json.get('formdata')
        run_idd = request.json.get('runid')
        try:
            run_id = ObjectId(run_idd)
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "Invalid run ID"}), 400
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_genomic_ensemble_{timestamp}')

        # Update run document in MongoDB
        update_result = mongo.db.runs.update_one(
            {"_id": run_id},
            {"$set": {
                "session_id": session_id,
                "user_id": user_id,
                "timestamp": timestamp,
                "output_path": output_path,
                "status": "started",
                "pipeline": "genomic"
            }}
        )
        if update_result.matched_count == 0:
            return jsonify({"error": "Run ID not found"}), 404

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

            # Update run status in MongoDB
            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": status}}
            )
            return jsonify({
                "status": "success",
                "message": "Genomic processing completed successfully.",
                "output": result.stdout
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

@genomic_bp.route('/api/genomic/custom', methods=['POST'])
def genomic_custom():
    """
    Standalone endpoint: Generate genomic regions from custom user-provided files and run the full pipeline.

    :input:
        :param formdata: Dictionary of region extraction parameters and file paths.
        :type formdata: dict
        :param runid: MongoDB run document ID.
        :type runid: str

    :output:
        :returns: JSON with status, message, output logs, and error details if any.
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Set up user/session-specific working directory.
        3. Update MongoDB run document.
        4. Build YAML config for custom file region extraction.
        5. Run genomic region generator in conda environment.
        6. Clean up uploaded files.
        7. Update MongoDB status and return result/logs.
    """
    try:
        user_dir = ''
        # Handle authentication/session to determine user directory
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            config_path = os.path.join(user_dir, "config_genomic_custom.yaml")
            session_id = None
        else:
            user_id = None
            session_id = session['session_id']
            user_dir = os.path.join(current_app.root_path, 'user_data', 'anon', session_id)
            config_path = os.path.join(user_dir, 'config.yaml')
        config_genomic = {}
        form_data = request.json.get('formdata')
        run_idd = request.json.get('runid')
        try:
            run_id = ObjectId(run_idd)
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "Invalid run ID"}), 400
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_genomic_custom_{timestamp}')

        # Update run document in MongoDB
        update_result = mongo.db.runs.update_one(
            {"_id": run_id},
            {"$set": {
                "session_id": session_id,
                "user_id": user_id,
                "timestamp": timestamp,
                "output_path": output_path,
                "status": "started",
                "pipeline": "genomic"
            }}
        )
        if update_result.matched_count == 0:
            return jsonify({"error": "Run ID not found"}), 404

        # Build config for the pipeline
        config_genomic['dir_output'] = output_path
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'file_annotation': form_data['source_params']['file_annotation']['value'],
            'file_sequence': form_data['source_params']['file_sequence']['value'],
            'file_source': form_data['source_params']['file_source']['value'],
            'species': form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
            'genome_assembly': form_data['source_params']['genome_assembly']['value'],
        }
        config_genomic['genomic_regions'] = {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['UTR']['value']),
            'cds': to_bool(form_data['genomic_regions']['CDS']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

        # Write config to YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        try:
            # Run external genomic region generator in conda env
            result = subprocess.run(
                ['conda', 'run', '-n', 'odt', 'genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )
            status = "completed" if result.returncode == 0 else "error"
            print("STDERR:", result.stderr)
            print("STDOUT (partial logs):", result.stdout)

            # Clean up uploaded files after processing
            if os.path.exists(form_data['file_sequence']['value']):
                os.remove(form_data['file_sequence']['value'])
                os.remove(form_data['file_sequence']['value'] + '.fai')
            if os.path.exists(form_data['file_annotation']['value']):
                os.remove(form_data['file_annotation']['value'])
            # Update run status in MongoDB
            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": status}}
            )
            return jsonify({
                "status": "success",
                "message": "Genomic processing completed successfully.",
                "output": result.stdout
            }), 200
        except subprocess.CalledProcessError as e:
            # Cleanup on error
            if os.path.exists(form_data['file_sequence']['value']):
                os.remove(form_data['file_sequence']['value'])
                os.remove(form_data['file_sequence']['value'] + '.fai')
            if os.path.exists(form_data['file_annotation']['value']):
                os.remove(form_data['file_annotation']['value'])
            return jsonify({
                "status": "error",
                "message": "An error occurred during genomic processing.",
                "error": e.stderr
            }), 500
    except Exception as e:
        # Handle errors
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500

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
            for fname in os.listdir(output_gen):
                if fname.endswith('.fna'):
                    if 'GCF' in fname or 'GCA' in fname:
                        skipped_files.append(fname)
                    else:
                        fna_files.append(os.path.join(output_gen, fname))

            fna_string = "\n".join(fna_files)
            print("Skipped files (no GCF/GCA):", skipped_files)

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
            fna_files = [
                os.path.join(output_gen, fname)
                for fname in os.listdir(output_gen)
                if fname.endswith('.fna')
            ]
            fna_string = "\n".join(fna_files)

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

@genomic_bp.route('/api/genomic/cascaded/custom', methods=['POST'])
def genomic_cascaded_custom():
    """
    Cascaded endpoint: Generate genomic regions from custom files for downstream pipeline steps.

    :input:
        :param formdata: Dictionary of region extraction parameters and file paths.
        :type formdata: dict

    :output:
        :returns: JSON with status, message, and annotation file paths (for .fna files).
        :rtype: flask.Response

    Workflow:
        1. Parse and validate input.
        2. Set up user/session-specific working directory.
        3. Insert new MongoDB run document.
        4. Build YAML config for custom file region extraction.
        5. Run genomic region generator in conda environment.
        6. Clean up uploaded files.
        7. Gather annotation output file paths for downstream steps.
        8. Update MongoDB status and return result.
    """
    try:
        user_dir = ''
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            config_path = os.path.join(user_dir, "config_genomic_custom.yaml")
        else:
            user_id = None
        config_genomic = {}
        form_data = request.json
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_genomic_custom_{timestamp}')
        output_gen = output_path + "/annotation"

        # Insert run document in MongoDB
        run_doc = {
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
            'file_annotation': form_data['source_params']['file_annotation']['value'],
            'file_sequence': form_data['source_params']['file_sequence']['value'],
            'file_source': form_data['source_params']['file_source']['value'],
            'species': form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
            'genome_assembly': form_data['source_params']['genome_assembly']['value'],
        }
        config_genomic['genomic_regions'] = {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['UTR']['value']),
            'cds': to_bool(form_data['genomic_regions']['CDS']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

        # Write config to YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        try:
            # Run external genomic region generator in conda env
            result = subprocess.run(
                ['conda', 'run', '-n', 'odt', 'genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )
            status = "completed" if result.returncode == 0 else "error"
            print("STDERR:", result.stderr)
            print("STDOUT (partial logs):", result.stdout)

            # Clean up uploaded files after processing
            if os.path.exists(form_data['file_sequence']['value']):
                os.remove(form_data['file_sequence']['value'])
                os.remove(form_data['file_sequence']['value'] + '.fai')
            if os.path.exists(form_data['file_annotation']['value']):
                os.remove(form_data['file_annotation']['value'])
            # Update run status in MongoDB
            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": status}}
            )
            # Gather .fna files for downstream process
            fna_files = [
                os.path.join(output_gen, fname)
                for fname in os.listdir(output_gen)
                if fname.endswith('.fna')
            ]
            fna_string = "\n".join(fna_files)
            return jsonify({
                "status": "success",
                "message": "Genomic processing completed successfully.",
                "output": fna_string
            }), 200
        except subprocess.CalledProcessError as e:
            # Cleanup on error
            if os.path.exists(form_data['file_sequence']['value']):
                os.remove(form_data['file_sequence']['value'])
                os.remove(form_data['file_sequence']['value'] + '.fai')
            if os.path.exists(form_data['file_annotation']['value']):
                os.remove(form_data['file_annotation']['value'])
            return jsonify({
                "status": "error",
                "message": "An error occurred during genomic processing.",
                "error": e.stderr
            }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500