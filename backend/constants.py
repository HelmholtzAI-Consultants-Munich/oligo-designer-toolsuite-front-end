from collections.abc import Callable, Mapping
from typing import NamedTuple

from oligo_designer_toolsuite.config import (
    CycleHcrProbeDesignerConfig,
    HcrProbeDesignerConfig,
    MerfishProbeDesignerConfig,
    OligoSeqProbeDesignerConfig,
    ScrinshotProbeDesignerConfig,
    SeqfishPlusProbeDesignerConfig,
)
from oligo_designer_toolsuite.pipelines import (
    cycle_hcr_probe_designer,
    hcr_probe_designer,
    merfish_probe_designer,
    oligo_seq_probe_designer,
    scrinshot_probe_designer,
    seqfish_plus_probe_designer,
)
from pydantic import BaseModel

USER_DENYLIST_COLLECTION_KEY = "user_denylist"


class Pipeline(NamedTuple):
    model: type[BaseModel]
    function: Callable


# ODT collects every genome input in `required_parameters`, so the paths are the same for all
# pipelines. `reference_genome` is shared by all specificity filters within a run.
PIPELINE_GENOMIC_INPUT: Mapping[str, list[str]] = {
    pipeline: [
        "required_parameters.target_genome",
        "required_parameters.reference_genome",
    ]
    for pipeline in ["oligoseq", "scrinshot", "merfish", "seqfish", "hcr", "cyclehcr"]
}

# Paths to fields naming user-uploaded files. A path holds either a list of names or, for the
# codebooks and probe tables a "load" branch reads, a single one; both shapes are handled where
# these are saved (`save_files`) and cleaned up. A path missing from a submission is skipped, so
# listing the "load" fields costs nothing when the user picked "generate" instead.
PIPELINE_FILE_INPUT: Mapping[str, list[str]] = {
    "oligoseq": ["target_probes.specificity_filters.variant_filter.files_vcf_reference_database"],
    "merfish": ["readout_probes.codebook.file", "readout_probes.readout_probe_table.file"],
    "seqfish": ["readout_probes.codebook.file", "readout_probes.readout_probe_table.file"],
    "hcr": ["initiator_probes.codebook.file", "initiator_probes.initiator_table.file"],
    "cyclehcr": ["readout_probes.codebook.file", "readout_probes.readout_probe_table.file"],
}

# `general` is absent from the front-end models (ODT's `...ConfigBase`), so it is filled in here
# before a submission is validated. `dir_output` is overwritten with the run's output path by
# the worker, the value below only satisfies the model.
PIPELINE_NON_EXPOSED_FIELDS = {
    pipeline: {
        "general": {
            "n_jobs": 1,
            "write_intermediate_steps": False,
            "dir_output": dir_output,
        },
    }
    for pipeline, dir_output in {
        "oligoseq": "output_oligo_seq_probe_designer",
        "scrinshot": "output_scrinshot_probe_designer",
        "merfish": "output_merfish_probe_designer",
        "seqfish": "output_seqfish_plus_probe_designer",
        "hcr": "output_hcr_probe_designer",
        "cyclehcr": "output_cycle_hcr_probe_designer",
    }.items()
}

PIPELINE_MODELS: Mapping[str, Pipeline] = {
    "oligoseq": Pipeline(OligoSeqProbeDesignerConfig, oligo_seq_probe_designer),
    "scrinshot": Pipeline(ScrinshotProbeDesignerConfig, scrinshot_probe_designer),
    "merfish": Pipeline(MerfishProbeDesignerConfig, merfish_probe_designer),
    "seqfish": Pipeline(SeqfishPlusProbeDesignerConfig, seqfish_plus_probe_designer),
    "hcr": Pipeline(HcrProbeDesignerConfig, hcr_probe_designer),
    "cyclehcr": Pipeline(CycleHcrProbeDesignerConfig, cycle_hcr_probe_designer),
}
