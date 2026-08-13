"""Overwrites of the Pydantic Models from ODT are done here."""

import json
from typing import Annotated, Literal

from oligo_designer_toolsuite.config._general_models import BlastnHitParameters
from oligo_designer_toolsuite.config._general_models import (
    BlastnSearchParameters as BlastnSearchParametersBase,
)
from oligo_designer_toolsuite.config._specificity_filters import (
    CrossHybridizationBlastnFilterDisabled,
)
from oligo_designer_toolsuite.config._specificity_filters import (
    CrossHybridizationBlastnFilterEnabled as CrossHybridizationBlastnFilterEnabledBase,
)
from oligo_designer_toolsuite.config.overrides.oligo_seq_probe_designer_overrides import (
    OligoSeqSpecificityBlastnFilterDisabled,
    OligoSeqVariantFilterDisabled,
)
from oligo_designer_toolsuite.config.overrides.oligo_seq_probe_designer_overrides import (
    OligoSeqSpecificityBlastnFilterEnabled as OligoSeqSpecificityBlastnFilterEnabledBase,
)
from oligo_designer_toolsuite.config.overrides.oligo_seq_probe_designer_overrides import (
    OligoSeqVariantFilterEnabled as OligoSeqVariantFilterEnabledBase,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    OligoSeqProbeDesignerConfig as OligoSeqProbeDesignerConfigBase,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    TargetProbe as TargetProbeBase,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    TargetProbeOligoGeneration as TargetProbeOligoGenerationBase,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    TargetProbeSpecificityFilter as TargetProbeSpecificityFilterBase,
)
from pydantic import AliasChoices, BaseModel, Field

from backend.worker.utils import mark_schema_flags, strip_local_descriptions

# Fields the front-end renders specially. "x-quick-setting" pins a field to the Quick Settings
# panel above the form's tabs, rendering it only there; "x-collapsed" starts a field's section
# collapsed.
#
# Set here, on the generated schema, rather than with Field(json_schema_extra=...) on the
# fields themselves: e.g. IndependentSetSelection.n_sets is declared by ODT with default=3. To
# add json_schema_extra to it we would redeclare it in our own subclass - but a Pydantic v2
# redeclaration replaces that field's whole FieldInfo, so the default, description and any
# constraints would be lost unless copied over by hand for every flagged field.
FRONT_END_FLAGS: dict[str, dict[str, tuple[str, ...]]] = {
    "x-quick-setting": {
        "TargetProbeOligoGeneration": ("probe_length_min", "probe_length_max"),
        "IndependentSetSelection": ("n_sets", "set_size_min", "set_size_opt"),
    },
    "x-collapsed": {
        "CrossHybridizationBlastnFilterEnabled": ("search_parameters",),
        "OligoSeqSpecificityBlastnFilterEnabled": ("search_parameters",),
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


class TargetProbeOligoGeneration(TargetProbeOligoGenerationBase):
    """Overwrites the default TargetProbeOligoGenerationBase to inject our custom field for
    `file_region_ids`, because we expect a gene list and not a file path."""

    file_region_ids: Annotated[
        str | None,
        Field(
            description="Comma separated list of genes used to generate the probe sequences. You can also upload a .txt file with one gene per line instead.",
        ),
    ]  # undefined by default, has to be set by user
    files_fasta_probe_database: GenomicInput = Field(min_length=1)  # type: ignore


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


class BlastnSearchParameters(BlastnSearchParametersBase):
    """Overwrites the default `BlastnSearchParametersBase` to set the type of the overwritten
    parameters to bool | None to ensure they are displayed nicely.
    """

    lcase_masking: bool | None = Field(  # type: ignore
        default=None,
        validation_alias=AliasChoices("-lcase_masking", "lcase_masking"),
        serialization_alias="-lcase_masking",
        description="Use lower case filtering in query and subject sequence(s).",
    )
    no_greedy: bool | None = Field(  # type: ignore
        default=None,
        validation_alias=AliasChoices("-no_greedy", "no_greedy"),
        serialization_alias="-no_greedy",
        description="Use non-greedy dynamic programming extension.",
    )
    subject_besthit: bool | None = Field(  # type: ignore
        default=None,
        validation_alias=AliasChoices("-subject_besthit", "subject_besthit"),
        serialization_alias="-subject_besthit",
        description="Turn on best hit per subject sequence.",
    )
    ungapped: bool | None = Field(  # type: ignore
        default=None,
        validation_alias=AliasChoices("-ungapped", "ungapped"),
        serialization_alias="-ungapped",
        description="Perform ungapped alignment only?",
    )


class CrossHybridizationBlastnFilterEnabled(CrossHybridizationBlastnFilterEnabledBase):
    """Overwrites `CrossHybridizationBlastnFilterEnabledBase` to insert our `BlastnSearchParameters`."""

    search_parameters: Annotated[  # type: ignore
        BlastnSearchParameters,
        Field(description="Parameters for BLASTN searches used in cross-hybridization filtering."),
    ]


# Overwrites CrossHybridizationBlastnFilterConfig to insert our own CrossHybridizationBlastnFilterEnabled
CrossHybridizationBlastnFilterConfig = Annotated[
    CrossHybridizationBlastnFilterEnabled | CrossHybridizationBlastnFilterDisabled,
    Field(discriminator="enabled"),
]


class OligoSeqSpecificityBlastnFilterEnabled(OligoSeqSpecificityBlastnFilterEnabledBase):
    """Overwrites `OligoSeqSpecificityBlastnFilterEnabledBase` to use our own `BlastnSearchParameters` and
    our `GenomicInput` instead of the default file path type.
    """

    search_parameters: BlastnSearchParameters = BlastnSearchParameters(  # type: ignore
        perc_identity=80, strand="minus", word_size=10
    )
    files_fasta_reference_database: GenomicInput = Field(min_length=1)  # type: ignore


# Overwrites OligoSpecificityBlastnFilterConfig to insert our own OligoSeqSpecificityBlastnFilterEnabled
OligoSpecificityBlastnFilterConfig = Annotated[
    OligoSeqSpecificityBlastnFilterEnabled | OligoSeqSpecificityBlastnFilterDisabled,
    Field(discriminator="enabled"),
]


class TargetProbeSpecificityFilter(TargetProbeSpecificityFilterBase):
    """Overwrites `TargetProbeSpecificityFilterBase` to insert our own Models for all parameters."""

    cross_hybridization_blastn_filter: CrossHybridizationBlastnFilterConfig = (  # type: ignore
        CrossHybridizationBlastnFilterEnabled(
            enabled=True,
            search_parameters=BlastnSearchParameters(perc_identity=80, strand="minus", word_size=10),
            hit_parameters=BlastnHitParameters(coverage=50),
        )
    )
    specificity_blastn_filter: OligoSpecificityBlastnFilterConfig  # type: ignore
    variant_filter: OligoSeqVariantFilterConfig  # type: ignore


class TargetProbe(TargetProbeBase):
    """Overwrites `TargetProbeBase` to insert our own Models for all parameters."""

    oligo_generation: TargetProbeOligoGeneration  # type: ignore
    specificity_filters: TargetProbeSpecificityFilter  # type: ignore


class OligoSeqProbeDesignerConfig(OligoSeqProbeDesignerConfigBase):
    """
    This Model overrides the default ODT Model of the Oligo-Seq pipeline, so
    we can inject our custom genomic region generator models
    """

    target_probe: TargetProbe  # type: ignore


class OligoSeqProbeDesignerConfigFrontEnd(BaseModel):
    """
    This Model overrides the default ODT Model of the Oligo-Seq pipeline, so
    we can inject our custom genomic region generator models.

    Adding to that it removes attributes like
    the general section of the OligoDesignerConfig, so these option do not get exposed to the user.
    """

    schema_version: Literal[2] = 2
    target_probe: TargetProbe


if __name__ == "__main__":
    schema = OligoSeqProbeDesignerConfigFrontEnd.model_json_schema()
    schema = strip_local_descriptions(schema, globals(), __name__)
    with open("oligoseq.schema.json", "w+") as f:
        json.dump(mark_schema_flags(schema, FRONT_END_FLAGS), f)
