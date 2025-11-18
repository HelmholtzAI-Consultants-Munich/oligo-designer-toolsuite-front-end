from flask import Blueprint, request
from .runners.seqfish_runner import SeqfishRunner
from flask_login import current_user

# Blueprint for Seqfish endpoints
seqfish_bp = Blueprint('seqfish', __name__)

@seqfish_bp.route('/api/seqfish', methods=['POST'])
def seqfish():
    form_data = request.json.get('formdata') # Form data from React
    run_id_string = request.json.get('runid') # Run ID from React

    runner = SeqfishRunner()
    return runner.run(current_user, form_data, run_id_string)
