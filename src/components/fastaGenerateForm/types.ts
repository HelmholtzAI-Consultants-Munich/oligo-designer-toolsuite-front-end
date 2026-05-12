export type FastaFormUpload =
    | NcbiFastaFormDataUncommented
    | EnsFastaFormDataUncommented;

export interface FastaFormUncommented {
    selectedSource: string;
    formDataNcbi: NcbiFastaFormDataUncommented;
    formDataEns: EnsFastaFormDataUncommented;
}

export interface NcbiFastaFormDataUncommented {
    source: string;
    source_params: NcbiSourceParamsUncommented;
    genomic_regions: GenomicRegionsUncommented;
    exon_exon_junction_block_size: string;
}

export interface NcbiSourceParamsUncommented {
    species: string;
    annotation_release: string;
    taxon: string;
}

export interface GenomicRegionsUncommented {
    gene: string;
    intergenic: string;
    exon: string;
    exon_exon_junction: string;
    utr: string;
    cds: string;
    intron: string;
}

export interface EnsFastaFormDataUncommented {
    source: string;
    source_params: EnsSourceParamsUncommented;
    genomic_regions: GenomicRegionsUncommented;
    exon_exon_junction_block_size: string;
}

export interface EnsSourceParamsUncommented {
    species: string;
    annotation_release: string;
}
