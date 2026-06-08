export type GenomicFormOrFile = File | GenomicForm;

export type GenomicForm = NcbiGenomicForm | EnsemblGenomicForm;

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

export interface EnsemblGenomicForm {
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

export interface NcbiAndEnsemblFormData {
    selectedSource: "ncbi" | "ensembl";
    formDataNcbi: NcbiGenomicForm;
    formDataEnsembl: EnsemblGenomicForm;
}
