import os
import uuid
from logging import Logger
from pathlib import Path
from typing import Any

import yaml
from filelock import SoftFileLock
from oligo_designer_toolsuite.pipelines._genomic_region_generator import (
    GenomicRegionGenerator,
)

from backend.cache import file_cache_region
from backend.exceptions import ODTPipelineError
from backend.genomic_databases import EnsemblGenomicDataBase, GenomicEntity, NCBIGenomicDataBase
from backend.worker.converters import to_bool, to_int
from backend.worker.utils import build_fallback_error_message


class GenomicRegionGeneratorRunner:
    """
    For details on the genomic region generator, see 'Genomic Region Generator' and
    'Caching FASTA Files' in the developer documentation.
    """

    def __init__(self, logger: Logger):
        self.logger = logger

        self.cache_dir = (Path(os.path.dirname(__file__)) / "../cache").resolve()
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def run(self, region_form: dict[str, Any]) -> list[str]:
        output_path = self.generate_regions(region_form)

        return self.collect_result_paths(output_path)

    @file_cache_region.cache_on_arguments()
    def generate_regions(self, region_form: dict[str, Any]) -> Path:
        """Executes the genomic region generator.

        Arguments:
            region_form {dict[str, Any]} -- The provided form specifying what regions to generate.

        Notes:
            This function is decorated with our file cache to serve as the level 1 cache.

        Raises:
            ValueError: Missing fields in region_form.
            ValueError: The genomic region generator failed.

        Returns:
            Path -- The output directory containing the results.
        """
        output_path = self.cache_dir / "generated" / f"cached_genomic_{uuid.uuid4().hex}"
        output_path.mkdir(parents=True, exist_ok=True)

        # ---------------------------------------------
        # Determine which upstream (NCBI or Ensembl) we are caching from, then always run in custom mode
        # ---------------------------------------------
        source_params = region_form.get("source_params", {})
        taxon = source_params.get("taxon", "H_sapiens")  # ignored by EnsemblGenomicDataBase
        species = source_params.get("species")
        ann_rel = str(source_params.get("annotation_release"))
        if species is None or ann_rel is None:
            raise ValueError(
                "Genomic region generation requires 'species' and 'annotation_release' in source_params."
            )
        genomic_entity = GenomicEntity(taxon=taxon, species=species, release=ann_rel)

        source_val = region_form.get("source", "").lower()
        if source_val == "ensembl":
            # Ensembl second-line cache
            cache_info = EnsemblGenomicDataBase(cache_dir=self.cache_dir).fetch_genomic_entity(genomic_entity)
            files_source = "Ensembl"
        else:
            # Default to NCBI second-line cache
            cache_info = NCBIGenomicDataBase(cache_dir=self.cache_dir).fetch_genomic_entity(genomic_entity)
            files_source = "NCBI"

        genome_assembly = cache_info["genome_assembly"]
        resolved_rel = cache_info["annotation_release"]
        annotation_file = cache_info["annotation_file"]
        sequence_file = cache_info["sequence_file"]

        # Build custom config pointing to cached uncompressed files (BASIC PARAMETERS spec)
        config_path = output_path / "config_genomic.yaml"
        config_genomic = {
            "dir_output": str(output_path),
            "source": "custom",
            "source_params": {
                "file_annotation": annotation_file,  # required: GTF
                "file_sequence": sequence_file,  # required: FASTA
                "files_source": files_source,  # optional: original source
                "species": species,  # optional
                "annotation_release": to_int(resolved_rel) if resolved_rel.isdigit() else resolved_rel,
                "genome_assembly": genome_assembly,  # optional
            },
            "genomic_regions": {key: to_bool(val) for key, val in region_form["genomic_regions"].items()},
            "exon_exon_junction_block_size": to_int(
                region_form["exon_exon_junction_block_size"]
            ),  # TODO: confirm whether users should be able to set this
        }

        with open(config_path, "w") as yaml_file:
            yaml.dump(config_genomic, yaml_file)

        # Lock input files
        #   1. to avoid input modification during region generation (low likelihood)
        #   2. because ODT's Genomic Region Generator isn't safe for parallel execution with same input files
        annotation_file_lock = SoftFileLock(Path(annotation_file + ".lock"))
        sequence_file_lock = SoftFileLock(Path(sequence_file + ".lock"))
        with annotation_file_lock, sequence_file_lock:
            # start Genomic Region Generator
            try:
                pipeline = GenomicRegionGenerator(config_genomic["dir_output"])

                # Load annotations
                region_generator = pipeline.load_annotations(
                    source=config_genomic["source"],
                    source_params=config_genomic["source_params"],
                )

                # Generate regions
                pipeline.generate_genomic_regions(
                    region_generator=region_generator,
                    genomic_regions=config_genomic["genomic_regions"],
                    block_size=config_genomic["exon_exon_junction_block_size"],
                )

            except ValueError:
                raise ODTPipelineError(build_fallback_error_message("genomic region generator"))
            except Exception as error:
                if hasattr(error, "stderr"):
                    self.logger.warning(f"The genomic region generator failed STDERR: {error.stderr}")
                self.logger.warning(f"The genomic region generator failed PLAIN: {error}")
                self.cleanup_temp_files(config_path)
                other_files_source = "Ensembl" if files_source == "NCBI" else "NCBI"
                raise ODTPipelineError(
                    f"An error occured while fetching data from {files_source}. Please try again. If the error persists, please inform us of the issue and consider switching to {other_files_source} data for now."
                )

        self.cleanup_temp_files(config_path)

        return output_path

    def collect_result_paths(self, output_path: Path) -> list[str]:
        fna_files: list[str] = []

        annotation_output_path = output_path / "annotation"
        if annotation_output_path.exists():
            for fname in os.listdir(annotation_output_path):
                if fname.endswith(".fna"):
                    fna_files.append(str(annotation_output_path / fname))
        return fna_files

    def cleanup_temp_files(self, config_path: Path):
        if config_path.exists():
            config_path.unlink()
