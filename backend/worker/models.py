"""Overwrites of the Pydantic Models from ODT are done here."""

import json
import os
from typing import Annotated, Literal

from oligo_designer_toolsuite.config._general_models import General
from oligo_designer_toolsuite.config.pipelines.cycle_hcr_probe_designer import (
    CycleHcrProbeDesignerConfig,
)
from oligo_designer_toolsuite.config.pipelines.hcr_probe_designer import HcrProbeDesignerConfig
from oligo_designer_toolsuite.config.pipelines.merfish_probe_designer import (
    MerfishProbeDesignerConfig,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    OligoSeqProbeDesignerConfigBase,
    OligoSeqVariantFilterDisabled,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    OligoSeqVariantFilterEnabled as OligoSeqVariantFilterEnabledBase,
)

# Renamed from `TargetProbe` on ODT's pydantic-refactor branch, along with the section it
# holds (`target_probe` -> `target_probes`), matching seqfish.
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    TargetProbes as OligoSeqTargetProbesBase,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    TargetProbeSpecificityFilterBase as OligoSeqTargetProbeSpecificityFilterBase,
)
from oligo_designer_toolsuite.config.pipelines.scrinshot_probe_designer import (
    ScrinshotProbeDesignerConfig,
)
from oligo_designer_toolsuite.config.pipelines.seqfish_plus_probe_designer import (
    SeqfishPlusProbeDesignerConfig,
)
from pydantic import BaseModel, ConfigDict, Field

from backend.worker.utils import (
    accept_uploaded_files,
    hide_fields,
    mark_schema_flags,
    strip_local_descriptions,
)

# Fields the front-end renders specially:
#   "x-quick-setting" -- on a scalar field, pinning it to the Quick Settings panel above the
#                        form's tabs and rendering it only there, not in its own section
#   "x-collapsed"     -- on a field holding a model, whose section then starts collapsed
#
# Whoever writes the model declares the flag on the field itself, where it sits next to what
# it describes:
#     n_sets: int = Field(default=3, json_schema_extra={"x-quick-setting": True})
#     search_parameters: BlastnSearchParameters = Field(json_schema_extra={"x-collapsed": True})
#
# The table below is only for fields ODT owns, which we cannot annotate that way: flagging one
# means redeclaring it in a subclass here, and a Pydantic v2 redeclaration replaces that
# field's whole FieldInfo, so `n_sets` would lose the default, description and constraints ODT
# gave it unless each were copied over by hand. Stamping the generated schema leaves them be.
FRONT_END_FLAGS: dict[str, dict[str, tuple[str, ...]]] = {
    "x-quick-setting": {
        "TargetProbeOligoGeneration": ("probe_length_min", "probe_length_max"),
    },
}

### Genomic Region Generator Models ###


class GenomicRegionsBase(BaseModel):
    """This Model defines the Base Model for genomic regions and is overwritten by the Models that
    adapt the defaults to their specific version.
    """

    gene: bool = False
    intergenic: bool = False
    exon: bool = True
    utr: bool = False
    cds: bool = False
    intron: bool = False
    exon_exon_junction: bool = False


GenomicRegionsEnsembl = GenomicRegionsBase


class GenomicRegionsNcbi(GenomicRegionsBase):
    """This Model overwrites the defaults for the Genomic Regions for
    the Genomic Region Generator with source NCBI."""

    exon_exon_junction: bool = True


class SourceParamsBase(BaseModel):
    """This Model defines the shared source parameters that are used independent of the
    Genomic Region Generator source."""

    species: str
    annotation_release: str


class SourceParamsNcbi(SourceParamsBase):
    """This Model defines for an Genomic Region Generator Form with source NCBI."""

    species: str = ""
    mode: Literal["species"] = "species"
    taxon: str = "vertebrate_mammalian"
    species: str = "Homo_sapiens"
    assembly_source: Literal["auto"] = "auto"
    annotation_release: str = "110"


class SourceParamsEnsembl(SourceParamsBase):
    """This Model defines for an Genomic Region Generator Form with source Ensembl."""

    species: str = "homo_sapiens"
    annotation_release: str = "current"


class GenomicRegionGeneratorBase(BaseModel):
    """This Model defines the Base Model for the Genomic Region Generator.

    It gets overwritten by the specific Genomic Region Generator Models with the according source set.
    """

    source: str
    source_params: SourceParamsBase
    genomic_regions: GenomicRegionsBase
    exon_exon_junction_block_size: int = 50


class GenomicRegionGeneratorNcbi(GenomicRegionGeneratorBase):
    """This Model defines the Model for the Genomic Region Generator with source NCBI."""

    source: Literal["ncbi"] = Field(default="ncbi")  # type: ignore
    source_params: SourceParamsNcbi  # type: ignore
    genomic_regions: GenomicRegionsNcbi  # type: ignore
    pass


class GenomicRegionGeneratorEnsembl(GenomicRegionGeneratorBase):
    """This Model defines the Model for the Genomic Region Generator with source Ensembl."""

    source: Literal["ensembl"] = "ensembl"  # type: ignore
    source_params: SourceParamsEnsembl  # type: ignore
    genomic_regions: GenomicRegionsEnsembl
    pass


# TODO: remove override when Model exists from ODT side
# This Model allows a list of Genomic Region Generator Forms with either Ncbi or Ensembl
# as the source.
GenomicInput = list[GenomicRegionGeneratorNcbi | GenomicRegionGeneratorEnsembl]


class RequiredParameters(BaseModel):
    """Overwrites ODT's `RequiredParameters` to use `GenomicInput` for the genome fields
    instead of the default file path type."""

    model_config = ConfigDict(extra="forbid")

    targets: Annotated[
        str | None,
        Field(
            description="Comma separated list of genes used to generate the probe sequences. You can also upload a .txt file with one gene per line instead.",
        ),
    ]
    target_genome: GenomicInput = Field(
        min_length=1, description="FASTA file(s) from which the target oligo sequences are generated."
    )  # type: ignore
    reference_genome: GenomicInput = Field(
        min_length=1,
        description="FASTA file(s) used as reference for all specificity filters (e.g. with BLAST).",
    )  # type: ignore


class OligoSeqVariantFilterEnabled(OligoSeqVariantFilterEnabledBase):
    """Overwrite the default OligoSeqVariantFilterEnabledBase Model to change the expected type of
    `files_vcf_reference_database` to accept a dict instead of a file path."""

    # NOTE: this is a small trick. A dict gets converted to type
    # `object` when building the JSON Schema from the pydantic model.
    files_vcf_reference_database: list[dict | str] = Field(min_length=1)  # type: ignore


# This Model overwrites OligoSeqVariantFilterConfig to use our version of OligoSeqVariantFilterEnabled
# instead of the default one
OligoSeqVariantFilterConfig = Annotated[
    OligoSeqVariantFilterEnabled | OligoSeqVariantFilterDisabled, Field(discriminator="enabled")
]


class OligoSeqTargetProbeSpecificityFilter(OligoSeqTargetProbeSpecificityFilterBase):
    """Overwrites `TargetProbeSpecificityFilterBase` to insert our own Models for all parameters."""

    variant_filter: OligoSeqVariantFilterConfig  # type: ignore


class OligoSeqTargetProbes(OligoSeqTargetProbesBase):
    """Overwrites `TargetProbeBase` to insert our own Models for all parameters."""

    specificity_filters: OligoSeqTargetProbeSpecificityFilter  # type: ignore


class OligoSeqProbeDesignerConfigFrontEnd(OligoSeqProbeDesignerConfigBase):
    """Overrides ODT's Oligo-Seq pipeline model to inject our custom genomic region generator
    models. `OligoSeqProbeDesignerConfigBase` excludes `general`, so those options never
    reach the user."""

    required_parameters: RequiredParameters
    target_probes: OligoSeqTargetProbes


class OligoSeqProbeDesignerConfig(OligoSeqProbeDesignerConfigFrontEnd):
    """Adds back the `general` section ODT's base model excludes, for use once a submission
    also carries the non-exposed backend defaults (see `add_non_exposed_fields`)."""

    general: General = General(
        n_jobs=4,
        dir_output="output_oligo_seq_probe_designer",
        write_intermediate_steps=True,
    )


### Front-end Models for the remaining pipelines ###

# These pipelines need no override beyond `required_parameters`: ODT keeps every genome input
# in that one section now, and none of them has a variant filter taking a VCF file.


class ScrinshotProbeDesignerConfigFrontEnd(ScrinshotProbeDesignerConfig):
    required_parameters: RequiredParameters  # type: ignore


class MerfishProbeDesignerConfigFrontEnd(MerfishProbeDesignerConfig):
    required_parameters: RequiredParameters  # type: ignore


class SeqfishPlusProbeDesignerConfigFrontEnd(SeqfishPlusProbeDesignerConfig):
    required_parameters: RequiredParameters  # type: ignore


class HcrProbeDesignerConfigFrontEnd(HcrProbeDesignerConfig):
    required_parameters: RequiredParameters  # type: ignore


class CycleHcrProbeDesignerConfigFrontEnd(CycleHcrProbeDesignerConfig):
    required_parameters: RequiredParameters  # type: ignore


# The schema each pipeline's form is built from. FRONT_END_FLAGS only names models oligoseq
# defines, so it is applied to that schema alone; the other pipelines carry ODT's own
# `json_schema_extra` flags.
FRONT_END_SCHEMAS: dict[str, tuple[type[BaseModel], dict | None]] = {
    "oligoseq": (OligoSeqProbeDesignerConfigFrontEnd, FRONT_END_FLAGS),
    "scrinshot": (ScrinshotProbeDesignerConfigFrontEnd, None),
    "merfish": (MerfishProbeDesignerConfigFrontEnd, None),
    "seqfish": (SeqfishPlusProbeDesignerConfigFrontEnd, None),
    "hcr": (HcrProbeDesignerConfigFrontEnd, None),
    "cyclehcr": (CycleHcrProbeDesignerConfigFrontEnd, None),
}

# A submission is validated once `general` has been filled back in, so the model used here has
# to carry it. Only oligoseq needs a separate class for that: its front-end model derives from
# an ODT base that leaves `general` out, while the others inherit it from ODT's own config.
PIPELINE_VALIDATION_MODELS: dict[str, type[BaseModel]] = {
    **{name: model for name, (model, _) in FRONT_END_SCHEMAS.items()},
    "oligoseq": OligoSeqProbeDesignerConfig,
}


if __name__ == "__main__":
    # Written straight into the repo's `schemas/`, where the front-end imports them from,
    # so running this module needs no follow-up move regardless of the working directory.
    schemas_dir = os.path.join(os.path.dirname(__file__), "..", "..", "schemas")

    for name, (model, flags) in FRONT_END_SCHEMAS.items():
        schema = strip_local_descriptions(model.model_json_schema(), globals(), __name__)
        # `general` holds run settings the backend decides, not the user
        schema = hide_fields(schema, "general")
        # a codebook or probe table is uploaded, so the form holds a File where ODT wants a path
        schema = accept_uploaded_files(schema, "file")
        if flags:
            schema = mark_schema_flags(schema, flags)
        with open(os.path.join(schemas_dir, f"{name}.schema.json"), "w+") as f:
            json.dump(schema, f)
