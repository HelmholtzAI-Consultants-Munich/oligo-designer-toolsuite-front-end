const formDataNcbi= {
    dir_output: { value: "output_genomic_region_generator_ncbi", comment: "name of the directory where the output files will be written" },
    source: { value: "ncbi", comment: "required: indicate that ncbi annotation should be used" },
    source_params: {
        taxon: { value: "vertebrate_mammalian", comment: "required: taxon of the species, valid taxa are: archaea, bacteria, fungi, invertebrate, mitochondrion, plant, plasmid, plastid, protozoa, vertebrate_mammalian, vertebrate_other, viral" },
        species: { value: "Homo_sapiens", comment: "required: species name in NCBI download format, e.g. 'Homo_sapiens' for human; see https://ftp.ncbi.nlm.nih.gov/genomes/refseq/ for available species name" },
        annotation_release: { value: "110", comment: "required: release number of annotation e.g. '109' or '109.20211119'  or 'current' to use most recent annotation release. Check out release numbers for NCBI at ftp.ncbi.nlm.nih.gov/refseq/H_sapiens/annotation/annotation_releases/" }
    },
    genomic_regions: {
        gene: { value: "false", comment: "" },
        intergenic: { value: "false", comment: "" },
        exon: { value: "true", comment: "" },
        exon_exon_junction: { value: "true", comment: "" },
        utr: { value: "false", comment: "" },
        cds: { value: "false", comment: "" },
        intron: { value: "false", comment: "" }
    },
    exon_exon_junction_block_size: { value: "50", comment: "" }
};

export default formDataNcbi;