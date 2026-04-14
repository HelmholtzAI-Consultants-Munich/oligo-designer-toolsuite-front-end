export interface FastaFormUpload {
    dir_output: string;
    source: string;
    source_params: {
        taxon?: string;
        species: string;
        annotation_release: string;
    };
    genomic_regions: {
        gene: boolean;
        intergenic: boolean;
        exon: boolean;
        exon_exon_junction: boolean;
        utr: boolean;
        cds: boolean;
        intron: boolean;
    };
    exon_exon_junction_block_size: number;
}
