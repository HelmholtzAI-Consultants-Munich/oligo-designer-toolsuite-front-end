import hashlib
import json
import os
import subprocess
import uuid
from logging import Logger
from pathlib import Path
from typing import Any

import yaml
from filelock import SoftFileLock

from backend.cache import file_cache_region
from backend.genomic_databases import EnsemblGenomicDataBase, GenomicEntity, NCBIGenomicDataBase
from backend.worker.converters import to_bool, to_int


def get_form_cache_key(_: Any, region_form: dict[str, Any]) -> str:
    """Generate cache key from genomic region generator form.

    Notes:
        The first argument gets ignored. For the purpose of this function, see:
        https://dogpilecache.sqlalchemy.org/en/latest/usage.html#dogpile.cache.region.CacheRegion.params.function_key_generator

    TODO:
        Investigate why "exon_exon_junction_block_size" gets ignored for this.
        If it didn't we could avoid using this custom function.

    """
    relevant_part = {
        "source": region_form.get("source"),
        "source_params": region_form.get("source_params"),
        "genomic_regions": region_form.get("genomic_regions"),
    }
    serialized = json.dumps(relevant_part, sort_keys=True)
    return hashlib.sha256(serialized.encode()).hexdigest()


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

    @file_cache_region.cache_on_arguments(function_key_generator=lambda namespace, fn: get_form_cache_key)
    def generate_regions(self, region_form: dict[str, Any]) -> Path:
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
                "Custom genomic (NCBI) requires 'species' and 'annotation_release' in source_params."
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

        # Build custom config pointing to cached decompressed files (BASIC PARAMETERS spec)
        config_path = output_path / "config_genomic.yaml"
        config_genomic = {
            "dir_output": str(output_path),
            "source": "custom",
            "source_params": {
                "file_annotation": annotation_file,  # required: GTF
                "file_sequence": sequence_file,  # required: FASTA
                "files_source": files_source,  # optional: original source
                "species": species,  # optional
                "annotation_release": to_int(resolved_rel) if str(resolved_rel).isdigit() else resolved_rel,
                "genome_assembly": genome_assembly,  # optional
            },
            "genomic_regions": {key: to_bool(val) for key, val in region_form["genomic_regions"].items()},
            "exon_exon_junction_block_size": to_int(region_form["exon_exon_junction_block_size"]),
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
            result = subprocess.run(
                ["genomic_region_generator", "-c", config_path], capture_output=True, text=True
            )

        if result.returncode != 0:
            self.logger.error(f"Custom pipeline failed: {result.stderr}")
            self.cleanup_temp_files(config_path)
            raise ValueError("The pipeline failed to execute. Please check your input and try again.")

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
