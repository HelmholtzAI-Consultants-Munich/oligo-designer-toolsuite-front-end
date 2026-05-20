"""
Genomic endpoints for region generation and processing.

Cascaded endpoints (under `/api/genomic/cascaded/`) are designed to be used as intermediate steps in pipeline workflows:
they generate genomic regions and pass the locations of created files/directories to downstream processes.
Other endpoints are standalone: they run the full pipeline and return the output directly to the user.
"""

from http import HTTPStatus

from flask import Blueprint, abort, jsonify

from backend.genomic_databases import NCBIGenomicDataBase, fetch_dropdown_options

genomic_bp = Blueprint("genomic", __name__)


@genomic_bp.route("/api/genomic/dropdown", methods=["GET"])
def genomic_dropdown_dict():
    dropdown_options: dict[str, dict[str, list[str]]] = fetch_dropdown_options()
    return dropdown_options


@genomic_bp.route("/api/genomic/releases/<taxon>/<species>", methods=["GET"])
def genomic_get_releases(taxon: str, species: str):
    # TODO: validate that taxon and species are in our dropdown options
    dirs = NCBIGenomicDataBase().fetch_annotations_releases(taxon, species)

    if dirs is None:
        abort(
            HTTPStatus.NOT_FOUND,
            description=f'Could not fetch releases for taxon: "{taxon}" and species: "{species}"',
        )

    return jsonify(dirs), 200
