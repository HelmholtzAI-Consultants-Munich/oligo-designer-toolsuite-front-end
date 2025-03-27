const formDataEns= {
    dir_output: { value: "output_genomic_region_generator_ensembl", comment: "name of the directory where the output files will be written" },
    source: { value: "ensembl", comment: "required: indicate that ensembl annotation should be used" },
    source_params: {
        species: { value: "homo_sapiens", comment: "required: species name in ensemble download format, e.g. 'homo_sapiens' for human; see http://ftp.ensembl.org/pub/release-108/gtf/ for available species names" },
        annotation_release: { value: "current", comment: "required: release number of annotation, e.g. 'release-108' or 'current' to use most recent annotation release. Check out release numbers for ensemble at ftp.ensembl.org/pub/" }
    },
    genomic_regions: {
        gene: { value: "false", comment: "" },
        intergenic: { value: "false", comment: "" },
        exon: { value: "true", comment: "" },
        exon_exon_junction: { value: "false", comment: "" },
        utr: { value: "false", comment: "" },
        cds: { value: "false", comment: "" },
        intron: { value: "false", comment: "" }
    },
    exon_exon_junction_block_size: { value: "50", comment: "" }
};

export default formDataEns;