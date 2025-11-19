from flask import Blueprint, request
from .runners.runner_factory import get_runner
from flask_login import current_user

# Blueprint for Merfish endpoints
merfish_bp = Blueprint('merfish', __name__)

@merfish_bp.route('/api/merfish', methods=['POST'])
def merfish():
    form_data = request.json.get('formdata') # Form data from React
    run_id_string = request.json.get('runid') # Run ID from React

    runner = get_runner("merfish")
    return runner.run(current_user, form_data, run_id_string)
