const formDatas = {
    n_jobs: { value: "4", comment: "number of cores used to run the pipeline and 2*n_jobs +1 of regions that should be stored in cache. If memory consumption of pipeline is too high reduce this number, if a lot of RAM is available increase this number to decrease runtime" },
    dir_output: { value: "output_oligo_seq_probe_designer", comment: "name of the directory where the output files will be written" },
    write_intermediate_steps: { value: "true", comment: "if true, saves intermediate results after each step" },
    top_n_sets: { value: "3", comment: "maximum number of sets to report in padlock_probes.yaml and \"padlock_probes_order.yaml\"" },
    file_regions: { value: "", comment: "file with a list the genes used to generate the oligos sequences, leave empty if all the genes are used" },
    files_fasta_target_probe_database: { value: "", comment: "fasta file with sequences form which the oligos should be generated. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest" },
    files_fasta_reference_database_target_probe: { value: "", comment: "fasta file with sequences used as reference for the specificity filters. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest" },
    target_probe_length_min: { value: "26", comment: "min length of oligos" },
    target_probe_length_max: { value: "30", comment: "max length of oligos" },
    target_probe_split_region: { value: "4", comment: "Minimum number of bases covering the exon junction, i.e. the oligo should contain at least x bases upstream/downstream of the junction." },
    target_probe_targeted_exons: { value: ["1, 2, 3"], comment: "" },
    target_probe_isoform_consensus: { value: "0", comment: "min isoform consesnsus for oligos, i.e. how many transcripts of the total number of transcripts of a gene are covered by the oligo, given in %" },
    target_probe_GC_content_min: { value: "45", comment: "minimum GC content of oligos" },
    target_probe_GC_content_opt: { value: "55", comment: "max and min values are defiend above" },
    target_probe_GC_content_max: { value: "65", comment: "maximum GC content of oligos" },
    target_probe_Tm_min: { value: "50", comment: "minimum melting temperature of oligos" },
    target_probe_Tm_opt: { value: "60", comment: "max and min values are defiend above" },
    target_probe_Tm_max: { value: "70", comment: "maximum melting temperature of oligos" },
    target_probe_secondary_structures_T: { value: "37", comment: "temperature to compute the secondary structure free energy" },
    target_probe_secondary_structures_threshold_deltaG: { value: "0", comment: "threshold for the secondary structure free energy -> oligo rejected if it presents a structure with a negative free energy at the defined temperature" },
    target_probe_homopolymeric_base_n: {
        A: { value: "6", comment: "" },
        T: { value: "6", comment: "" },
        C: { value: "6", comment: "" },
        G: { value: "6", comment: "" }
    },
    target_probe_max_len_selfcomplement: { value: "10", comment: "The maximum length of self-complementary sequence allowed to avoid homodimer formation." },
    target_probe_hybridization_probability_threshold: { value: "0.001", comment: "the lower the threshold the more stringent the filter" },
    target_probe_GC_weight: { value: "1", comment: "weight of the GC content of the probe in the efficiency score" },
    target_probe_Tm_weight: { value: "1", comment: "weight of the Tm of the probe in the efficiency score" },
    set_size_min: { value: "3", comment: "minimum size of oligo sets (in case there exist no set of the optimal size) -> genes with less oligos will be filtered out and stored in regions_with_insufficient_oligos_for_db_probes" },
    set_size_opt: { value: "5", comment: "optimal size of oligo sets" },
    distance_between_target_probes: { value: "0", comment: "how much overlap should be allowed between oligos, e.g. if oligos can overlpap x bases choose -x, if oligos can be next to one another choose 0, if oligos should be x bases apart choose x" },
    n_sets: { value: "100", comment: "Maximum number of sets to report" },
    target_probe_hybridization_probability_alignment_method: { value: "blastn", comment: "options: blastn, bowtie" },
    target_probe_hybridization_probability_blastn_search_parameters: {
        perc_identity: { value: "80", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed, if reference is whole genome, consider using \"both\"" },
        word_size: { value: "10", comment: "" }
    },
    target_probe_hybridization_probability_blastn_hit_parameters: {
        coverage: { value: "50", comment: "could be turned into min_alignment_length" }
    },
    target_probe_hybridization_probability_bowtie_search_parameters: {
        v: { value: "3", comment: "" },
        nofw: { value: "", comment: "this parameter is fixed, if reference is whole genome, consider using both strands (remove this parameter)" }
    },
    target_probe_hybridization_probability_bowtie_hit_parameters: { value: "None", comment: "No hit parameters available currently" },
    target_probe_cross_hybridization_alignment_method: { value: "blastn", comment: "options: blastn, bowtie" },
    target_probe_cross_hybridization_blastn_search_parameters: {
        perc_identity: { value: "80", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed" },
        word_size: { value: "10", comment: "" }
    },
    target_probe_cross_hybridization_blastn_hit_parameters: {
        coverage: { value: "50", comment: "could be turned into min_alignment_length" }
    },
    target_probe_cross_hybridization_bowtie_search_parameters: {
        v: { value: "3", comment: "" },
        nofw: { value: "", comment: "this parameter is fixed" }
    },
    target_probe_cross_hybridization_bowtie_hit_parameters: { value: "None", comment: "No hit parameters available currently" },
    max_graph_size: { value: "5000", comment: "maximum number of oligos that are taken into consisderation in the last step (5000 -> ~5GB, 2500 -> ~1GB)" },
    n_attempts: { value: "100000", comment: "number of attempts to find the optimal set of oligos" },
    heuristic: { value: "true", comment: "apply heuristic pre-search to reduce search space and runtime of oligo set selection" },
    heuristic_n_attempts: { value: "100", comment: "number of attempts to find the optimal set of oligos for heuristic pre-search" },
    target_probe_Tm_parameters: {
        nn_table: { value: "DNA_NN3", comment: "" },
        tmm_table: { value: "DNA_TMM1", comment: "" },
        imm_table: { value: "DNA_IMM1", comment: "" },
        de_table: { value: "DNA_DE1", comment: "" },
        dnac1: { value: "50", comment: "[nM]" },
        dnac2: { value: "0", comment: "[nM]" },
        saltcorr: { value: "7", comment: "" },
        Na: { value: "1000", comment: "[mM] #1M from probeArray paper" },
        K: { value: "0", comment: "[mM]" },
        Tris: { value: "0", comment: "[mM]" },
        Mg: { value: "0", comment: "[mM]" },
        dNTPs: { value: "0", comment: "[mM]" }
    },
    target_probe_Tm_chem_correction_parameters: {
        DMSO: { value: "0", comment: "" },
        DMSOfactor: { value: "0.75", comment: "" },
        fmd: { value: "20", comment: "" },
        fmdfactor: { value: "0.65", comment: "" },
        fmdmethod: { value: "1", comment: "" },
        GC: { value: "None", comment: "" }
    },
    target_probe_Tm_salt_correction_parameters: { value: "None", comment: "if salt correction desired, please add parameters below" }
};

export default formDatas;