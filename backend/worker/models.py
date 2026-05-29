import json
from typing import Annotated, Literal

from oligo_designer_toolsuite.config.overrides.oligo_seq_probe_designer_overrides import (
    OligoSeqSpecificityBlastnFilterDisabled,
    OligoSeqSpecificityBlastnFilterEnabled,
    OligoSeqVariantFilterDisabled,
    OligoSeqVariantFilterEnabled,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    OligoSeqProbeDesignerConfig,
    TargetProbe,
    TargetProbeOligoGeneration,
    TargetProbeSpecificityFilter,
)
from pydantic import BaseModel, Field

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
GenomicInput = list[str | GenomicRegionGeneratorNcbi | GenomicRegionGeneratorEnsembl]


class TargetProbeOligoGenerationWrapper(TargetProbeOligoGeneration):
    files_fasta_probe_database: GenomicInput = Field(min_length=1)


class OligoSeqSpecificityBlastnFilterEnabledWrapper(OligoSeqSpecificityBlastnFilterEnabled):
    files_fasta_reference_database: GenomicInput = Field(min_length=1)


OligoSpecificityBlastnFilterConfigWrapper = Annotated[
    OligoSeqSpecificityBlastnFilterEnabledWrapper | OligoSeqSpecificityBlastnFilterDisabled,
    Field(discriminator="enabled"),
]


class OligoSeqVariantFilterEnabledWrapper(OligoSeqVariantFilterEnabled):
    # NOTE: this is a small trick. A dict gets converted to type
    # `object` when building the JSON Schema from the pydantic model.
    files_vcf_reference_database: list[dict | str]


OligoSeqVariantFilterConfigWrapper = Annotated[
    OligoSeqVariantFilterEnabledWrapper | OligoSeqVariantFilterDisabled, Field(discriminator="enabled")
]


class TargetProbeSpecificityFilterWrapper(TargetProbeSpecificityFilter):
    specificity_blastn_filter: OligoSpecificityBlastnFilterConfigWrapper
    variant_filter: OligoSeqVariantFilterConfigWrapper


class TargetProbeWrapper(TargetProbe):
    oligo_generation: TargetProbeOligoGenerationWrapper
    specificity_filters: TargetProbeSpecificityFilterWrapper


class OligoSeqDesignerConfigWrapper(OligoSeqProbeDesignerConfig):
    """
    This Model overrides the default ODT Model of the Oligo-Seq pipeline, so
    we can inject our custom genomic region generator models
    """

    target_probe: TargetProbeWrapper


if __name__ == "__main__":
    with open("oligoseq.schema.json", "w+") as f:
        json.dump(OligoSeqDesignerConfigWrapper.model_json_schema(), f)
