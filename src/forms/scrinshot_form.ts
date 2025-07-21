const formDatas = {
    n_jobs: { value: "4", comment: "number of cores used to run the pipeline and 2*n_jobs +1 of regions that should be stored in cache. If memory consumption of pipeline is too high reduce this number, if a lot of RAM is available increase this number to decrease runtime" },
    dir_output: { value: "output_scrinshot_probe_designer", comment: "name of the directory where the output files will be written" },
    write_intermediate_steps: { value: "true", comment: "if true, writes the oligo sequences after each step of the pipeline into a csv file" },
    top_n_sets: { value: "3", comment: "maximum number of sets to report in padlock_probes.yaml and \"padlock_probes_order.yaml\"" },
    file_regions: { value: "", comment: "file with a list the genes used to generate the oligos sequences, leave empty if all the genes are used" },
    files_fasta_target_probe_database: { value: "", comment: "fasta file with sequences form which the probes should be generated. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest" },
    files_fasta_reference_database_target_probe: { value: "", comment: "fasta file with sequences used as reference for the specificity filters. Hint: use the genomic_region_generator pipeline to create fasta files of genomic regions of interest" },
    target_probe_length_min: { value: "40", comment: "min length of probe" },
    target_probe_length_max: { value: "45", comment: "max length of probe" },
    target_probe_isoform_consensus: { value: "50", comment: "min isoform consesnsus for probes, i.e. how many transcripts of the total number of transcripts of a gene are covered by the probe, given in %" },
    target_probe_GC_content_min: { value: "40", comment: "minimum GC content of oligos" },
    target_probe_GC_content_opt: { value: "50", comment: "max and min values are defiend above" },
    target_probe_GC_content_max: { value: "60", comment: "maximum GC content of oligos" },
    target_probe_Tm_min: { value: "65", comment: "minimum GC content of oligos" },
    target_probe_Tm_opt: { value: "70", comment: "max and min values are defiend above" },
    target_probe_Tm_max: { value: "75", comment: "maximum GC content of oligos" },
    target_probe_homopolymeric_base_n: {
        A: { value: "5", comment: "" },
        T: { value: "5", comment: "" },
        C: { value: "5", comment: "" },
        G: { value: "5", comment: "" }
    },
    target_probe_padlock_arm_Tm_dif_max: { value: "2", comment: "maximum melting temperature difference of both arms (difference shouldn't be higher than 5! But range is not super important, the lower the better)" },
    target_probe_padlock_arm_length_min: { value: "10", comment: "minimum length of each arm" },
    target_probe_padlock_arm_Tm_min: { value: "50", comment: "minimum melting temperature of each arm" },
    target_probe_padlock_arm_Tm_max: { value: "60", comment: "maximum melting temperature of each arm" },
    target_probe_ligation_region_size: { value: "5", comment: "size of the seed region around the ligation site for blast seed region filter; set to 0 if ligation region should not be considered for blast search" },
    target_probe_isoform_weight: { value: "2", comment: "weight of the isoform consensus of the probe in the efficiency score" },
    target_probe_GC_weight: { value: "1", comment: "weight of the GC content of the probe in the efficiency score" },
    target_probe_Tm_weight: { value: "1", comment: "weight of the Tm of the probe in the efficiency score" },
    set_size_min: { value: "3", comment: "minimum size of probe sets (in case there exist no set of the optimal size) -> genes with less oligos will be filtered out and stored in regions_with_insufficient_oligos_for_db_probes" },
    set_size_opt: { value: "5", comment: "optimal size of probe sets" },
    distance_between_target_probes: { value: "0", comment: "how much overlap should be allowed between oligos, e.g. if oligos can overlpap x bases choose -x, if oligos can be next to one another choose 0, if oligos should be x bases apart choose x" },
    n_sets: { value: "100", comment: "maximum number of sets to generate" },
    detection_oligo_min_thymines: { value: "2", comment: "minimal number of Thymines in detection oligo." },
    detection_oligo_length_min: { value: "15", comment: "minimum length of detection probe" },
    detection_oligo_length_max: { value: "40", comment: "maximum length of detection probe" },
    detection_oligo_U_distance: { value: "5", comment: "preferred minimal distance between U(racils)" },
    detection_oligo_Tm_opt: { value: "56", comment: "optimal melting temperature of detection probe" },
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
        coverage: { value: "50", comment: "can be turned into min_alignment_length" }
    },
    target_probe_cross_hybridization_blastn_search_parameters: {
        perc_identity: { value: "80", comment: "the higher the percent identity is, the more significant the match" },
        strand: { value: "minus", comment: "this parameter is fixed" },
        word_size: { value: "10", comment: "" },
        dust: { value: "no", comment: "" },
        soft_masking: { value: "false", comment: "" },
        max_target_seqs: { value: "10", comment: "" }
    },
    target_probe_cross_hybridization_blastn_hit_parameters: {
        coverage: { value: "80", comment: "can be turned into min_alignment_length" }
    },
    max_graph_size: { value: "5000", comment: "maximum number of oligos that are taken into consisderation in the last step (5000 -> ~5GB, 2500 -> ~1GB)" },
    n_attempts: { value: "100000", comment: "number of attempts to find the optimal set of oligos" },
    heuristic: { value: "true", comment: "apply heuristic pre-search to reduce search space and runtime of oligo set selection" },
    heuristic_n_attempts: { value: "100", comment: "number of attempts to find the optimal set of oligos for heuristic pre-search" },
    target_probe_Tm_parameters: {
        nn_table: { value: "DNA_NN3", comment: "Allawi & SantaLucia (1997)" },
        tmm_table: { value: "DNA_TMM1", comment: "default" },
        imm_table: { value: "DNA_IMM1", comment: "default" },
        de_table: { value: "DNA_DE1", comment: "default" },
        dnac1: { value: "50", comment: "[nM]" },
        dnac2: { value: "0", comment: "[nM]" },
        saltcorr: { value: "7", comment: "Owczarzy et al. (2008)" },
        Na: { value: "39", comment: "[mM]" },
        K: { value: "75", comment: "[mM]" },
        Tris: { value: "20", comment: "[mM]" },
        Mg: { value: "10", comment: "[mM]" },
        dNTPs: { value: "0", comment: "[mM] default" }
    },
    target_probe_Tm_chem_correction_parameters: {
        DMSO: { value: "0", comment: "default" },
        DMSOfactor: { value: "0.75", comment: "default" },
        fmd: { value: "20", comment: "" },
        fmdfactor: { value: "0.65", comment: "default" },
        fmdmethod: { value: "1", comment: "default" },
        GC: { value: "None", comment: "default" }
    },
    target_probe_Tm_salt_correction_parameters: { value: "None", comment: "if salt correction desired, please add parameters below" },
    detection_oligo_Tm_parameters: {
        nn_table: { value: "DNA_NN3", comment: "Allawi & SantaLucia (1997)" },
        tmm_table: { value: "DNA_TMM1", comment: "default" },
        imm_table: { value: "DNA_IMM1", comment: "default" },
        de_table: { value: "DNA_DE1", comment: "default" },
        dnac1: { value: "50", comment: "[nM]" },
        dnac2: { value: "0", comment: "[nM]" },
        saltcorr: { value: "7", comment: "Owczarzy et al. (2008)" },
        Na: { value: "39", comment: "[mM]" },
        K: { value: "0", comment: "[mM] default" },
        Tris: { value: "0", comment: "[mM] default" },
        Mg: { value: "0", comment: "[mM] default" },
        dNTPs: { value: "0", comment: "[mM] default" }
    },
    detection_oligo_Tm_chem_correction_parameters: {
        DMSO: { value: "0", comment: "default" },
        DMSOfactor: { value: "0.75", comment: "default" },
        fmd: { value: "30", comment: "" },
        fmdfactor: { value: "0.65", comment: "default" },
        fmdmethod: { value: "1", comment: "default" },
        GC: { value: "None", comment: "default" }
    },
    detection_oligo_Tm_salt_correction_parameters: { value: "None", comment: "if salt correction desired, please add parameters below" }
};

export default formDatas;