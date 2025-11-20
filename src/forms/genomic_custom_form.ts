const form_Data_Custom = {
    dir_output: {
        value: "output_genomic_region_generator_custom",
        comment: "name of the directory where the output files will be written",
    },
    source: {
        value: "custom",
        comment: "required: indicate that own annotation should be used",
    },
    source_params: {
        file_annotation: {
            value: "data/annotations/custom_GCF_000001405.40_GRCh38.p14_genomic_chr16.gtf",
            comment: "required: GTF file with gene annotation",
        },
        file_sequence: {
            value: "data/annotations/custom_GCF_000001405.40_GRCh38.p14_genomic_chr16.fna",
            comment: "required: FASTA file with genome sequence",
        },
        files_source: {
            value: "NCBI",
            comment: "optional: original source of the genomic files",
        },
        species: {
            value: "Homo_sapiens",
            comment:
                "optional: species of provided annotation, leave empty if unknown",
        },
        annotation_release: {
            value: "110",
            comment:
                "optional: release number of provided annotation, leave empty if unknown",
        },
        genome_assembly: {
            value: "GRCh38",
            comment:
                "optional: genome assembly of provided annotation, leave empty if unknown",
        },
    },
    genomic_regions: {
        gene: { value: "true", comment: "" },
        intergenic: { value: "true", comment: "" },
        exon: { value: "true", comment: "" },
        exon_exon_junction: { value: "true", comment: "" },
        utr: { value: "true", comment: "" },
        cds: { value: "true", comment: "" },
        intron: { value: "true", comment: "" },
    },
    exon_exon_junction_block_size: { value: "50", comment: "" },
};

export default form_Data_Custom;
