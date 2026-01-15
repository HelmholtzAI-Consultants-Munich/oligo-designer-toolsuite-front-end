from flask import Blueprint, request
from flask_login import current_user

from .runners.runner_factory import get_runner

# Blueprint for OligoSeq endpoints
oligoseq_bp = Blueprint("oligoseq", __name__)


@oligoseq_bp.route("/api/oligoseq", methods=["POST"])
def oligoseq():
    form_data = request.json.get("formdata")  # Form data from React
    run_id_string = request.json.get("runid")  # Run ID from React

    runner = get_runner("oligoseq")
    return runner.run(current_user, form_data, run_id_string)
