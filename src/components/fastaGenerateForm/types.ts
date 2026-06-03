export type GenomicFormOrFile = File | GenomicForm;

export type GenomicForm = NcbiGenomicForm | EnsGenomicForm;

export interface NcbiGenomicForm {
    source: "ncbi";
    source_params: {
        species: string;
        annotation_release: string;
        taxon: string;
        assembly_source: string;
        mode: string;
    };
    genomic_regions: GenomicRegionsForm;
    exon_exon_junction_block_size: number;
}

export interface EnsGenomicForm {
    source: "ensembl";
    source_params: {
        species: string;
        annotation_release: string;
    };
    genomic_regions: GenomicRegionsForm;
    exon_exon_junction_block_size: number;
}

export interface GenomicRegionsForm {
    gene: boolean;
    intergenic: boolean;
    exon: boolean;
    exon_exon_junction: boolean;
    utr: boolean;
    cds: boolean;
    intron: boolean;
}

export interface NcbiAndEnsFormData {
    selectedSource: "ncbi" | "ensembl";
    formDataNcbi: NcbiGenomicForm;
    formDataEns: EnsGenomicForm;
}
