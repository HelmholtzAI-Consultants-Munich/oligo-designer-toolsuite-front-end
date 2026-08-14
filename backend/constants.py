from collections.abc import Callable, Mapping
from typing import NamedTuple

from oligo_designer_toolsuite.config import OligoSeqProbeDesignerConfig, SeqfishPlusProbeDesignerConfig
from oligo_designer_toolsuite.pipelines import oligo_seq_probe_designer, seqfish_plus_probe_designer
from pydantic import BaseModel

USER_DENYLIST_COLLECTION_KEY = "user_denylist"


class Pipeline(NamedTuple):
    model: type[BaseModel]
    function: Callable


PIPELINE_GENOMIC_INPUT: Mapping[str, list[str]] = dict(
    **{
        pipeline: [
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
        ]
        for pipeline in ["scrinshot"]
    },
    **{
        pipeline: [
            "target_probe.oligo_generation.files_fasta_probe_database",
            "target_probe.specificity_filters.specificity_blastn_filter.files_fasta_reference_database",
        ]
        for pipeline in ["oligoseq"]
    },
    **{
        pipeline: [
            "files_fasta_target_probe_database",
            "files_fasta_reference_database_target_probe",
            "files_fasta_reference_database_readout_probe",
            "files_fasta_reference_database_primer",
        ]
        for pipeline in ["merfish"]
    },
    # Only the two target-probe fields are listed: the readout-probe and primer reference
    # databases sit inside discriminated unions (`source: "generate"`), so their paths only
    # exist for some submissions and glom cannot address them unconditionally.
    #   readout_probes.readout_probe_table.specificity_filters.specificity_blastn_filter.files_fasta_reference_database
    #   primers.forward_primer.specificity_filters.specificity_blastn_filter.files_fasta_reference_database
    seqfish=[
        "target_probes.oligo_generation.files_fasta_probe_database",
        "target_probes.specificity_filters.specificity_blastn_filter.files_fasta_reference_database",
    ],
)

PIPELINE_FILE_INPUT: Mapping[str, list[str]] = {
    "oligoseq": ["target_probe.specificity_filters.variant_filter.files_vcf_reference_database"]
}

PIPELINE_NON_EXPOSED_FIELDS = {
    "oligoseq": {
        "general": {
            "n_jobs": 1,
            "write_intermediate_steps": False,
            "dir_output": "output_oligo_seq_probe_designer",
        },
    },
}

PIPELINE_MODELS: Mapping[str, Pipeline] = {
    "oligoseq": Pipeline(OligoSeqProbeDesignerConfig, oligo_seq_probe_designer),
    "seqfish": Pipeline(SeqfishPlusProbeDesignerConfig, seqfish_plus_probe_designer),
}
