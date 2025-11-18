from flask import Blueprint, request
from .runners.scrinshot_runner import ScrinshotRunner
from flask_login import current_user

# Blueprint for Scrinshot endpoints
scrinshot_bp = Blueprint('scrinshot', __name__)

@scrinshot_bp.route('/api/scrinshot', methods=['POST'])
def scrinshot():
    form_data = request.json.get('formdata') # Form data from React
    run_id_string = request.json.get('runid') # Run ID from React

    runner = ScrinshotRunner()
    return runner.run(current_user, form_data, run_id_string)
