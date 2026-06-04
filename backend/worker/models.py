import json
from typing import Annotated, Literal

from oligo_designer_toolsuite.config._general_models import BlastnHitParameters, BlastnSearchParameters
from oligo_designer_toolsuite.config._specificity_filters import (
    CrossHybridizationBlastnFilterDisabled,
    CrossHybridizationBlastnFilterEnabled,
)
from oligo_designer_toolsuite.config.overrides.oligo_seq_probe_designer_overrides import (
    OligoSeqSpecificityBlastnFilterDisabled,
    OligoSeqSpecificityBlastnFilterEnabled,
    OligoSeqVariantFilterDisabled,
    OligoSeqVariantFilterEnabled,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    OligoSeqProbeDesignerConfig,
    RegionListT,
    TargetProbe,
    TargetProbeOligoGeneration,
    TargetProbeSpecificityFilter,
)
from pydantic import AliasChoices, BaseModel, Field

### Genomic Region Generator Models ###


class GenomicRegionsBase(BaseModel):
    gene: bool = False
    intergenic: bool = False
    exon: bool = True
    utr: bool = False
    cds: bool = False
    intron: bool = False
    exon_exon_junction: bool = False


GenomicRegionsEnsembl = GenomicRegionsBase


class GenomicRegionsNcbi(GenomicRegionsBase):
    exon_exon_junction: bool = True


class SourceParamsBase(BaseModel):
    species: str
    annotation_release: str


class SourceParamsNcbi(SourceParamsBase):
    species: str = ""
    mode: Literal["species"] = "species"
    taxon: str = "vertebrate_mammalian"
    species: str = "Homo_sapiens"
    assembly_source: Literal["auto"] = "auto"
    annotation_release: str = "110"


class SourceParamsEnsembl(SourceParamsBase):
    species: str = "homo_sapiens"
    annotation_release: str = "current"


class GenomicRegionGeneratorBase(BaseModel):
    source: str
    source_params: SourceParamsBase
    genomic_regions: GenomicRegionsBase
    exon_exon_junction_block_size: int = 50


class GenomicRegionGeneratorNcbi(GenomicRegionGeneratorBase):
    source: Literal["ncbi"] = Field(default="ncbi")
    source_params: SourceParamsNcbi
    genomic_regions: GenomicRegionsNcbi
    pass


class GenomicRegionGeneratorEnsembl(GenomicRegionGeneratorBase):
    source: Literal["ensembl"] = "ensembl"
    source_params: SourceParamsEnsembl
    genomic_regions: GenomicRegionsEnsembl
    pass


# TODO: remove override when Model exists from ODT side
GenomicInput = list[GenomicRegionGeneratorNcbi | GenomicRegionGeneratorEnsembl]


class TargetProbeOligoGenerationOverride(TargetProbeOligoGeneration):
    file_region_ids: RegionListT = None
    files_fasta_probe_database: GenomicInput = Field(min_length=1)


class OligoSeqVariantFilterEnabledOverride(OligoSeqVariantFilterEnabled):
    # NOTE: this is a small trick. A dict gets converted to type
    # `object` when building the JSON Schema from the pydantic model.
    files_vcf_reference_database: list[dict | str] = Field(min_length=1)


OligoSeqVariantFilterConfigOverride = Annotated[
    OligoSeqVariantFilterEnabledOverride | OligoSeqVariantFilterDisabled, Field(discriminator="enabled")
]


class BlastnSearchParametersOverride(BlastnSearchParameters):
    lcase_masking: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("-lcase_masking", "lcase_masking"),
        serialization_alias="-lcase_masking",
        description="Use lower case filtering in query and subject sequence(s).",
    )
    no_greedy: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("-no_greedy", "no_greedy"),
        serialization_alias="-no_greedy",
        description="Use non-greedy dynamic programming extension.",
    )
    subject_besthit: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("-subject_besthit", "subject_besthit"),
        serialization_alias="-subject_besthit",
        description="Turn on best hit per subject sequence.",
    )
    ungapped: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("-ungapped", "ungapped"),
        serialization_alias="-ungapped",
        description="Perform ungapped alignment only?",
    )


class CrossHybridizationBlastnFilterEnabledOverride(CrossHybridizationBlastnFilterEnabled):
    search_parameters: Annotated[
        BlastnSearchParametersOverride,
        Field(description="Parameters for BLASTN searches used in cross-hybridization filtering."),
    ]


CrossHybridizationBlastnFilterConfigOverride = Annotated[
    CrossHybridizationBlastnFilterEnabledOverride | CrossHybridizationBlastnFilterDisabled,
    Field(discriminator="enabled"),
]


class OligoSeqSpecificityBlastnFilterEnabledOverride(OligoSeqSpecificityBlastnFilterEnabled):
    search_parameters: BlastnSearchParametersOverride = BlastnSearchParametersOverride(
        perc_identity=80, strand="minus", word_size=10
    )
    files_fasta_reference_database: GenomicInput = Field(min_length=1)


OligoSpecificityBlastnFilterConfigOverride = Annotated[
    OligoSeqSpecificityBlastnFilterEnabledOverride | OligoSeqSpecificityBlastnFilterDisabled,
    Field(discriminator="enabled"),
]


class TargetProbeSpecificityFilterOverride(TargetProbeSpecificityFilter):
    cross_hybridization_blastn_filter: CrossHybridizationBlastnFilterConfigOverride = (
        CrossHybridizationBlastnFilterEnabledOverride(
            enabled=True,
            search_parameters=BlastnSearchParametersOverride(perc_identity=80, strand="minus", word_size=10),
            hit_parameters=BlastnHitParameters(coverage=50),
        )
    )
    specificity_blastn_filter: OligoSpecificityBlastnFilterConfigOverride
    variant_filter: OligoSeqVariantFilterConfigOverride


class TargetProbeOverride(TargetProbe):
    oligo_generation: TargetProbeOligoGenerationOverride
    specificity_filters: TargetProbeSpecificityFilterOverride


class OligoSeqProbeDesignerConfigOverride(OligoSeqProbeDesignerConfig):
    """
    This Model overrides the default ODT Model of the Oligo-Seq pipeline, so
    we can inject our custom genomic region generator models
    """

    target_probe: TargetProbeOverride


class OligoSeqProbeDesignerConfigFrontEnd(BaseModel):
    """
    This Model overrides the default ODT Model of the Oligo-Seq pipeline, so
    we can inject our custom genomic region generator models. Adding to that it removes attributes like
    the general section of the OligoDesignerConfig, so these option do not get exposed to the user.
    """

    schema_version: Literal[2] = 2
    target_probe: TargetProbeOverride


if __name__ == "__main__":
    with open("oligoseq.schema.json", "w+") as f:
        json.dump(OligoSeqProbeDesignerConfigFrontEnd.model_json_schema(), f)
