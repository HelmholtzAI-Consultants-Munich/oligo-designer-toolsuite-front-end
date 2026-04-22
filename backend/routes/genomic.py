"""
Genomic endpoints for region generation and processing.

Cascaded endpoints (under `/api/genomic/cascaded/`) are designed to be used as intermediate steps in pipeline workflows:
they generate genomic regions and pass the locations of created files/directories to downstream processes.
Other endpoints are standalone: they run the full pipeline and return the output directly to the user.
"""

import time
from http import HTTPStatus

from flask import Blueprint, abort, jsonify

from backend.extensions import mongo
from backend.genomic_databases import NCBIGenomicDataBase

genomic_bp = Blueprint("genomic", __name__)


@genomic_bp.route("/api/genomic/dropdown", methods=["GET"])
def genomic_dropdown_dict():
    dropdown_options = None
    for i in range(3):
        dropdown_options = mongo.db.cache.find_one({"_id": 1})

        if dropdown_options is not None:
            break

        time.sleep(5)

    if dropdown_options is None:
        abort(HTTPStatus.NOT_FOUND, description="Could not read dropdown options from database")

    return jsonify(dropdown_options["data"]), 200


@genomic_bp.route("/api/genomic/releases/<taxon>/<species>", methods=["GET"])
def genomic_get_releases(taxon: str, species: str):
    # we will not download anything so a cache_dir isn't necessary
    dirs = NCBIGenomicDataBase(cache_dir="").fetch_annotations_releases(taxon, species)

    if dirs is None:
        abort(
            HTTPStatus.NOT_FOUND,
            description=f'Could not fetch releases for taxon: "{taxon}" and species: "{species}"',
        )

    return jsonify(dirs), 200
