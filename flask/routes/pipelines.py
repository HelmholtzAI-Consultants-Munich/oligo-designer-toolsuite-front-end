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
    """Delete a run and its files for the authenticated user."""
    try:
        user_id = str(current_user.id)
        run = mongo.db.runs.find_one({"_id": ObjectId(run_id), "user_id": user_id})
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
    """Initialize a new run in the database."""
    run_doc = {
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    return jsonify({"run_id": str(run_result.inserted_id)})

@pipelines_bp.route('/api/pipelines', methods=['GET'])
def get_pipeline_runs():
    """List all pipeline runs for the current user or session."""
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
    """Download a file for a specific run (with annotation/ subdir support)."""
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

@pipelines_bp.route('/api/runs/<run_id>/files', methods=['GET'])
def get_run_files(run_id):
    """List all files for a specific run."""
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