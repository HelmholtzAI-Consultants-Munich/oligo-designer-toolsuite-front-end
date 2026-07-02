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
    """Serves the taxon/species options from the backend rather than hardcoding
    them in the frontend, since the supported list changes as NCBI data updates.

    Returns:
        dict[str, dict[str, list[str]]]: dropdown options for populating the
        taxon/species selection form.
    """
    dropdown_options: dict[str, dict[str, list[str]]] = fetch_dropdown_options()
    return dropdown_options


@genomic_bp.route("/api/genomic/releases/<taxon>/<species>", methods=["GET"])
def genomic_get_releases(taxon: str, species: str):
    """Queried separately from the dropdown endpoint since the list of
    available annotation releases depends on which taxon/species the user
    already picked, and fetching every combination up front would be wasteful.

    Args:
        taxon (str): the taxon selected by the user.
        species (str): the species selected by the user.

    Raises:
        HTTPException: 404 if NCBI has no releases for this taxon/species pair.

    Returns:
        flask.Response: JSON list of available annotation release directories.
    """
    # TODO: validate that taxon and species are in our dropdown options
    dirs = NCBIGenomicDataBase().fetch_annotations_releases(taxon, species)

    if dirs is None:
        abort(
            HTTPStatus.NOT_FOUND,
            description=f'Could not fetch releases for taxon: "{taxon}" and species: "{species}"',
        )

    return jsonify(dirs), 200
