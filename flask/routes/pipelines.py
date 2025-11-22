"""
Pipeline Management Endpoints

This module handles all pipeline run CRUD operations, including initialization, deletion,
listing runs and files, and secure download of output files. Endpoints enforce user or session-level
authorization to protect user data.

Features:
    - Run initialization (database entry)
    - Run deletion with file system cleanup
    - Listing of all runs for authenticated or session users
    - Listing of output files for a given run
    - Secure file download with mimetype detection and subdirectory support

:requires: Flask, Flask-Login, MongoDB (via extensions.mongo), OS, shutil, datetime, traceback
"""

import os
import shutil
import traceback
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, jsonify,send_file, session
from flask_login import current_user
from extensions import mongo

pipelines_bp = Blueprint('pipelines', __name__)

@pipelines_bp.route('/api/runs/<run_id>', methods=['DELETE'])
def delete_run(run_id):
    """
    Delete a pipeline run and its associated output files.

    Only allows deletion if the run belongs to the current authenticated user.
    Removes output files/folders from disk and deletes the corresponding database entry.

    :param run_id: The ObjectId string of the run to delete.
    :type run_id: str
    :returns: JSON message with success or error.
    :rtype: flask.Response

    Workflow:
        1. Fetch run from DB for current user.
        2. Remove output directory from disk if it exists.
        3. Delete run from DB.
    """
    try:
        if current_user.is_authenticated:
            user_id = str(current_user.id)
            run = mongo.db.runs.find_one({"_id": ObjectId(run_id), "user_id": user_id})

        else:
            session_id = session.get('session_id')
            run = mongo.db.runs.find_one({"_id": ObjectId(run_id), "session_id": session_id})
        if not run:
            return jsonify({"error": "Run not found"}), 404

        # Delete output files/folders
        if os.path.exists(run['output_path']):
            shutil.rmtree(run['output_path'])

        # Remove from database
        mongo.db.runs.delete_one({"_id": ObjectId(run_id)})
        return jsonify({"message": "Run deleted successfully"}), 200

    except Exception as e:
        print(f"Error deleting run: {str(e)}")
        return jsonify({"error": "Failed to delete run"}), 500

@pipelines_bp.route('/api/init_run_id', methods=['POST'])
def init_run_id():
    """
    Initialize a new pipeline run in the database.

    Sets initial status to "pending" and records creation timestamp.

    :returns: JSON object with new run_id.
    :rtype: flask.Response
    """
    run_doc = {
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    return jsonify({"run_id": str(run_result.inserted_id)})

@pipelines_bp.route('/api/pipelines', methods=['GET'])
def get_pipeline_runs():
    """
    List all pipeline runs for the current user or anonymous session.

    Authenticated users see their runs; anonymous users see runs for their session_id.

    :returns: List of run documents, formatted for the frontend.
    :rtype: flask.Response

    Workflow:
        1. Check if user is authenticated.
        2. Query DB for runs by user_id or session_id.
        3. Format and return run info for each run.
    """
    try:
        if current_user.is_authenticated:
            runs = list(mongo.db.runs.find({"user_id": str(current_user.id)}))
        else:
            session_id = session.get('session_id')
            runs = list(mongo.db.runs.find({"session_id": session_id})) if session_id else []

        formatted_runs = []
        for run in runs:
            formatted = {
                "_id": str(run["_id"]),
                "pipeline": run.get("pipeline", "unknown"),
                "status": run.get("status", "unknown"),
                "timestamp": run.get("timestamp", "").replace("_", " "),
                "output_path": run.get("output_path", ""),
                "user_id": run.get("user_id", "unknown")
            }
            formatted_runs.append(formatted)
        return jsonify(formatted_runs), 200

    except Exception as e:
        print(f"Error fetching pipeline runs: {str(e)}")
        return jsonify({"error": "Failed to fetch pipeline runs"}), 500

@pipelines_bp.route('/api/runs/<run_id>/files/<path:filename>', methods=['GET'])
def get_run_file(run_id, filename):
    """
    Download a file for a specific pipeline run.

    Checks user/session authorization for the run. Supports nested files (e.g., annotation/ subdirectory).
    Detects mimetype for common bioinformatics file types.

    :param run_id: The ObjectId string of the run.
    :type run_id: str
    :param filename: The (possibly nested) file path relative to the run's output directory.
    :type filename: str
    :returns: File stream or JSON error.
    :rtype: flask.Response

    Workflow:
        1. Fetch run for user/session.
        2. Resolve the requested file path (with subdir support).
        3. Serve file with correct mimetype, or return error.
    """
    try:
        # Auth or session check
        if current_user.is_authenticated:
            query = {"_id": ObjectId(run_id), "user_id": str(current_user.id)}
        else:
            session_id = session.get('session_id')
            if not session_id:
                return jsonify({"error": "Unauthorized"}), 403
            query = {"_id": ObjectId(run_id), "session_id": session_id}

        run = mongo.db.runs.find_one(query)
        if not run:
            return jsonify({"error": "Run not found"}), 404

        # Support subdirs (e.g. "annotation/example.fna")
        file_path = os.path.join(run['output_path'], *filename.split('/'))
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        # Return correct mimetype
        if filename.endswith(('.yml', '.yaml')):
            return send_file(file_path, as_attachment=True)
        elif filename.endswith(('.txt', '.log')):
            return send_file(file_path, mimetype='text/plain')
        elif filename.endswith('.fna'):
            return send_file(file_path, mimetype='application/octet-stream')
        else:
            return jsonify({"error": "Unsupported file type"}), 400

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@pipelines_bp.route('/api/runs/<run_id_str>/files', methods=['GET'])
def get_run_files(run_id_str):
    """
    List all output files for a specific pipeline run.

    Handles both main output directory and special annotation subdirectory for Genomic Region Generator pipeline.

    :param run_id_str: The ObjectId string of the run.
    :type run_id_str: str
    :returns: List of file metadata dictionaries (name, type, size).
    :rtype: flask.Response

    Workflow:
        1. Auth/session check for run.
        2. List files in run output directory.
        3. If pipeline is Genomic Region Generator, include files from annotation subdir.
    """
    try:
        if not run_id_str:
            return jsonify({"error": "Invalid run ID"}), 400
        try:
            run_id = ObjectId(run_id_str)
        except Exception:
            traceback.print_exc()
            return jsonify({"error": "Invalid run ID"}), 400
        
        # Auth or session check
        if current_user.is_authenticated:
            query = {"_id": run_id, "user_id": str(current_user.id)}
        else:
            session_id = session.get('session_id')
            if not session_id:
                return jsonify({"error": "Unauthorized"}), 403
            query = {"_id": run_id, "session_id": session_id}

        run = mongo.db.runs.find_one(query)
        if not run:
            return jsonify({"error": "Run not found"}), 404

        output_dir = run['output_path']
        files = []

        # Main output dir files
        for fname in os.listdir(output_dir):
            if fname.endswith(('.yml', '.yaml', '.txt', '.log')):
                files.append({
                    "name": fname,
                    "type": "log" if "log" in fname else "config",
                    "size": os.path.getsize(os.path.join(output_dir, fname))
                })

        # Special handling for "Genomic Region Generator" pipeline
        if run.get("pipeline") == "Genomic Region Generator":
            output_gen = os.path.join(output_dir, "annotation")
            if os.path.exists(output_gen):
                for fname in os.listdir(output_gen):
                    if fname.endswith(('.yml', '.yaml', '.txt', '.log', '.fna')):
                        files.append({
                            "name": f"annotation/{fname}",
                            "type": "log" if "log" in fname else "config",
                            "size": os.path.getsize(os.path.join(output_gen, fname))
                        })
        return jsonify(files), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500