export type GenomicFormOrFile = File | GenomicForm;

/**
 * Discriminated Union that has both possible variants for the type of an GenomicForm.
 *
 * Since we have NCBI and Ensembl as genomic data providers and the backend for NCBI allows more fields,
 * we need to differentiate between these two types
 */
export type GenomicForm = NcbiGenomicForm | EnsemblGenomicForm;

/**
 * Interface of the Genomic Form, when `NCBI` is the selected source. It allows more field in `source_params`, because the `NCBI` backend requires these.
 */
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
/**
 * Interface of the Genomic Form, when `Ensembl` is the selected source.
 */
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
/**
 * Interface for the Genomic Region Generator Form State.
 *
 * We store the state of both variants at the same time.
 * This makes changing the selected genomic data provider back and forth more comfortable.
 */
export interface NcbiAndEnsemblFormData {
    selectedSource: "ncbi" | "ensembl";
    formDataNcbi: NcbiGenomicForm;
    formDataEnsembl: EnsemblGenomicForm;
}
