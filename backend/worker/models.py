"""Overwrites of the Pydantic Models from ODT are done here."""

from typing import Annotated, Literal

from oligo_designer_toolsuite.config._general_models import REQUIRED_PARAMETERS_DESC, General
from oligo_designer_toolsuite.config.pipelines.cycle_hcr_probe_designer import (
    CycleHcrProbeDesignerConfigBase,
)
from oligo_designer_toolsuite.config.pipelines.hcr_probe_designer import HcrProbeDesignerConfigBase
from oligo_designer_toolsuite.config.pipelines.merfish_probe_designer import (
    MerfishProbeDesignerConfigBase,
)
from oligo_designer_toolsuite.config.pipelines.oligo_seq_probe_designer import (
    OligoSeqProbeDesignerConfigBase,
)
from oligo_designer_toolsuite.config.pipelines.scrinshot_probe_designer import (
    ScrinshotProbeDesignerConfigBase,
)
from oligo_designer_toolsuite.config.pipelines.seqfish_plus_probe_designer import (
    SeqfishPlusProbeDesignerConfigBase,
)
from pydantic import BaseModel, ConfigDict, Field, create_model

from backend.worker.utils import accept_uploaded_files, strip_local_descriptions

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


class OligoSeqProbeDesignerConfigFrontEnd(OligoSeqProbeDesignerConfigBase):
    """Overrides ODT's Oligo-Seq pipeline model to inject our custom genomic region generator
    models."""

    required_parameters: RequiredParameters = Field(description=REQUIRED_PARAMETERS_DESC)


### Front-end Models for the remaining pipelines ###

# Each ODT `...ConfigBase` leaves out `general` and `required_parameters`, so these only add the
# genome inputs back in our own type. None of them has a variant filter taking a VCF file.


class ScrinshotProbeDesignerConfigFrontEnd(ScrinshotProbeDesignerConfigBase):
    required_parameters: RequiredParameters = Field(description=REQUIRED_PARAMETERS_DESC)


class MerfishProbeDesignerConfigFrontEnd(MerfishProbeDesignerConfigBase):
    required_parameters: RequiredParameters = Field(description=REQUIRED_PARAMETERS_DESC)


class SeqfishPlusProbeDesignerConfigFrontEnd(SeqfishPlusProbeDesignerConfigBase):
    required_parameters: RequiredParameters = Field(description=REQUIRED_PARAMETERS_DESC)


class HcrProbeDesignerConfigFrontEnd(HcrProbeDesignerConfigBase):
    required_parameters: RequiredParameters = Field(description=REQUIRED_PARAMETERS_DESC)


class CycleHcrProbeDesignerConfigFrontEnd(CycleHcrProbeDesignerConfigBase):
    required_parameters: RequiredParameters = Field(description=REQUIRED_PARAMETERS_DESC)


# The schema each pipeline's form is built from. Every `x-` flag is declared on the ODT field
# itself, so nothing is stamped on afterwards.
FRONT_END_SCHEMAS: dict[str, type[BaseModel]] = {
    "oligoseq": OligoSeqProbeDesignerConfigFrontEnd,
    "scrinshot": ScrinshotProbeDesignerConfigFrontEnd,
    "merfish": MerfishProbeDesignerConfigFrontEnd,
    "seqfish": SeqfishPlusProbeDesignerConfigFrontEnd,
    "hcr": HcrProbeDesignerConfigFrontEnd,
    "cyclehcr": CycleHcrProbeDesignerConfigFrontEnd,
}

# Every ODT `...ConfigBase` leaves `general` out, so the form never offers it. It is filled in
# before a submission is validated (see `add_non_exposed_fields`), hence required here.
PIPELINE_VALIDATION_MODELS: dict[str, type[BaseModel]] = {
    name: create_model(f"{model.__name__}Validated", __base__=model, general=(General, ...))
    for name, model in FRONT_END_SCHEMAS.items()
}


def build_pipeline_schema(name: str) -> dict:
    """Generates the JSON Schema the front-end builds `name`'s form from.

    Arguments:
        name {str} -- the pipeline's key in `FRONT_END_SCHEMAS`

    Returns:
        {dict} -- the JSON Schema, without this module's developer-facing docstrings and with the
        file inputs widened to accept the front-end's `File` objects
    """
    schema = strip_local_descriptions(FRONT_END_SCHEMAS[name].model_json_schema(), globals(), __name__)
    # every uploaded input holds a File in the form where ODT wants the path it is saved to
    return accept_uploaded_files(schema, "file", "files_vcf_reference_database")
