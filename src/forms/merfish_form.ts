const formDatas = {
    n_jobs: { value: "4", comment: "number of cores used to run the pipeline and 2*n_jobs +1 of regions that should be stored in cache. If memory consumption of pipeline is too high reduce this number, if a lot of RAM is available increase this number to decrease runtime" },
    dir_output: { value: "output_merfish_probe_designer", comment: "name of the directory where the output files will be written" },
    write_intermediate_steps: { value: "true", comment: "if true, writes the oligo sequences after each step of the pipeline into a csv file" },
    top_n_sets: { value: "3", comment: "maximum number of sets to report in padlock_probes.yaml and \"padlock_probes_order.yaml\"" },
    file_regions: { value: "", comment: "file with a list the genes used to generate the probe sequences, leave empty if all the genes are used" },
    files_fasta_target_probe_database: { value: "", comment: "fasta file with sequences form which the probes should be generated. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest" },
    files_fasta_reference_database_target_probe: { value: "", comment: "fasta file with sequences used as reference for the specificity filters. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest" },
    target_probe_length_min: { value: "30", comment: "min length of probe" },
    target_probe_length_max: { value: "30", comment: "max length of probe" },
    target_probe_isoform_consensus: { value: "50", comment: "min isoform consesnsus for probes, i.e. how many transcripts of the total number of transcripts of a gene are covered by the probe, given in %" },
    target_probe_GC_content_min: { value: "43", comment: "minimum GC content of oligos" },
    target_probe_GC_content_opt: { value: "55", comment: "max and min values are defiend above" },
    target_probe_GC_content_max: { value: "63", comment: "maximum GC content of oligos" },
    target_probe_Tm_min: { value: "66", comment: "minimum melting temperature of oligos" },
    target_probe_Tm_opt: { value: "72", comment: "max and min values are defiend above" },
    target_probe_Tm_max: { value: "76", comment: "maximum melting temperature of oligos" },
    target_probe_homopolymeric_base_n: {
        A: { value: "6", comment: "" },
        T: { value: "6", comment: "" },
        C: { value: "6", comment: "" },
        G: { value: "6", comment: "" }
    },
    target_probe_T_secondary_structure: { value: "76", comment: "Temperature at which the free energy is calculated" },
    target_probe_secondary_structures_threshold_deltaG: { value: "0", comment: "threshold for the secondary structure free energy -> oligo rejected if it presents a structure with a negative free energy at the defined temperature" },
    target_probe_GC_weight: { value: "1", comment: "weight of the GC content of the probe in the efficiency score" },
    target_probe_Tm_weight: { value: "1", comment: "weight of the Tm of the probe in the efficiency score" },
    target_probe_isoform_weight: { value: "2", comment: "weight of the Tm of the probe in the efficiency score" },
    set_size_min: { value: "50", comment: "minimum size of probe sets (in case there exist no set of the optimal size) -> genes with less oligos will be filtered out and stored in regions_with_insufficient_oligos_for_db_probes" },
    set_size_opt: { value: "50", comment: "optimal size of probe sets" },
    distance_between_target_probes: { value: "0", comment: "how much overlap should be allowed between oligos, e.g. if oligos can overlpap x bases choose -x, if oligos can be next to one another choose 0, if oligos should be x bases apart choose x" },
    n_sets: { value: "100", comment: "maximum number of sets to generate" },
    files_fasta_reference_database_readout_probe: { value: ["data/genomic_regions/exon_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna, data/genomic_regions/exon_exon_junction_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"], comment: "fasta file with sequences used as reference for the specificity filters. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest" },
    readout_probe_length: { value: "20", comment: "length of readout probes" },
    readout_probe_base_probabilities: {
        A: { value: "0.25", comment: "" },
        C: { value: "0.0", comment: "" },
        G: { value: "0.5", comment: "" },
        T: { value: "0.25", comment: "" }
    },
    readout_probe_GC_content_min: { value: "40", comment: "minimum GC content of oligos" },
    readout_probe_GC_content_max: { value: "50", comment: "maximum GC content of oligos" },
    readout_probe_homopolymeric_base_n: {
        G: { value: "3", comment: "" }
    },
    readout_probe_set_size: { value: "16", comment: "total number of readout probes" },
    readout_probe_homogeneous_properties_weights: {
        TmNN: { value: "1", comment: "melting temperature" },
        GC_content: { value: "1", comment: "GC content" }
    },
    n_bits: { value: "16", comment: "number of bits contained in each barcode" },
    min_hamming_dist: { value: "4", comment: "minimum distance between two valid barcodes" },
    hamming_weight: { value: "4", comment: "number of bits containing one in each barcode" },
    channels_ids: { value: ["Alexa488, Cy3b, Alexa647"], comment: "names of fluorescent channels" },
    files_fasta_reference_database_primer: { value: ["data/genomic_regions/exon_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna, data/genomic_regions/exon_exon_junction_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"], comment: "fasta file with sequences used as reference for the specificity filters. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest" },
    reverse_primer_sequence: { value: "CCCTATAGTGAGTCGTATTA", comment: "defaults to reverse complement of 20 nt T7 promoter sequence, change if different sequence desired" },
    primer_length: { value: "20", comment: "length of forward primer" },
    primer_base_probabilities: {
        A: { value: "0.25", comment: "" },
        C: { value: "0.25", comment: "" },
        G: { value: "0.25", comment: "" },
        T: { value: "0.25", comment: "" }
    },
    primer_GC_content_min: { value: "50", comment: "minimum GC content of oligos" },
    primer_GC_content_max: { value: "65", comment: "maximum GC content of oligos" },
    primer_number_GC_GCclamp: { value: "1", comment: "" },
    primer_number_three_prime_base_GCclamp: { value: "2", comment: "" },
    primer_homopolymeric_base_n: {
        A: { value: "4", comment: "" },
        T: { value: "4", comment: "" },
        C: { value: "4", comment: "" },
        G: { value: "4", comment: "" }
    },
    primer_max_len_selfcomplement: { value: "6", comment: "" },
    primer_max_len_complement_reverse_primer: { value: "5", comment: "" },
    primer_Tm_min: { value: "60", comment: "" },
    primer_Tm_max: { value: "75", comment: "" },
    primer_T_secondary_structure: { value: "76", comment: "Temperature at which the free energy is calculated" },
    primer_secondary_structures_threshold_deltaG: { value: "0", comment: "threshold for the secondary structure free energy -> oligo rejected if it presents a structure with a negative free energy at the defined temperature" },
    target_probe_specificity_blastn_search_parameters: {
        perc_identity: { value: "80", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed, if reference is whole genome, consider using \"both\"" },
        word_size: { value: "10", comment: "" },
        dust: { value: "no", comment: "" },
        soft_masking: { value: "false", comment: "" },
        max_target_seqs: { value: "10", comment: "" },
        max_hsps: { value: "1000", comment: "" }
    },
    target_probe_specificity_blastn_hit_parameters: {
        min_alignment_length: { value: "17", comment: "can be turned into coverage" }
    },
    target_probe_cross_hybridization_blastn_search_parameters: {
        perc_identity: { value: "80", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed" },
        word_size: { value: "7", comment: "" },
        dust: { value: "no", comment: "" },
        soft_masking: { value: "false", comment: "" },
        max_target_seqs: { value: "10", comment: "" }
    },
    target_probe_cross_hybridization_blastn_hit_parameters: {
        min_alignment_length: { value: "17", comment: "can be turned into coverage" }
    },
    max_graph_size: { value: "5000", comment: "maximum number of oligos that are taken into consisderation in the last step (5000 -> ~5GB, 2500 -> ~1GB)" },
    n_attempts: { value: "100000", comment: "number of attempts to find the optimal set of oligos" },
    heuristic: { value: "true", comment: "apply heuristic pre-search to reduce search space and runtime of oligo set selection" },
    heuristic_n_attempts: { value: "100", comment: "number of attempts to find the optimal set of oligos for heuristic pre-search" },
    target_probe_Tm_parameters: {
        nn_table: { value: "DNA_NN4", comment: "S antaLucia (2004) taken from Moffitt (2016)" },
        tmm_table: { value: "DNA_TMM1", comment: "default" },
        imm_table: { value: "DNA_IMM1", comment: "default" },
        de_table: { value: "DNA_DE1", comment: "default" },
        dnac1: { value: "5", comment: "[nM] taken from Moffitt (2016)" },
        dnac2: { value: "0", comment: "[nM] taken from Moffitt (2016)" },
        saltcorr: { value: "5", comment: "correction for deltaS, taken from https://github.com/ZhuangLab/MERFISH_analysis" },
        Na: { value: "300", comment: "[mM] 0.3M, taken from https://github.com/ZhuangLab/MERFISH_analysis" },
        K: { value: "0", comment: "[mM] default" },
        Tris: { value: "0", comment: "[mM] default" },
        Mg: { value: "0", comment: "[mM] default" },
        dNTPs: { value: "0", comment: "[mM] default" }
    },
    target_probe_Tm_chem_correction_parameters: { value: "None", comment: "if chem correction desired, please add parameters below" },
    target_probe_Tm_salt_correction_parameters: { value: "None", comment: "if salt correction desired, please add parameters below" },
    readout_probe_initial_num_sequences: { value: "100000", comment: "if not enough readout probes can be generated, increase this number" },
    readout_probe_specificity_blastn_search_parameters: {
        perc_identity: { value: "100", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed, if reference is whole genome, consider using \"both\"" },
        word_size: { value: "7", comment: "" },
        dust: { value: "no", comment: "" },
        soft_masking: { value: "false", comment: "" },
        max_target_seqs: { value: "10", comment: "" },
        max_hsps: { value: "1000", comment: "" }
    },
    readout_probe_specificity_blastn_hit_parameters: {
        min_alignment_length: { value: "11", comment: "can be turned into coverage" }
    },
    readout_probe_cross_hybridization_blastn_search_parameters: {
        perc_identity: { value: "100", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed" },
        word_size: { value: "7", comment: "" },
        dust: { value: "no", comment: "" },
        soft_masking: { value: "false", comment: "" },
        max_target_seqs: { value: "10", comment: "" }
    },
    readout_probe_cross_hybridization_blastn_hit_parameters: {
        min_alignment_length: { value: "11", comment: "can be turned into coverage" }
    },
    readout_probe_Tm_parameters: {
        nn_table: { value: "DNA_NN4", comment: "S antaLucia (2004) taken from Moffitt (2016)" },
        tmm_table: { value: "DNA_TMM1", comment: "default" },
        imm_table: { value: "DNA_IMM1", comment: "default" },
        de_table: { value: "DNA_DE1", comment: "default" },
        dnac1: { value: "25", comment: "default" },
        dnac2: { value: "25", comment: "default" },
        saltcorr: { value: "5", comment: "correction for deltaS, taken from https://github.com/ZhuangLab/MERFISH_analysis" },
        Na: { value: "300", comment: "[mM] 0.3M, taken from https://github.com/ZhuangLab/MERFISH_analysis" },
        K: { value: "0", comment: "[mM] default" },
        Tris: { value: "0", comment: "[mM] default" },
        Mg: { value: "0", comment: "[mM] default" },
        dNTPs: { value: "0", comment: "[mM] default" }
    },
    readout_probe_Tm_chem_correction_parameters: { value: "None", comment: "if chem correction desired, please add parameters below" },
    readout_probe_Tm_salt_correction_parameters: { value: "None", comment: "if salt correction desired, please add parameters below" },
    readout_probe_n_combinations: { value: "100000", comment: "number of random combinations of readout probe sets to iteratte through" },
    primer_initial_num_sequences: { value: "1000000", comment: "if no primer can be generated, increase this number" },
    primer_specificity_refrence_blastn_search_parameters: {
        perc_identity: { value: "100", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed, if reference is whole genome, consider using \"both\"" },
        word_size: { value: "7", comment: "" },
        dust: { value: "no", comment: "" },
        soft_masking: { value: "false", comment: "" },
        max_target_seqs: { value: "10", comment: "" },
        max_hsps: { value: "1000", comment: "" }
    },
    primer_specificity_refrence_blastn_hit_parameters: {
        min_alignment_length: { value: "14", comment: "can be turned into coverage" }
    },
    primer_specificity_encoding_probes_blastn_search_parameters: {
        perc_identity: { value: "100", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed, if reference is whole genome, consider using \"both\"" },
        word_size: { value: "7", comment: "" },
        dust: { value: "no", comment: "" },
        soft_masking: { value: "false", comment: "" },
        max_target_seqs: { value: "10", comment: "" },
        max_hsps: { value: "1000", comment: "" }
    },
    primer_specificity_encoding_probes_blastn_hit_parameters: {
        min_alignment_length: { value: "11", comment: "can be turned into coverage" }
    },
    primer_Tm_parameters: {
        nn_table: { value: "DNA_NN4", comment: "S antaLucia (2004) taken from Moffitt (2016)" },
        tmm_table: { value: "DNA_TMM1", comment: "default" },
        imm_table: { value: "DNA_IMM1", comment: "default" },
        de_table: { value: "DNA_DE1", comment: "default" },
        dnac1: { value: "250", comment: "[nM] taken from https://github.com/ZhuangLab/MERFISH_analysis" },
        dnac2: { value: "250", comment: "[nM] taken from https://github.com/ZhuangLab/MERFISH_analysis" },
        saltcorr: { value: "5", comment: "correction for deltaS, taken from https://github.com/ZhuangLab/MERFISH_analysis" },
        Na: { value: "300", comment: "[mM] 0.3M, taken from https://github.com/ZhuangLab/MERFISH_analysis" },
        K: { value: "0", comment: "[mM] default" },
        Tris: { value: "0", comment: "[mM] default" },
        Mg: { value: "0", comment: "[mM] default" },
        dNTPs: { value: "0", comment: "[mM] default" }
    },
    primer_Tm_chem_correction_parameters: { value: "None", comment: "if chem correction desired, please add parameters below" },
    primer_Tm_salt_correction_parameters: { value: "None", comment: "if salt correction desired, please add parameters below" }
};

export default formDatas;