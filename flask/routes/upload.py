from flask import Blueprint, request, jsonify, current_app
import os
import uuid
from extensions import mongo

# Blueprint for all upload-related endpoints
upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/api/upload', methods=['POST'])
def upload_file():
    """
    Handle file upload requests.

    Expects a 'file' in request.files.
    Saves the uploaded file to the configured UPLOAD_FOLDER with a unique filename.
    Returns the file path (server-side) in the response.
    """
    print(request.files)  # Debug: log incoming files

    # Check if the request includes a file
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']

    # Check if the user actually selected a file
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Generate a unique filename to avoid collisions
    unique_filename = f"{uuid.uuid4().hex}_{file.filename}"

    # Build the full path in the uploads directory
    file_path = os.path.join(current_app.config["UPLOAD_FOLDER"], unique_filename)

    # Save the file to disk
    file.save(file_path)

    # Respond with the path where the file is saved (server-side)
    return jsonify({"filePath": file_path}), 200