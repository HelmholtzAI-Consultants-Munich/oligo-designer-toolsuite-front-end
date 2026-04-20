import hashlib
import json
import os
import subprocess
from logging import Logger
from pathlib import Path
from typing import Any

import yaml
from filelock import SoftReadWriteLock

from backend.genomic_databases import EnsemblGenomicDataBase, NCBIGenomicDataBase
from backend.worker.converters import to_bool, to_int


class GenomicRegionGeneratorRunner:
    """
    For details on the genomic region generator, see 'Genomic Region Generator' and
    'Caching FASTA Files' in the developer documentation.
    """

    def __init__(self, logger: Logger):
        self.logger = logger

        # TODO: pass root_dir config to worker, use config for absolute path
        self.cache_dir = (Path(os.path.dirname(__file__)) / "../cache").resolve()
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def run(self, region_form: dict[str, Any]) -> list[str]:

        fna_files = []

        cache_key = self.get_form_cache_key(region_form)
        output_path = self.cache_dir / "generated" / f"cached_genomic_{cache_key}"
        output_path.mkdir(parents=True, exist_ok=True)

        # Acquire r/w lock on output directory, allowing multiple concurrent reads but exclusive writes
        # "Soft" lock is required for network file systems
        # This avoids:
        # - computing the same genomic regions multiple times at once
        # - race conditions due to simultaneous access to output and config (esp. writes, deletions)
        output_lock = SoftReadWriteLock(output_path.with_suffix(".lock"))
        with output_lock.write_lock():
            # ---------------------------------------------
            # First-line cache: region FASTAs already built?
            # ---------------------------------------------
            output_gen = output_path / "annotation"
            if output_gen.exists() and any(fname.endswith(".fna") for fname in os.listdir(output_gen)):
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        fna_files.append(output_gen / fname)
                return fna_files

            # ---------------------------------------------
            # Determine which upstream (NCBI or Ensembl) we are caching from, then always run in custom mode
            # ---------------------------------------------
            source_params = region_form.get("source_params", {})
            source_val = region_form.get("source", "").lower()

            if source_val == "ensembl":
                # Ensembl second-line cache
                species = source_params.get("species")
                ann_rel = source_params.get("annotation_release")
                if not species or ann_rel is None:
                    raise ValueError(
                        "Custom genomic (Ensembl) requires 'species' and 'annotation_release' in source_params."
                    )
                cache_info = EnsemblGenomicDataBase(cache_dir=self.cache_dir).prepare_cached_assets(
                    species, ann_rel
                )
                genome_assembly = cache_info["genome_assembly"]
                resolved_rel = cache_info["annotation_release"]
                annotation_file = cache_info["annotation_file"]
                sequence_file = cache_info["sequence_file"]
                files_source = "Ensembl"
            else:
                # Default to NCBI second-line cache
                taxon = source_params.get("taxon", "H_sapiens")
                species = source_params.get("species")
                ann_rel = source_params.get("annotation_release")
                if not species or ann_rel is None:
                    raise ValueError(
                        "Custom genomic (NCBI) requires 'species' and 'annotation_release' in source_params."
                    )
                cache_info = NCBIGenomicDataBase(cache_dir=self.cache_dir).prepare_cached_assets(
                    taxon, species, ann_rel
                )
                genome_assembly = cache_info["genome_assembly"]
                resolved_rel = cache_info["annotation_release"]
                annotation_file = cache_info["annotation_file"]
                sequence_file = cache_info["sequence_file"]
                files_source = "NCBI"

            # Build custom config pointing to cached decompressed files (BASIC PARAMETERS spec)
            config_path = output_path / f"config_genomic_{cache_key}.yaml"
            config_genomic = {
                "dir_output": str(output_path),
                "source": "custom",
                "source_params": {
                    "file_annotation": annotation_file,  # required: GTF
                    "file_sequence": sequence_file,  # required: FASTA
                    "files_source": files_source,  # optional: original source
                    "species": species,  # optional
                    "annotation_release": to_int(resolved_rel)
                    if str(resolved_rel).isdigit()
                    else resolved_rel,
                    "genome_assembly": genome_assembly,  # optional
                },
                "genomic_regions": {key: to_bool(val) for key, val in region_form["genomic_regions"].items()},
                "exon_exon_junction_block_size": to_int(region_form["exon_exon_junction_block_size"]),
            }

            with open(config_path, "w") as yaml_file:
                yaml.dump(config_genomic, yaml_file)

            # Lock input files to avoid modification during region generation
            annotation_file_lock = SoftReadWriteLock(Path(annotation_file).with_suffix(".lock"))
            sequence_file_lock = SoftReadWriteLock(Path(sequence_file).with_suffix(".lock"))

            with annotation_file_lock.read_lock(), sequence_file_lock.read_lock():
                result = subprocess.run(
                    ["genomic_region_generator", "-c", config_path], capture_output=True, text=True
                )

            if result.returncode != 0:
                self.logger.error(f"Custom pipeline failed: {result.stderr}")
                self.cleanup_temp_files(config_path)
                raise ValueError("The pipeline failed to execute. Please check your input and try again.")

            # Collect output .fna files (ignore raw genome)
            if output_gen.exists():
                for fname in os.listdir(output_gen):
                    if fname.endswith(".fna") and not ("GCF" in fname or "GCA" in fname):
                        fna_files.append(output_gen / fname)

            self.cleanup_temp_files(config_path)

        return fna_files

    def get_form_cache_key(self, form: dict) -> str:
        relevant_part = {
            "source": form.get("source"),
            "source_params": form.get("source_params"),
            "genomic_regions": form.get("genomic_regions"),
        }
        serialized = json.dumps(relevant_part, sort_keys=True)
        return hashlib.sha256(serialized.encode()).hexdigest()

    def cleanup_temp_files(self, config_path: Path):
        if config_path.exists():
            config_path.unlink()
