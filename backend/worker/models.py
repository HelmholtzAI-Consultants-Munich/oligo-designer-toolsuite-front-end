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
    source: Literal["ncbi"] = Field(default="ncbi")  # type: ignore
    source_params: SourceParamsNcbi  # type: ignore
    genomic_regions: GenomicRegionsNcbi  # type: ignore
    pass


class GenomicRegionGeneratorEnsembl(GenomicRegionGeneratorBase):
    source: Literal["ensembl"] = "ensembl"  # type: ignore
    source_params: SourceParamsEnsembl  # type: ignore
    genomic_regions: GenomicRegionsEnsembl
    pass


# TODO: remove override when Model exists from ODT side
GenomicInput = list[GenomicRegionGeneratorNcbi | GenomicRegionGeneratorEnsembl]


class TargetProbeOligoGeneration(TargetProbeOligoGenerationBase):
    file_region_ids: Annotated[
        str | None,
        Field(
            description="Comma separated list of genes used to generate the probe sequences. You can also upload a .txt file with one gene per line instead.",
        ),
    ]  # undefined by default, has to be set by user
    files_fasta_probe_database: GenomicInput = Field(min_length=1)  # type: ignore


class OligoSeqVariantFilterEnabled(OligoSeqVariantFilterEnabledBase):
    # NOTE: this is a small trick. A dict gets converted to type
    # `object` when building the JSON Schema from the pydantic model.
    files_vcf_reference_database: list[dict | str] = Field(min_length=1)  # type: ignore


OligoSeqVariantFilterConfig = Annotated[
    OligoSeqVariantFilterEnabled | OligoSeqVariantFilterDisabled, Field(discriminator="enabled")
]


class BlastnSearchParameters(BlastnSearchParametersBase):
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
    search_parameters: Annotated[  # type: ignore
        BlastnSearchParameters,
        Field(description="Parameters for BLASTN searches used in cross-hybridization filtering."),
    ]


CrossHybridizationBlastnFilterConfig = Annotated[
    CrossHybridizationBlastnFilterEnabled | CrossHybridizationBlastnFilterDisabled,
    Field(discriminator="enabled"),
]


class OligoSeqSpecificityBlastnFilterEnabled(OligoSeqSpecificityBlastnFilterEnabledBase):
    search_parameters: BlastnSearchParameters = BlastnSearchParameters(  # type: ignore
        perc_identity=80, strand="minus", word_size=10
    )
    files_fasta_reference_database: GenomicInput = Field(min_length=1)  # type: ignore


OligoSpecificityBlastnFilterConfig = Annotated[
    OligoSeqSpecificityBlastnFilterEnabled | OligoSeqSpecificityBlastnFilterDisabled,
    Field(discriminator="enabled"),
]


class TargetProbeSpecificityFilter(TargetProbeSpecificityFilterBase):
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
    we can inject our custom genomic region generator models. Adding to that it removes attributes like
    the general section of the OligoDesignerConfig, so these option do not get exposed to the user.
    """

    schema_version: Literal[2] = 2
    target_probe: TargetProbe


if __name__ == "__main__":
    with open("oligoseq.schema.json", "w+") as f:
        json.dump(OligoSeqProbeDesignerConfigFrontEnd.model_json_schema(), f)
