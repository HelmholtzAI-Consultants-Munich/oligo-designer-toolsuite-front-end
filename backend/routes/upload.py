import os
import uuid
from http import HTTPStatus

from werkzeug.utils import secure_filename

from flask import Blueprint, abort, current_app, jsonify, request

# Blueprint for all upload-related endpoints
upload_bp = Blueprint("upload", __name__)


@upload_bp.route("/api/upload", methods=["POST"])
def upload_file():
    """
    Handles file upload requests via POST, storing files with unique names in the server's upload directory.

    This endpoint receives a file from the frontend (in `request.files`), saves it to the server's
    designated upload folder with a UUID-prefixed filename to prevent collisions, and returns the server-side
    path of the saved file as a JSON response.

    :returns: JSON object with the file path where the uploaded file is saved on the server.
    :rtype: flask.Response

    :request.files file: The file sent by the client as part of the form data, under the 'file' field.
    :type file: werkzeug.datastructures.FileStorage

    :raises: Returns HTTP 400 if no file is included in the request or no file is selected by the user.

    Workflow steps:
      1. Checks that a file was provided in the request under the key 'file'.
      2. Validates that a file was actually selected (filename is not empty).
      3. Sanitizes the filename using secure_filename to prevent path traversal attacks.
      4. Generates a unique filename using a UUID prefix to avoid name collisions.
      5. Builds the full path for storing the file in the configured uploads directory.
      6. Saves the uploaded file to disk.
      7. Responds with a JSON object containing the server-side file path.

    Example request (using curl):
        curl -F "file=@example.txt" http://localhost:5000/api/upload

    Example response:
        {
            "filePath": "/absolute/server/path/to/uploads/3f52e1d123f84cd7afc3_example.txt"
        }
    """
    # Step 1: Check if the request includes a file under the 'file' key
    if "file" not in request.files:
        abort(HTTPStatus.BAD_REQUEST, description="No file part")

    file = request.files["file"]

    # Step 2: Check if the user actually selected a file (filename should not be empty)
    if file.filename == "":
        abort(HTTPStatus.BAD_REQUEST, description="No selected file")

    # Step 3: Sanitize the filename to prevent path traversal attacks
    safe_filename = secure_filename(file.filename)
    if not safe_filename:
        abort(HTTPStatus.BAD_REQUEST, description="Invalid filename")

    # Step 4: Generate a unique filename by prefixing with a UUID
    unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"

    # Step 5: Build the full path in the uploads directory (from Flask app config)
    file_path = os.path.join(current_app.config["UPLOAD_PATH"], unique_filename)

    # Step 6: Save the file to disk
    file.save(file_path)

    # Step 7: Respond with the server-side path where the file is stored
    return jsonify({"filePath": file_path}), HTTPStatus.OK
