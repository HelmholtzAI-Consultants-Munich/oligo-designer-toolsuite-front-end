"""
Helper function to report the ODT version to the frontend.
"""

import json
from importlib.metadata import PackageNotFoundError, distribution

from flask import Blueprint

version_bp = Blueprint("version", __name__)


@version_bp.route("/api/version/ODT", methods=["GET"])
def get_version():
    try:
        odt_dist = distribution("oligo-designer-toolsuite")
    except PackageNotFoundError:
        return {"odt_version": None, "odt_commit": None}

    # get the commit hash from the direct URL when ODT was specified to be
    # installed via git with a certain branch or commit instead of an
    # installation form PyPI
    direct_url = odt_dist.read_text("direct_url.json")
    commit = None
    if direct_url:
        commit = json.loads(direct_url).get("vcs_info", {}).get("commit_id")

    return {"odt_version": odt_dist.version, "odt_commit": commit}
