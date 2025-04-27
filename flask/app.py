from datetime import datetime

from flask import Flask, request, jsonify, send_file, current_app
from flask_cors import CORS
import yaml
from flask_pymongo import PyMongo
from flask_socketio import SocketIO, emit
import threading
from bson.objectid import ObjectId
import time
import subprocess
import os
import shutil
import uuid
import tempfile
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
from platformdirs import user_data_path
from werkzeug.security import generate_password_hash, check_password_hash
import traceback

app = Flask(__name__)
app.secret_key = "bi_oligo_gizemi_var"
app.config["MONGO_URI"] = "mongodb://localhost:27017/oligo_db"
mongo = PyMongo(app)
CORS(app,supports_credentials=True)
login_manager = LoginManager()
login_manager.init_app(app)
UPLOAD_FOLDER = "uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
#socketio = SocketIO(app, cors_allowed_origins="*")  # Enable CORS for frontend connection

class User(UserMixin):
    def __init__(self, user_doc):
        self.id = str(user_doc['_id'])
        self.email = user_doc['email']

@login_manager.user_loader
def load_user(user_id):
    user_doc = mongo.db.users.find_one({'_id': ObjectId(user_id)})
    if user_doc:
        return User(user_doc)
    return None
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    user_doc = mongo.db.users.find_one({"email": email})
    if user_doc and check_password_hash(user_doc["password"], password):
        user = User(user_doc)
        login_user(user)
        return jsonify({"message": "Logged in successfully"}), 200
    return jsonify({"error": "Invalid credentials"}), 401
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    existing_user = mongo.db.users.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "User already exists"}), 409

    hashed_password = generate_password_hash(password)

    user_id = mongo.db.users.insert_one({
        "email": email,
        "password": hashed_password
    }).inserted_id

    # Convert ObjectId to string
    user_id_str = str(user_id)

    # Define the directory path
    user_dir = os.path.join(current_app.root_path, 'user_data', user_id_str)

    # Create the directory (exist_ok=True in case of race condition or retries)
    os.makedirs(user_dir, exist_ok=True)

    user_doc = mongo.db.users.find_one({"_id": user_id})
    user = User(user_doc)
    login_user(user)

    return jsonify({"message": "User registered successfully"}), 201
# Add to your Flask app.py
@app.route('/api/runs/<run_id>/files', methods=['GET'])
@login_required
def get_run_files(run_id):
    user_id = str(current_user.id)

    try:
        run = mongo.db.runs.find_one({"_id": ObjectId(run_id), "user_id": user_id})
        if not run:
            return jsonify({"error": "Run not found"}), 404

        output_dir = run['output_path']
        if run["pipeline"]=="Genomic Region Generator":
            output_gen= output_dir + "/annotation"
        files = []
        for fname in os.listdir(output_dir):
            if fname.endswith(('.yml', '.yaml', '.txt', '.log')):
                files.append({
                    "name": fname,
                    "type": "log" if "log" in fname else "config",
                    "size": os.path.getsize(os.path.join(output_dir, fname))
                })

        print(files)

        if run["pipeline"]=="Genomic Region Generator":
            for fname in os.listdir(output_gen):
                if fname.endswith(('.yml', '.yaml', '.txt', '.log','fna')):
                    files.append({
                        "name": fname,
                        "type": "log" if "log" in fname else "config",
                        "size": os.path.getsize(os.path.join(output_gen, fname))
                    })

            print(files)

        return jsonify(files), 200

    except Exception as e:
        traceback.print_exc()

        return jsonify({"error": str(e)}), 500

@app.route('/api/runs/<run_id>/files/<filename>', methods=['GET'])
@login_required
def get_run_file(run_id, filename):
    user_id = str(current_user.id)

    try:
        run = mongo.db.runs.find_one({"_id": ObjectId(run_id), "user_id": user_id})
        if not run:
            return jsonify({"error": "Run not found"}), 404

        file_path = os.path.join(run['output_path'], filename)
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        if filename.endswith(('.yml', '.yaml')):
            return send_file(file_path, as_attachment=True)
        elif filename.endswith(('.txt', '.log')):
            return send_file(file_path, mimetype='text/plain')

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
@app.route('/api/check_auth', methods=['GET'])
def check_auth():
    if current_user.is_authenticated:
        return jsonify({
            "authenticated": True,
            "user": {
                "id": str(current_user.id),
                "email": current_user.email,
            }
        })
    return jsonify({"authenticated": False}), 200
@app.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out"}), 200
def to_bool(val):
    return True if str(val).lower() == 'true' else False

    # Helper function to convert string integers to int where applicable
def to_int(val):
    try:
        return int(val)
    except ValueError:
        return val

    # Helper for optional null values
def to_null(val):
    return None if val == "" or val.lower() == "null" else val

    # Convert multiline textarea fields to lists
def multiline_to_list(val):
    # Strip leading/trailing spaces and split by newline
    lines = [line.strip() for line in val.split('\n') if line.strip()]
    return lines
def split_on_newline(s):
    if '\n' in s:
        # Split the string before and after '\n'
        result = []
        parts = s.split('\n')
        for i, part in enumerate(parts):
            if i > 0:
                result.append('\n')  # Add the newline back as its own part
            result.append(part)
        return result
    else:
        # Do nothing if '\n' is not in the string
        return [s]

@app.route('/api/upload', methods=['POST'])
def upload_file():
    print(request.files)
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Generate a unique filename using UUID
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(UPLOAD_FOLDER, unique_filename)

    # Save the file
    file.save(file_path)
    return jsonify({"filePath": file_path}), 200
def run_command():
    """Simulate a long-running task and send updates via WebSocket."""
    for i in range(1, 11):  # Simulate 10 steps
        time.sleep(1)  # Simulate work
        progress = i * 10
        socketio.emit("update", {"progress": progress, "status": "running"})  # Send progress update
    socketio.emit("update", {"progress": 100, "status": "completed"})  # Send completion message
@app.route('/api/runs/<run_id>', methods=['DELETE'])
@login_required
def delete_run(run_id):
    try:
        user_id = str(current_user.id)

        run = mongo.db.runs.find_one({"_id": ObjectId(run_id), "user_id": user_id})
        if not run:
            return jsonify({"error": "Run not found"}), 404

        # Delete files
        if os.path.exists(run['output_path']):
            shutil.rmtree(run['output_path'])

        # Delete from database
        mongo.db.runs.delete_one({"_id": ObjectId(run_id)})

        return jsonify({"message": "Run deleted successfully"}), 200

    except Exception as e:
        print(f"Error deleting run: {str(e)}")
        return jsonify({"error": "Failed to delete run"}), 500
@app.route('/api/pipelines', methods=['GET'])
@login_required
def get_pipeline_runs():
    try:
        user_id = str(current_user.id)

        # Fetch runs for the authenticated user
        runs = list(mongo.db.runs.find({"user_id": user_id}))

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
@app.route('/api/scrinshot', methods=['POST'])
def scrinshot():
    user_dir=''
    if current_user.is_authenticated:
        print('yes authenticated')
        user_id = str(current_user.id)
        user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
        config_path = os.path.join(user_dir,'config.yaml')
    else:
        print('no not')
    #thread = threading.Thread(target=run_command)  # Run task in a separate thread
    #thread.start()

    form_data = request.json  # Assuming JSON is posted from React
    print(form_data['file_regions'])

    # Build the nested config structure:
    if ".txt" not in form_data["file_regions"]['value']:
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
            file_path = temp_file.name
            # Write each gene on a new line
            temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"]['value'].split(","))
        print(f"File created: {file_path}")
        with open(file_path, "r") as f:
            print("File content:")
            print(f.read())

        form_data["file_regions"]['value']=file_path
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    output_path = os.path.join(user_dir, f'output_scrinshot_probe_designer_{timestamp}')

    run_doc = {
        "user_id": user_id,
        "timestamp": timestamp,
        "output_path": output_path,
        "status": "started",
        "pipeline": 'scrinshot'
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    run_id = run_result.inserted_id


    config = {
        "n_jobs": to_int(form_data["n_jobs"]['value']),
        "dir_output": output_path,
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]['value']),
        "top_n_sets": to_int(form_data["top_n_sets"]['value']),
        # Probe sequences generation
        "file_regions": form_data["file_regions"]['value'],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]['value']),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_target_probe"]['value']),
        "target_probe_length_min": to_int(form_data["target_probe_length_min"]['value']),
        "target_probe_length_max": to_int(form_data["target_probe_length_max"]['value']),
        "target_probe_isoform_consensus": to_int(form_data["target_probe_isoform_consensus"]['value']),

        # Property filters
        "target_probe_GC_content_min": to_int(form_data["target_probe_GC_content_min"]['value']),
        "target_probe_GC_content_opt": to_int(form_data["target_probe_GC_content_opt"]['value']),
        "target_probe_GC_content_max": to_int(form_data["target_probe_GC_content_max"]['value']),
        "target_probe_Tm_min": to_int(form_data["target_probe_Tm_min"]['value']),
        "target_probe_Tm_opt": to_int(form_data["target_probe_Tm_opt"]['value']),

        "target_probe_Tm_max": to_int(form_data["target_probe_Tm_max"]['value']),
        "target_probe_homopolymeric_base_n": {
            "A": to_int(form_data["target_probe_homopolymeric_base_n"]['A']['value']),
            "T": to_int(form_data["target_probe_homopolymeric_base_n"]['T']['value']),
            "C": to_int(form_data["target_probe_homopolymeric_base_n"]['C']['value']),
            "G": to_int(form_data["target_probe_homopolymeric_base_n"]['G']['value'])
        },

        # Padlock arms
        "target_probe_padlock_arm_Tm_dif_max": to_int(form_data["target_probe_padlock_arm_Tm_dif_max"]['value']),
        "target_probe_padlock_arm_length_min": to_int(form_data["target_probe_padlock_arm_length_min"]['value']),
        "target_probe_padlock_arm_Tm_min": to_int(form_data["target_probe_padlock_arm_Tm_min"]['value']),
        "target_probe_padlock_arm_Tm_max": to_int(form_data["target_probe_padlock_arm_Tm_max"]['value']),

        # Detection oligos
        "detection_oligo_min_thymines": to_int(form_data["detection_oligo_min_thymines"]['value']),
        "detection_oligo_length_min": to_int(form_data["detection_oligo_length_min"]['value']),
        "detection_oligo_length_max": to_int(form_data["detection_oligo_length_max"]['value']),

        # Specificity filters
        "target_probe_ligation_region_size": to_int(form_data["target_probe_ligation_region_size"]['value']),

        # Set selection parameters
        "target_probe_isoform_weight": to_int(form_data["target_probe_isoform_weight"]['value']),
        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]['value']),
        "target_probe_Tm_weight": to_int(form_data["target_probe_Tm_weight"]['value']),
        "set_size_min": to_int(form_data["set_size_min"]['value']),
        "set_size_opt": to_int(form_data["set_size_opt"]['value']),
        "distance_between_target_probes": to_int(form_data["distance_between_target_probes"]['value']),
        "n_sets": to_int(form_data["n_sets"]['value']),

        # Final sequence design
        "detection_oligo_U_distance": to_int(form_data["detection_oligo_U_distance"]['value']),
        "detection_oligo_Tm_opt": to_int(form_data["detection_oligo_Tm_opt"]['value']),

        # Developer parameters
        "target_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["target_probe_specificity_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["target_probe_specificity_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["target_probe_specificity_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['max_hsps']['value'])
        },
        "target_probe_specificity_blastn_hit_parameters": {
            "coverage": to_int(form_data["target_probe_specificity_blastn_hit_parameters"]['coverage']['value'])
        },

        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['max_target_seqs']['value'])
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "coverage": to_int(form_data["target_probe_cross_hybridization_blastn_hit_parameters"]['coverage']['value'])
        },

        "max_graph_size": to_int(form_data["max_graph_size"]['value']),
        "n_attempts": to_int(form_data["n_attempts"]['value']),
        "heuristic": to_bool(form_data["heuristic"]['value']),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]['value']),

        # Melting Temperature Parameters
        "target_probe_Tm_parameters": {
            "nn_table": form_data["target_probe_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["target_probe_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["target_probe_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["target_probe_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["target_probe_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["target_probe_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["target_probe_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["target_probe_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["target_probe_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["target_probe_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["target_probe_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["target_probe_Tm_parameters"]['dNTPs']['value'])
        },

        "target_probe_Tm_chem_correction_parameters": {
            "DMSO": to_int(form_data["target_probe_Tm_chem_correction_parameters"]['DMSO']['value']),
            "fmd": to_int(form_data["target_probe_Tm_chem_correction_parameters"]['fmd']['value']),
            "DMSOfactor": float(form_data["target_probe_Tm_chem_correction_parameters"]['DMSOfactor']['value']),
            "fmdfactor": float(form_data["target_probe_Tm_chem_correction_parameters"]['fmdfactor']['value']),
            "fmdmethod": to_int(form_data["target_probe_Tm_chem_correction_parameters"]['fmdmethod']['value']),
            "GC": to_null(form_data["target_probe_Tm_chem_correction_parameters"]['GC']['value'])
        },
        # If Tm_salt_correction_param_probe is null, we just omit it or set it to None
        "target_probe_Tm_salt_correction_param_probe": None,

        "detection_oligo_Tm_parameters": {
            "nn_table": form_data["detection_oligo_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["detection_oligo_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["detection_oligo_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["detection_oligo_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["detection_oligo_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["detection_oligo_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["detection_oligo_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["detection_oligo_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["detection_oligo_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["detection_oligo_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["detection_oligo_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["detection_oligo_Tm_parameters"]['dNTPs']['value'])
        },
        "detection_oligo_Tm_chem_correction_parameters": {
            "DMSO": to_int(form_data["detection_oligo_Tm_chem_correction_parameters"]['DMSO']['value']),
            "fmd": to_int(form_data["detection_oligo_Tm_chem_correction_parameters"]['fmd']['value']),
            "DMSOfactor": float(form_data["detection_oligo_Tm_chem_correction_parameters"]['DMSOfactor']['value']),
            "fmdfactor": float(form_data["detection_oligo_Tm_chem_correction_parameters"]['fmdfactor']['value']),
            "fmdmethod": to_int(form_data["detection_oligo_Tm_chem_correction_parameters"]['fmdmethod']['value']),
            "GC": to_null(form_data["detection_oligo_Tm_chem_correction_parameters"]['GC']['value'])
        },
        "detection_oligo_Tm_salt_correction_parameters": None,
        "target_probe_Tm_salt_correction_parameters": None,

    }


    # Write the YAML file
    with open(config_path, "w") as f:
        yaml.dump(config, f, sort_keys=False)

    result = subprocess.run(
                ['scrinshot_probe_designer', '-c', config_path],
                capture_output=True,
                text=True
            )
    if os.path.exists(form_data['file_regions']['value']):
        print('deleted')
        os.remove(form_data['file_regions']['value'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database']['value'])

    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_target_probe']['value'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)



    mongo.db.runs.update_one(
        {"_id": run_id},
        {"$set": {"status": "completed"}}
    )

    return jsonify({
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            })
@app.route('/api/merfish', methods=['POST'])
def merfish():
    user_dir=''
    if current_user.is_authenticated:
        print('yes authenticated')
        user_id = str(current_user.id)
        user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
        config_path = os.path.join(user_dir,  "config_merfish.yaml")
    else:
        print('no not')
    #thread = threading.Thread(target=run_command)  # Run task in a separate thread
    #thread.start()

    form_data = request.json  # Assuming JSON is posted from React
    print(form_data['file_regions'])
    if ".txt" not in form_data["file_regions"]['value']:
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
            file_path = temp_file.name
            # Write each gene on a new line
            temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"]['value'].split(","))
        print(f"File created: {file_path}")
        with open(file_path, "r") as f:
            print("File content:")
            print(f.read())

        form_data["file_regions"]['value']=file_path
    # Build the nested config structure:
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    output_path = os.path.join(user_dir, f'output_merfish_probe_designer_{timestamp}')

    run_doc = {
        "user_id": user_id,
        "timestamp": timestamp,
        "output_path": output_path,
        "status": "started",
        "pipeline": 'merfish'
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    run_id = run_result.inserted_id
    print(form_data["files_fasta_reference_database_target_probe"]['value'])
    config = {
        "n_jobs": to_int(form_data["n_jobs"]['value']),
        "dir_output":output_path,
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]['value']),
        "top_n_sets": to_int(form_data["top_n_sets"]['value']),
        # Probe sequences generation
        "file_regions": form_data["file_regions"]['value'],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]['value']),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_target_probe"]['value']),
        "target_probe_length_min": to_int(form_data["target_probe_length_min"]['value']),
        "target_probe_length_max": to_int(form_data["target_probe_length_max"]['value']),
        "target_probe_isoform_consensus": to_int(form_data["target_probe_isoform_consensus"]['value']),


        # Property filters
        "target_probe_GC_content_min": to_int(form_data["target_probe_GC_content_min"]['value']),
        "target_probe_GC_content_opt": to_int(form_data["target_probe_GC_content_opt"]['value']),
        "target_probe_GC_content_max": to_int(form_data["target_probe_GC_content_max"]['value']),
        "target_probe_Tm_min": to_int(form_data["target_probe_Tm_min"]['value']),
        "target_probe_Tm_max": to_int(form_data["target_probe_Tm_max"]['value']),
        "target_probe_homopolymeric_base_n": {
            "A": to_int(form_data["target_probe_homopolymeric_base_n"]['A']['value']),
            "T": to_int(form_data["target_probe_homopolymeric_base_n"]['T']['value']),
            "C": to_int(form_data["target_probe_homopolymeric_base_n"]['C']['value']),
            "G": to_int(form_data["target_probe_homopolymeric_base_n"]['G']['value'])
        },

        "target_probe_T_secondary_structure": to_int(form_data["target_probe_T_secondary_structure"]['value']),
        "target_probe_secondary_structures_threshold_deltaG": to_int(form_data["target_probe_secondary_structures_threshold_deltaG"]['value']),

        # Set selection parameters
        "target_probe_isoform_weight": to_int(form_data["target_probe_isoform_weight"]['value']),
        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]['value']),
        "target_probe_Tm_weight": to_int(form_data["target_probe_Tm_weight"]['value']),
        "set_size_min": to_int(form_data["set_size_min"]['value']),
        "set_size_opt": to_int(form_data["set_size_opt"]['value']),
        "distance_between_target_probes": to_int(form_data["distance_between_target_probes"]['value']),
        "n_sets": to_int(form_data["n_sets"]['value']),


        "files_fasta_reference_database_readout_probe": multiline_to_list(form_data["files_fasta_reference_database_readout_probe"]['value']),
        "readout_probe_base_probabilities": {
            "A": to_int(form_data["readout_probe_base_probabilities"]['A']['value']),
            "T": to_int(form_data["readout_probe_base_probabilities"]['T']['value']),
            "C": to_int(form_data["readout_probe_base_probabilities"]['C']['value']),
            "G": to_int(form_data["readout_probe_base_probabilities"]['G']['value'])
        },
        "readout_probe_length": float(form_data["readout_probe_length"]['value']),
        "readout_probe_GC_content_min": to_int(form_data["readout_probe_GC_content_min"]['value']),
        "readout_probe_GC_content_max": to_int(form_data["readout_probe_GC_content_max"]['value']),
        "readout_probe_homopolymeric_base_n": {"G":to_int(form_data["readout_probe_homopolymeric_base_n"]['G']['value']),},
        "readout_probe_set_size": to_int(form_data["readout_probe_set_size"]['value']),
        "readout_probe_homogeneous_properties_weights":{
           "TmNN": to_int(form_data["readout_probe_homogeneous_properties_weights"]["TmNN"]["value"]),
            "GC_content": to_int(form_data["readout_probe_homogeneous_properties_weights"]["GC_content"]["value"]),
        } ,
        "n_bits": to_int(form_data["n_bits"]['value']),
        "min_hamming_dist": to_int(form_data["min_hamming_dist"]['value']),
        "hamming_weight": to_int(form_data["hamming_weight"]['value']),
        "channels_ids": form_data["channels_ids"]['value'],

        #PRIMER PARAMETERS

        "files_fasta_reference_database_primer": multiline_to_list(form_data["files_fasta_reference_database_primer"]['value']),
        "reverse_primer_sequence": form_data["reverse_primer_sequence"]['value'],
        "primer_length": to_int(form_data["primer_length"]['value']),
        "primer_GC_content_min": to_int(form_data["primer_GC_content_min"]['value']),
        "primer_GC_content_max": to_int(form_data["primer_GC_content_max"]['value']),
        "primer_number_GC_GCclamp": to_int(form_data["primer_number_GC_GCclamp"]['value']),
        "primer_number_three_prime_base_GCclamp": to_int(form_data["primer_number_three_prime_base_GCclamp"]['value']),
        "primer_homopolymeric_base_n": {
            "A": to_int(form_data["primer_homopolymeric_base_n"]['A']['value']),
            "T": to_int(form_data["primer_homopolymeric_base_n"]['T']['value']),
            "C": to_int(form_data["primer_homopolymeric_base_n"]['C']['value']),
            "G": to_int(form_data["primer_homopolymeric_base_n"]['G']['value'])
        },

        "primer_max_len_selfcomplement": to_int(form_data["primer_max_len_selfcomplement"]['value']),
        "primer_max_len_complement_reverse_primer": to_int(form_data["primer_max_len_complement_reverse_primer"]['value']),
        "primer_Tm_min": to_int(form_data["primer_Tm_min"]['value']),
        "primer_Tm_max": to_int(form_data["primer_Tm_max"]['value']),
        "primer_T_secondary_structure": to_int(form_data["primer_T_secondary_structure"]['value']),
        "primer_secondary_structures_threshold_deltaG": to_int(form_data["primer_secondary_structures_threshold_deltaG"]['value']),

        # Developer parameters
        "target_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["target_probe_specificity_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["target_probe_specificity_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["target_probe_specificity_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['max_hsps']['value'])
        },
        "target_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_specificity_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['max_target_seqs']['value'])
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_cross_hybridization_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "max_graph_size": to_int(form_data["max_graph_size"]['value']),
        "n_attempts": to_int(form_data["n_attempts"]['value']),
        "heuristic": to_bool(form_data["heuristic"]['value']),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]['value']),
        "target_probe_Tm_opt": to_int(form_data["target_probe_Tm_opt"]['value']),


        # Melting Temperature Parameters
        "target_probe_Tm_parameters": {
            "nn_table": form_data["target_probe_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["target_probe_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["target_probe_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["target_probe_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["target_probe_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["target_probe_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["target_probe_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["target_probe_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["target_probe_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["target_probe_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["target_probe_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["target_probe_Tm_parameters"]['dNTPs']['value'])
        },

        "target_probe_Tm_chem_correction_param_probe": None,
        # If Tm_salt_correction_param_probe is null, we just omit it or set it to None
        "target_probe_Tm_salt_correction_param_probe": None,
        #READOUT PROBE PARAMETERS
        "readout_probe_initial_num_sequences": to_int(form_data["readout_probe_initial_num_sequences"]['value']),
        "readout_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["readout_probe_specificity_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["readout_probe_specificity_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["readout_probe_specificity_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['max_hsps']['value'])
        },
        "readout_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_specificity_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "readout_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['max_target_seqs']['value']),
        },
        "readout_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_cross_hybridization_blastn_hit_parameters"]['min_alignment_length']['value'])
        },
        "readout_probe_Tm_parameters": {
            "nn_table": form_data["readout_probe_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["readout_probe_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["readout_probe_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["readout_probe_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["readout_probe_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["readout_probe_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["readout_probe_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["readout_probe_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["readout_probe_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["readout_probe_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["readout_probe_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["readout_probe_Tm_parameters"]['dNTPs']['value'])
        },

        "readout_probe_Tm_chem_correction_parameters": None,
        "readout_probe_Tm_salt_correction_parameters": None,
        "readout_probe_n_combinations": to_int(form_data["readout_probe_n_combinations"]['value']),
        #PRIMER PARAMETERS

        "primer_initial_num_sequences": to_int(form_data["primer_initial_num_sequences"]['value']),

        "primer_specificity_refrence_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["primer_specificity_refrence_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["primer_specificity_refrence_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["primer_specificity_refrence_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['max_hsps']['value'])
        },
        "primer_specificity_refrence_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_refrence_blastn_hit_parameters"]['min_alignment_length']['value'])
        },
        "primer_specificity_encoding_probes_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['max_hsps']['value'])
        },
        "primer_specificity_encoding_probes_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_encoding_probes_blastn_hit_parameters"]['min_alignment_length']['value'])
        },
        "primer_Tm_parameters": {
            "nn_table": form_data["primer_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["primer_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["primer_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["primer_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["primer_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["primer_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["primer_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["primer_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["primer_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["primer_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["primer_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["primer_Tm_parameters"]['dNTPs']['value'])
        },
        "primer_Tm_chem_correction_parameters": None,
        "primer_Tm_salt_correction_parameters": None,
        "target_probe_Tm_chem_correction_parameters":None,
        "target_probe_Tm_salt_correction_parameters": None,



    }


    # Write the YAML file
    with open(config_path, "w") as f:
        yaml.dump(config, f, sort_keys=False)

    result = subprocess.run(
        ['merfish_probe_designer', '-c', config_path],
        capture_output=True,
        text=True
    )
    print(result)

    if os.path.exists(form_data['file_regions']['value']):
        print('deleted')
        os.remove(form_data['file_regions']['value'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database']['value'])
    print(a,"I am A")

    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_target_probe']['value'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_readout_probe']['value'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_primer']['value'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)

    mongo.db.runs.update_one(
        {"_id": run_id},
        {"$set": {"status": "completed"}}
    )

    return jsonify({
        'stdout': result.stdout,
        'stderr': result.stderr,
        'returncode': result.returncode
    })

@app.route('/api/seqfish', methods=['POST'])
def seqfish():
    user_dir=''
    if current_user.is_authenticated:
        print('yes authenticated')
        user_id = str(current_user.id)
        user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
        config_path = os.path.join(user_dir,  "config_seqfish.yaml")
    else:
        print('no not')
    #thread = threading.Thread(target=run_command)  # Run task in a separate thread
    #thread.start()

    form_data = request.json  # Assuming JSON is posted from React
    if ".txt" not in form_data["file_regions"]['value']:
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
            file_path = temp_file.name
            # Write each gene on a new line
            temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"]['value'].split(","))
        print(f"File created: {file_path}")
        with open(file_path, "r") as f:
            print("File content:")
            print(f.read())

        form_data["file_regions"]['value']=file_path
    # Build the nested config structure:
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    output_path = os.path.join(user_dir, f'output_seqfish_probe_designer_{timestamp}')

    run_doc = {
        "user_id": user_id,
        "timestamp": timestamp,
        "output_path": output_path,
        "status": "started",
        "pipeline": 'seqfish'
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    run_id = run_result.inserted_id
    print(form_data["files_fasta_reference_database_targe_probe"]['value'])
    config = {
        "n_jobs": to_int(form_data["n_jobs"]['value']),
        "dir_output": output_path,
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]['value']),
        "top_n_sets": to_int(form_data["top_n_sets"]['value']),
        # Probe sequences generation
        "file_regions": form_data["file_regions"]['value'],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]['value']),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_targe_probe"]['value']),
        "target_probe_length_min": to_int(form_data["target_probe_length_min"]['value']),
        "target_probe_length_max": to_int(form_data["target_probe_length_max"]['value']),
        "target_probe_isoform_consensus": to_int(form_data["target_probe_isoform_consensus"]['value']),
        "target_probe_GC_content_min": to_int(form_data["target_probe_GC_content_min"]['value']),
        "target_probe_GC_content_opt": to_int(form_data["target_probe_GC_content_opt"]['value']),
        "target_probe_GC_content_max": to_int(form_data["target_probe_GC_content_max"]['value']),


        "target_probe_T_secondary_structure": to_int(form_data["target_probe_T_secondary_structure"]['value']),
        "target_probe_secondary_structures_threshold_deltaG": to_int(form_data["target_probe_secondary_structures_threshold_deltaG"]['value']),
        "target_probe_homopolymeric_base_n": {
            "A": to_int(form_data["target_probe_homopolymeric_base_n"]['A']['value']),
            "T": to_int(form_data["target_probe_homopolymeric_base_n"]['T']['value']),
            "C": to_int(form_data["target_probe_homopolymeric_base_n"]['C']['value']),
            "G": to_int(form_data["target_probe_homopolymeric_base_n"]['G']['value'])
        },
        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]['value']),


        "target_probe_UTR_weight": to_int(form_data["target_probe_UTR_weight"]['value']),

        "set_size_min": to_int(form_data["set_size_min"]['value']),
        "set_size_opt": to_int(form_data["set_size_opt"]['value']),
        "distance_between_target_probes": to_int(form_data["distance_between_target_probes"]['value']),
        "n_sets": to_int(form_data["n_sets"]['value']),

        #READOUT PROBE PARAMETERS

        "files_fasta_reference_database_readout_probe": multiline_to_list(form_data["files_fasta_reference_database_readout_probe"]['value']),
        "readout_probe_base_probabilities": {
            "A": to_int(form_data["readout_probe_base_probabilities"]['A']['value']),
            "T": to_int(form_data["readout_probe_base_probabilities"]['T']['value']),
            "C": to_int(form_data["readout_probe_base_probabilities"]['C']['value']),
            "G": to_int(form_data["readout_probe_base_probabilities"]['G']['value'])
        },
        "readout_probe_length": float(form_data["readout_probe_length"]['value']),


        "readout_probe_GC_content_min": to_int(form_data["readout_probe_GC_content_min"]['value']),
        "readout_probe_GC_content_max": to_int(form_data["readout_probe_GC_content_max"]['value']),
        "readout_probe_homopolymeric_base_n": {"G":to_int(form_data["readout_probe_homopolymeric_base_n"]['G']['value']),},


        "n_barcode_rounds": to_int(form_data["n_barcode_rounds"]['value']),
        "n_pseudocolors": to_int(form_data["n_pseudocolors"]['value']),
        "channels_ids": form_data["channels_ids"]['value'],

        #PRIMER PARAMETERS
        "files_fasta_reference_database_primer": multiline_to_list(form_data["files_fasta_reference_database_primer"]['value']),
        "reverse_primer_sequence": form_data["reverse_primer_sequence"]['value'],
        "primer_length": to_int(form_data["primer_length"]['value']),
        "primer_base_probabilities": {
            "A": to_int(form_data["primer_base_probabilities"]['A']['value']),
            "T": to_int(form_data["primer_base_probabilities"]['T']['value']),
            "C": to_int(form_data["primer_base_probabilities"]['C']['value']),
            "G": to_int(form_data["primer_base_probabilities"]['G']['value'])
        },
        "primer_GC_content_min": to_int(form_data["primer_GC_content_min"]['value']),
        "primer_GC_content_max": to_int(form_data["primer_GC_content_max"]['value']),
        "primer_number_GC_GCclamp": to_int(form_data["primer_number_GC_GCclamp"]['value']),
        "primer_number_three_prime_base_GCclamp": to_int(form_data["primer_number_three_prime_base_GCclamp"]['value']),
        "primer_homopolymeric_base_n": {
            "A": to_int(form_data["primer_homopolymeric_base_n"]['A']['value']),
            "T": to_int(form_data["primer_homopolymeric_base_n"]['T']['value']),
            "C": to_int(form_data["primer_homopolymeric_base_n"]['C']['value']),
            "G": to_int(form_data["primer_homopolymeric_base_n"]['G']['value'])
        },
        "primer_max_len_selfcomplement": to_int(form_data["primer_max_len_selfcomplement"]['value']),
        "primer_max_len_complement_reverse_primer": to_int(form_data["primer_max_len_complement_reverse_primer"]['value']),
        "primer_Tm_min": to_int(form_data["primer_Tm_min"]['value']),
        "primer_Tm_max": to_int(form_data["primer_Tm_max"]['value']),
        "primer_T_secondary_structure": to_int(form_data["primer_T_secondary_structure"]['value']),
        "primer_secondary_structures_threshold_deltaG": to_int(form_data["primer_secondary_structures_threshold_deltaG"]['value']),

        # Developer parameters
        "target_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["target_probe_specificity_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["target_probe_specificity_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["target_probe_specificity_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["target_probe_specificity_blastn_search_parameters"]['max_hsps']['value'])
        },
        "target_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_specificity_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["target_probe_cross_hybridization_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]['max_target_seqs']['value'])
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["target_probe_cross_hybridization_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "max_graph_size": to_int(form_data["max_graph_size"]['value']),
        "n_attempts": to_int(form_data["n_attempts"]['value']),
        "heuristic": to_bool(form_data["heuristic"]['value']),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]['value']),

        #READOUT PROBE PARAMETERS
        "readout_probe_initial_num_sequences": to_int(form_data["readout_probe_initial_num_sequences"]['value']),
        "readout_probe_specificity_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["readout_probe_specificity_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["readout_probe_specificity_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["readout_probe_specificity_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["readout_probe_specificity_blastn_search_parameters"]['max_hsps']['value'])
        },
        "readout_probe_specificity_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_specificity_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        "readout_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["readout_probe_cross_hybridization_blastn_search_parameters"]['max_target_seqs']['value']),
        },
        "readout_probe_cross_hybridization_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["readout_probe_cross_hybridization_blastn_hit_parameters"]['min_alignment_length']['value'])
        },

        #PRIMER PARAMETERS
        "primer_initial_num_sequences": to_int(form_data["primer_initial_num_sequences"]['value']),

        "primer_specificity_refrence_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["primer_specificity_refrence_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["primer_specificity_refrence_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["primer_specificity_refrence_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["primer_specificity_refrence_blastn_search_parameters"]['max_hsps']['value'])
        },
        "primer_specificity_refrence_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_refrence_blastn_hit_parameters"]['min_alignment_length']['value'])
        },
        "primer_specificity_encoding_probes_blastn_search_parameters": {
            "perc_identity": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['perc_identity']['value']),
            "strand": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['strand']['value'],
            "word_size": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['word_size']['value']),
            "dust": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['dust']['value'],
            "soft_masking": form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['soft_masking']['value'],
            "max_target_seqs": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['max_target_seqs']['value']),
            "max_hsps": to_int(form_data["primer_specificity_encoding_probes_blastn_search_parameters"]['max_hsps']['value'])
        },
        "primer_specificity_encoding_probes_blastn_hit_parameters": {
            "min_alignment_length": to_int(form_data["primer_specificity_encoding_probes_blastn_hit_parameters"]['min_alignment_length']['value'])
        },
        "primer_Tm_parameters": {
            "nn_table": form_data["primer_Tm_parameters"]['nn_table']['value'],
            "tmm_table": form_data["primer_Tm_parameters"]['tmm_table']['value'],
            "imm_table": form_data["primer_Tm_parameters"]['imm_table']['value'],
            "de_table": form_data["primer_Tm_parameters"]['de_table']['value'],
            "dnac1": to_int(form_data["primer_Tm_parameters"]['dnac1']['value']),
            "dnac2": to_int(form_data["primer_Tm_parameters"]['dnac2']['value']),
            "saltcorr": to_int(form_data["primer_Tm_parameters"]['saltcorr']['value']),
            "Na": to_int(form_data["primer_Tm_parameters"]['Na']['value']),
            "K": to_int(form_data["primer_Tm_parameters"]['K']['value']),
            "Tris": to_int(form_data["primer_Tm_parameters"]['Tris']['value']),
            "Mg": to_int(form_data["primer_Tm_parameters"]['Mg']['value']),
            "dNTPs": to_int(form_data["primer_Tm_parameters"]['dNTPs']['value'])
        },
        "primer_Tm_chem_correction_parameters": None,
        "primer_Tm_salt_correction_parameters": None
    }

    # Write the YAML file
    with open(config_path, "w") as f:
        yaml.dump(config, f, sort_keys=False)

    result = subprocess.run(
        ['seqfish_plus_probe_designer', '-c', config_path],
        capture_output=True,
        text=True
    )

    if os.path.exists(form_data['file_regions']['value']):
        print('deleted')
        os.remove(form_data['file_regions']['value'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database']['value'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_targe_probe']['value'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)

    mongo.db.runs.update_one(
        {"_id": run_id},
        {"$set": {"status": "completed"}}
    )

    return jsonify({
        'stdout': result.stdout,
        'stderr': result.stderr,
        'returncode': result.returncode
    })


@app.route('/api/genomic/ncbi', methods=['POST'])
def genomic_ncbi():

    try:
        # Define the path for the configuration file

        user_dir=''
        if current_user.is_authenticated:
            print('yes authenticated')
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            config_path = os.path.join(user_dir,  "config_genomic_ncbi.yaml")
        else:
            print('no not')
        config_genomic = {}

        # Parse JSON data from the request
        form_data = request.json
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_genomic_ncbi_{timestamp}')

        run_doc = {
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": output_path,
            "status": "started",
            "pipeline": 'Genomic Region Generator'
        }
        run_result = mongo.db.runs.insert_one(run_doc)
        run_id = run_result.inserted_id

        # Populate the config_genomic dictionary based on the received data
        config_genomic['dir_output'] = output_path
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'taxon' : form_data['source_params']['taxon']['value'],
            'species' : form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['utr']['value']),
            'cds': to_bool(form_data['genomic_regions']['cds']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

        # Write the dictionary to a YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        try:
            # Run the genomic region generator
            result = subprocess.run(
                ['genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )


            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": "completed"}}
            )


            # Check if the process was successful
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

            # Get the output file path



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

@app.route('/api/genomic/ensembl', methods=['POST'])
def genomic_ensemble():

    try:
        # Define the path for the configuration file
        user_dir=''
        if current_user.is_authenticated:
            print('yes authenticated')
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            config_path = os.path.join(user_dir,  "config_genomic_ensemble.yaml")
        else:
            print('no not')
        config_genomic = {}

        # Parse JSON data from the request

        # Populate the config_genomic dictionary based on the received data
        form_data = request.json
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_genomic_ensemble_{timestamp}')
        print(output_path)

        run_doc = {
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": output_path,
            "status": "started",
            "pipeline": 'Genomic Region Generator'
        }
        run_result = mongo.db.runs.insert_one(run_doc)
        run_id = run_result.inserted_id
        config_genomic['dir_output'] = output_path

        # Populate the config_genomic dictionary based on the received data
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'species' : form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['utr']['value']),
            'cds': to_bool(form_data['genomic_regions']['cds']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

        # Write the dictionary to a YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        # If you need to run a subprocess based on this configuration, do so here
        try:
            result = subprocess.run(
                ['genomic_region_generator','-c', config_path],
                capture_output=True,
                text=True
            )

            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": "completed"}}
            )
            # Return success response
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

        # Handle errors
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500
@app.route('/api/genomic/custom', methods=['POST'])
def genomic_custom():

    try:
        # Define the path for the configuration file
        user_dir=''
        if current_user.is_authenticated:
            print('yes authenticated')
            user_id = str(current_user.id)
            user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
            config_path = os.path.join(user_dir,  "config_genomic_custom.yaml")
        else:
            print('no not')
        config_genomic = {}
        form_data = request.json
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        output_path = os.path.join(user_dir, f'output_genomic_custom_{timestamp}')
        print(output_path)

        run_doc = {
            "user_id": user_id,
            "timestamp": timestamp,
            "output_path": output_path,
            "status": "started",
            "pipeline": 'Genomic Region Generator'
        }
        run_result = mongo.db.runs.insert_one(run_doc)
        run_id = run_result.inserted_id

        # Populate the config_genomic dictionary based on the received data
        config_genomic['dir_output'] = output_path
        config_genomic['source'] = form_data['source']['value']
        config_genomic['source_params'] = {
            'file_annotation': form_data['source_params']['file_annotation']['value'],
            'file_sequence': form_data['source_params']['file_sequence']['value'],
            'file_source': form_data['source_params']['file_source']['value'],
            'species' : form_data['source_params']['species']['value'],
            'annotation_release': to_int(form_data['source_params']['annotation_release']['value']),
            'genome_assembly': form_data['source_params']['genome_assembly']['value'],
        }
        config_genomic['genomic_regions'] =  {
            'gene': to_bool(form_data['genomic_regions']['gene']['value']),
            'intergenic': to_bool(form_data['genomic_regions']['intergenic']['value']),
            'exon': to_bool(form_data['genomic_regions']['exon']['value']),
            'exon_exon_junction': to_bool(form_data['genomic_regions']['exon_exon_junction']['value']),
            'utr': to_bool(form_data['genomic_regions']['UTR']['value']),
            'cds': to_bool(form_data['genomic_regions']['CDS']['value']),
            'intron': to_bool(form_data['genomic_regions']['intron']['value'])
        }
        config_genomic['exon_exon_junction_block_size'] = to_int(form_data['exon_exon_junction_block_size']['value'])

        # Write the dictionary to a YAML file
        with open(config_path, 'w') as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        # If you need to run a subprocess based on this configuration, do so here
        try:
            print('try to run ')
            result = subprocess.run(
                ['conda', 'run', '-n', 'odt', 'genomic_region_generator', '-c', config_path],
                capture_output=True,
                text=True
            )
            if os.path.exists(form_data['file_sequence']['value']):
                os.remove(form_data['file_sequence']['value'])
                os.remove(form_data['file_sequence']['value']+'.fai')
            if os.path.exists(form_data['file_annotation']['value']):
                os.remove(form_data['file_annotation']['value'])  # Delete the file# Delete the file
            # Return success response
            mongo.db.runs.update_one(
                {"_id": run_id},
                {"$set": {"status": "completed"}}
            )
            return jsonify({
                "status": "success",
                "message": "Genomic processing completed successfully.",
                "output": result.stdout
            }), 200

        except subprocess.CalledProcessError as e:
            print('subprocess failed')
            if os.path.exists(form_data['file_sequence']['value']):
                os.remove(form_data['file_sequence']['value'])
                os.remove(form_data['file_sequence']['value']+'.fai')
            if os.path.exists(form_data['file_annotation']['value']):
                os.remove(form_data['file_annotation']['value'])
            return jsonify({
                "status": "error",
                "message": "An error occurred during genomic processing.",
                "error": e.stderr
            }), 500



    except Exception as e:
        print('error without the subprocess')

        # Handle errors
        return jsonify({
            "status": "error",
            "message": "An error occurred.",
            "error": str(e)
        }), 500
@app.route('/api/oligoseq', methods=['POST'])
def oligoseq():
    user_dir=''
    if current_user.is_authenticated:
        print('yes authenticated')
        user_id = str(current_user.id)
        user_dir = os.path.join(current_app.root_path, 'user_data', user_id)
        config_path = os.path.join(user_dir,  "config_oligoseq.yaml")
    else:
        print('no not')
    #thread = threading.Thread(target=run_command)  # Run task in a separate thread
    #thread.start()

    form_data = request.json  # Assuming JSON is posted from React

    if ".txt" not in form_data["file_regions"]['value']:
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".txt") as temp_file:
            file_path = temp_file.name
            # Write each gene on a new line
            temp_file.writelines(gene.strip() + "\n" for gene in form_data["file_regions"]['value'].split(","))
        print(f"File created: {file_path}")
        with open(file_path, "r") as f:
            print("File content:")
            print(f.read())

        form_data["file_regions"]['value']=file_path
    # Build the nested config structure:
    print(form_data["file_regions"]['value'])

    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    output_path = os.path.join(user_dir, f'output_oligoseq_probe_designer_{timestamp}')

    run_doc = {
        "user_id": user_id,
        "timestamp": timestamp,
        "output_path": output_path,
        "status": "started",
        "pipeline": 'oligoseq'
    }
    run_result = mongo.db.runs.insert_one(run_doc)
    run_id = run_result.inserted_id
    config = {
        "n_jobs": to_int(form_data["n_jobs"]['value']),
        "dir_output":output_path,
        "write_intermediate_steps": to_bool(form_data["write_intermediate_steps"]['value']),
        "top_n_sets": to_int(form_data["top_n_sets"]['value']),
        # Probe sequences generation
        "file_regions": form_data["file_regions"]['value'],
        "files_fasta_target_probe_database": multiline_to_list(form_data["files_fasta_target_probe_database"]['value']),
        "files_fasta_reference_database_target_probe": multiline_to_list(form_data["files_fasta_reference_database_targe_probe"]['value']),
        "target_probe_length_min": to_int(form_data["target_probe_length_min"]['value']),
        "target_probe_length_max": to_int(form_data["target_probe_length_max"]['value']),
        "target_probe_split_region": to_int(form_data["target_probe_split_region"]['value']),
        "target_probe_targeted_exons": int(form_data["target_probe_targeted_exons"]['value']),
        "target_probe_isoform_consensus": to_int(form_data["target_probe_isoform_consensus"]['value']),

        # Property filters
        "target_probe_GC_content_min": to_int(form_data["target_probe_GC_content_min"]['value']),
        "target_probe_GC_content_opt": to_int(form_data["target_probe_GC_content_opt"]['value']),
        "target_probe_GC_content_max": to_int(form_data["target_probe_GC_content_max"]['value']),
        "target_probe_Tm_min": to_int(form_data["target_probe_Tm_min"]['value']),
        "target_probe_Tm_opt": to_int(form_data["target_probe_Tm_opt"]['value']),
        "target_probe_Tm_max": to_int(form_data["target_probe_Tm_max"]['value']),
        "target_probe_secondary_structures_T": to_int(form_data["target_probe_secondary_structures_T"]['value']),
        "target_probe_secondary_structures_threshold_deltaG": to_int(form_data["target_probe_secondary_structures_threshold_deltaG"]['value']),
        "target_probe_homopolymeric_base_n": {
            "A": to_int(form_data["target_probe_homopolymeric_base_n"]['A']['value']),
            "T": to_int(form_data["target_probe_homopolymeric_base_n"]['T']['value']),
            "C": to_int(form_data["target_probe_homopolymeric_base_n"]['C']['value']),
            "G": to_int(form_data["target_probe_homopolymeric_base_n"]['G']['value'])
        },
        "target_probe_max_len_selfcomplement": to_int(form_data["target_probe_max_len_selfcomplement"]['value']),
        "target_probe_hybridization_probability_threshold": float(form_data["target_probe_hybridization_probability_threshold"]['value']),


        "target_probe_GC_weight": to_int(form_data["target_probe_GC_weight"]['value']),
        "target_probe_Tm_weight": to_int(form_data["target_probe_Tm_weight"]['value']),


        "set_size_min": to_int(form_data["set_size_min"]['value']),
        "set_size_opt": to_int(form_data["set_size_opt"]['value']),
        "distance_between_target_probes": to_int(form_data["distance_between_target_probes"]['value']),
        "n_sets": to_int(form_data["n_sets"]['value']),


        # Developer parameters
        "target_probe_hybridization_probability_alignment_method" : form_data["target_probe_hybridization_probability_alignment_method"],
        "target_probe_hybridization_probability_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_hybridization_probability_blastn_search_parameters"]["perc_identity"]['value']),
            "strand": form_data["target_probe_hybridization_probability_blastn_search_parameters"]["strand"]['value'],
            "word_size": to_int(form_data["target_probe_hybridization_probability_blastn_search_parameters"]["word_size"]['value']),

        },
        "target_probe_hybridization_probability_blastn_hit_parameters": {
            "coverage": to_int(form_data["target_probe_hybridization_probability_blastn_hit_parameters"]["coverage"]['value'])
        },
        "target_probe_hybridization_probability_bowtie_search_parameters": {
            "v": to_int(form_data["target_probe_hybridization_probability_bowtie_search_parameters"]["v"]['value']),
            "-nofw": form_data["target_probe_hybridization_probability_bowtie_search_parameters"]["nofw"]['value'],

        },
        "target_probe_cross_hybridization_alignment_method" : form_data["target_probe_cross_hybridization_alignment_method"]['value'],


        "target_probe_cross_hybridization_blastn_search_parameters": {
            "perc_identity": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]["perc_identity"]['value']),
            "strand": form_data["target_probe_cross_hybridization_blastn_search_parameters"]["strand"]['value'],
            "word_size": to_int(form_data["target_probe_cross_hybridization_blastn_search_parameters"]["word_size"]['value']),
        },
        "target_probe_cross_hybridization_blastn_hit_parameters": {
            "coverage": to_int(form_data["target_probe_cross_hybridization_blastn_hit_parameters"]["coverage"]['value'])
        },
        "target_probe_cross_hybridization_bowtie_search_parameters": {
            "-v": to_int(form_data["target_probe_cross_hybridization_bowtie_search_parameters"]["v"]['value']),
            "--nofw": form_data["target_probe_cross_hybridization_bowtie_search_parameters"]["nofw"]['value'],

        },

        "max_graph_size": to_int(form_data["max_graph_size"]['value']),
        "n_attempts": to_int(form_data["n_attempts"]['value']),
        "heuristic": to_bool(form_data["heuristic"]['value']),
        "heuristic_n_attempts": to_int(form_data["heuristic_n_attempts"]['value']),


        # Melting Temperature Parameters
        "target_probe_Tm_parameters": {

            "nn_table": form_data["target_probe_Tm_parameters"]["nn_table"]['value'],
            "tmm_table": form_data["target_probe_Tm_parameters"]["tmm_table"]['value'],
            "imm_table": form_data["target_probe_Tm_parameters"]["imm_table"]['value'],
            "de_table": form_data["target_probe_Tm_parameters"]["de_table"]['value'],
            "dnac1": to_int(form_data["target_probe_Tm_parameters"]["dnac1"]['value']),
            "dnac2": to_int(form_data["target_probe_Tm_parameters"]["dnac2"]['value']),
            "saltcorr": to_int(form_data["target_probe_Tm_parameters"]["saltcorr"]['value']),
            "Na": to_int(form_data["target_probe_Tm_parameters"]["Na"]['value']),
            "K": to_int(form_data["target_probe_Tm_parameters"]["K"]['value']),
            "Tris": to_int(form_data["target_probe_Tm_parameters"]["Tris"]['value']),
            "Mg": to_int(form_data["target_probe_Tm_parameters"]["Mg"]['value']),
            "dNTPs": to_int(form_data["target_probe_Tm_parameters"]["dNTPs"]['value'])
        },
        "target_probe_Tm_chem_correction_param_probe": None,
        # If Tm_salt_correction_param_probe is null, we just omit it or set it to None

        "target_probe_Tm_chem_correction_parameters": {
            "DMSO": to_int(form_data["target_probe_Tm_chem_correction_parameters"]["DMSO"]['value']),
            "fmd": to_int(form_data["target_probe_Tm_chem_correction_parameters"]["fmd"]['value']),
            "DMSOfactor": float(form_data["target_probe_Tm_chem_correction_parameters"]["DMSOfactor"]['value']),
            "fmdfactor": float(form_data["target_probe_Tm_chem_correction_parameters"]["fmdfactor"]['value']),
            "fmdmethod": to_int(form_data["target_probe_Tm_chem_correction_parameters"]["fmdmethod"]['value']),
            "GC": to_null(form_data["target_probe_Tm_chem_correction_parameters"]["GC"]['value'])
        },
        "target_probe_Tm_salt_correction_parameters": None,
        "target_probe_hybridization_probability_bowtie_hit_parameters" : None,
        "target_probe_cross_hybridization_bowtie_hit_parameters": None,

    }


    # Write the YAML file
    with open(config_path, "w") as f:
        yaml.dump(config, f, sort_keys=False)

    result = subprocess.run(
        ['oligo_seq_probe_designer', '-c', config_path],
        capture_output=True,
        text=True
    )
    mongo.db.runs.update_one(
        {"_id": run_id},
        {"$set": {"status": "completed"}}
    )

    if os.path.exists(form_data['file_regions']['value']):
        print('deleted')
        os.remove(form_data['file_regions']['value'])  # Delete the file
    a=split_on_newline(form_data['files_fasta_target_probe_database']['value'])

    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)
    a=split_on_newline(form_data['files_fasta_reference_database_target_probe']['value'])
    if '\n' in a:
        a.remove('\n')
    for i in a:
        print('deleted')
        os.remove(i)



    return jsonify({
        'stdout': result.stdout,
        'stderr': result.stderr,
        'returncode': result.returncode
    })



if __name__ == "__main__":
    app.run(debug=True)
   # socketio.run(app, debug=True)