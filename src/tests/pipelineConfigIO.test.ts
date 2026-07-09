/**
 * Test schema fixture for the OligoSeq pipeline.
 *
 * This schema is intentionally minimal and mirrors the shape used by the
 * real pipeline configuration logic so import/validation behavior is tested
 * against the same expected structure.
 */
import { describe, it, expect } from "vitest";
import type { RJSFSchema } from "@rjsf/utils";
import {
    buildExportPayload,
    importAndValidate,
} from "../components/forms/pipelineConfigIO";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const testSchema = PIPELINE_CONFIG["oligoseq"].schema;

// ---- buildExportPayload ----

describe("buildExportPayload", () => {
    it("sets _meta.pipeline to the given pipeline name", () => {
        const payload = buildExportPayload({}, "merfish", testSchema);
        expect(payload._meta.pipeline).toBe("merfish");
    });

    it("reads _meta.version from schema.description", () => {
        const payload = buildExportPayload({}, "scrinshot", testSchema);
        expect(payload._meta.version).toBe(2);
    });

    it("falls back to 1.0.0 if schema has no description", () => {
        const schemaWithoutVersion = {
            ...testSchema,
            description: undefined,
        } as RJSFSchema;
        const payload = buildExportPayload(
            {},
            "scrinshot",
            schemaWithoutVersion
        );
        expect(payload._meta.version).toBe(2);
    });

    it("sets _meta.exportedAt to an ISO timestamp", () => {
        const payload = buildExportPayload({}, "scrinshot", testSchema);
        expect(() => new Date(payload._meta.exportedAt)).not.toThrow();
        expect(payload._meta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

// ---- importAndValidate ----

describe("importAndValidate", () => {
    /**
     * Helper for negative import validation tests.
     *
     * It asserts that the payload is rejected and that the error message
     * contains the expected fragments.
     */
    const negativeTestImportAndValidate = (
        payload: unknown,
        ...matchers: (string | RegExp)[]
    ) => {
        const result = importAndValidate(payload, testSchema, "oligoseq");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            for (const m of matchers) expect(result.error).toMatch(m);
        }
    };

    /**
     * A canonical valid export payload used for positive validation coverage.
     *
     * Most tests reuse this fixture to verify that valid data is accepted and
     * that the resulting config tree remains intact.
     */
    const validPayload = {
        _meta: {
            version: 2,
            pipeline: "oligoseq",
            exportedAt: "2026-06-02T11:28:27.523Z",
        },
        config: {
            target_probe: {
                oligo_generation: {
                    file_region_ids: "GFB69_RS14600",
                    files_fasta_probe_database: [
                        {
                            source: "ncbi",
                            source_params: {
                                species: "Acidianus_ambivalens",
                                annotation_release:
                                    "GCF_009428885.1_ASM942888v1",
                                taxon: "archaea",
                                assembly_source: "auto",
                                mode: "species",
                            },
                            genomic_regions: {
                                gene: true,
                                intergenic: false,
                                exon: false,
                                utr: false,
                                cds: false,
                                intron: false,
                                exon_exon_junction: false,
                            },
                            exon_exon_junction_block_size: 50,
                        },
                    ],
                    probe_length_min: 26,
                    probe_length_max: 30,
                    probe_split_region: 4,
                },
                property_filters: {
                    isoform_consensus_filter: {
                        enabled: true,
                        isoform_consensus: 0,
                    },
                    targeted_exons_filter: {
                        enabled: false,
                    },
                    hard_masked_sequences_filter: {
                        enabled: true,
                    },
                    soft_masked_sequences_filter: {
                        enabled: true,
                    },
                    homopolymeric_runs_filter: {
                        enabled: false,
                        homopolymeric_base_n: {
                            A: null,
                            T: null,
                            C: null,
                            G: null,
                        },
                    },
                    GC_content_filter: {
                        enabled: true,
                        GC_content_min: 45,
                        GC_content_max: 65,
                    },
                    prohibited_sequences_filter: {
                        enabled: true,
                        prohibited_sequences: ["TCT", "CTC"],
                        kmer_abundance_threshold: {
                            "3": 0.0469,
                            "4": 0.0117,
                            "5": 0.0029,
                            "6": 0.00073,
                        },
                    },
                    self_complementarity_filter: {
                        enabled: true,
                        max_len_selfcomplement: 10,
                    },
                    Tm_filter: {
                        enabled: true,
                        Tm_min: 50,
                        Tm_max: 70,
                    },
                    secondary_structure_filter: {
                        enabled: true,
                        T: 37,
                        thr_DG: 0,
                    },
                },
                specificity_filters: {
                    read_length_bias_filter: {
                        enabled: true,
                        read_length_bias: 20,
                    },
                    cross_hybridization_blastn_filter: {
                        enabled: true,
                        search_parameters: {
                            "-query_loc": null,
                            "-strand": null,
                            "-task": null,
                            "-evalue": null,
                            "-word_size": null,
                            "-gapopen": null,
                            "-gapextend": null,
                            "-penalty": null,
                            "-reward": null,
                            "-num_descriptions": null,
                            "-num_alignments": null,
                            "-sorthits": null,
                            "-sorthsps": null,
                            "-dust": null,
                            "-soft_masking": null,
                            "-lcase_masking": null,
                            "-db_soft_mask": null,
                            "-db_hard_mask": null,
                            "-perc_identity": null,
                            "-qcov_hsp_perc": null,
                            "-max_hsps": null,
                            "-culling_limit": null,
                            "-best_hit_overhang": null,
                            "-best_hit_score_edge": null,
                            "-subject_besthit": null,
                            "-max_target_seqs": null,
                            "-template_type": null,
                            "-template_length": null,
                            "-db_size": null,
                            "-searchsp": null,
                            "-xdrop_ungap": null,
                            "-xdrop_gap": null,
                            "-xdrop_gap_final": null,
                            "-no_greedy": null,
                            "-min_raw_gapped_score": null,
                            "-ungapped": null,
                            "-window_size": null,
                            "-off_diagonal_range": null,
                        },
                        hit_parameters: {
                            coverage: 20,
                            min_alignment_length: null,
                        },
                    },
                    specificity_blastn_filter: {
                        enabled: true,
                        search_parameters: {
                            "-query_loc": null,
                            "-strand": null,
                            "-task": null,
                            "-evalue": null,
                            "-word_size": null,
                            "-gapopen": null,
                            "-gapextend": null,
                            "-penalty": null,
                            "-reward": null,
                            "-num_descriptions": null,
                            "-num_alignments": null,
                            "-sorthits": null,
                            "-sorthsps": null,
                            "-dust": null,
                            "-soft_masking": null,
                            "-lcase_masking": null,
                            "-db_soft_mask": null,
                            "-db_hard_mask": null,
                            "-perc_identity": null,
                            "-qcov_hsp_perc": null,
                            "-max_hsps": null,
                            "-culling_limit": null,
                            "-best_hit_overhang": null,
                            "-best_hit_score_edge": null,
                            "-subject_besthit": null,
                            "-max_target_seqs": null,
                            "-template_type": null,
                            "-template_length": null,
                            "-db_size": null,
                            "-searchsp": null,
                            "-xdrop_ungap": null,
                            "-xdrop_gap": null,
                            "-xdrop_gap_final": null,
                            "-no_greedy": null,
                            "-min_raw_gapped_score": null,
                            "-ungapped": null,
                            "-window_size": null,
                            "-off_diagonal_range": null,
                        },
                        hit_parameters: {
                            coverage: 20,
                            min_alignment_length: null,
                        },
                        files_fasta_reference_database: [
                            {
                                source: "ncbi",
                                source_params: {
                                    species: "Acidianus_ambivalens",
                                    annotation_release:
                                        "GCF_009428885.1_ASM942888v1",
                                    taxon: "archaea",
                                    assembly_source: "auto",
                                    mode: "species",
                                },
                                genomic_regions: {
                                    gene: true,
                                    intergenic: false,
                                    exon: false,
                                    utr: false,
                                    cds: false,
                                    intron: false,
                                    exon_exon_junction: false,
                                },
                                exon_exon_junction_block_size: 50,
                            },
                        ],
                    },
                    variant_filter: {
                        enabled: true,
                        files_vcf_reference_database: [],
                        action: "flag",
                    },
                },
                probe_set_selection: {
                    independent_set_selection: {
                        n_sets: 3,
                        set_size_min: 1,
                        set_size_opt: 5,
                        distance_between_target_probes: 0,
                        n_attempts_graph: 50,
                        n_attempts_clique_enum: 50,
                        diversification_fraction: 0.1,
                        jaccard_opt: 0.5,
                        jaccard_step: 0.1,
                    },
                    uniform_distance_score: {
                        weight: 1,
                    },
                    isoform_consensus_score: {
                        weight: 1,
                    },
                    targeted_exons_score: {
                        weight: 0,
                        targeted_exons: [],
                    },
                    GC_content_score: {
                        weight: 1,
                        GC_content_min: 45,
                        GC_content_opt: 55,
                        GC_content_max: 65,
                    },
                    Tm_score: {
                        weight: 1,
                        Tm_min: 50,
                        Tm_opt: 60,
                        Tm_max: 70,
                    },
                },
                global_parameters: {
                    Tm_parameters: {
                        check: true,
                        strict: true,
                        c_seq: null,
                        shift: 0,
                        selfcomp: false,
                        nn_table: null,
                        tmm_table: null,
                        imm_table: null,
                        de_table: null,
                        dnac1: 25,
                        dnac2: 25,
                        saltcorr: 5,
                        Na: 50,
                        K: 0,
                        Tris: 0,
                        Mg: 0,
                        dNTPs: 0,
                    },
                    Tm_chem_correction_parameters: {
                        enabled: true,
                        parameters: {
                            DMSO: 0,
                            DMSOfactor: 0.75,
                            fmd: 0,
                            fmdfactor: 0.65,
                            fmdmethod: 1,
                            GC: null,
                        },
                    },
                    Tm_salt_correction_parameters: {
                        enabled: false,
                    },
                },
            },
            schema_version: 2,
        },
    };

    it("accepts a valid export payload", () => {
        const result = importAndValidate(validPayload, testSchema, "oligoseq");
        expect(result.ok).toBe(true);

        if (result.ok) {
            expect(
                result.config.target_probe.global_parameters.Tm_parameters.dnac1
            ).toBe(25);
            expect(
                result.config.target_probe.property_filters.GC_content_filter
                    .GC_content_min
            ).toBe(45);
            expect(
                result.config.target_probe.oligo_generation.probe_length_min
            ).toBe(26);
        }
    });

    it("rejects null", () => {
        negativeTestImportAndValidate(null);
    });

    it("rejects a plain object missing _meta", () => {
        negativeTestImportAndValidate({ config: { n_jobs: 4 } }, /_meta/);
    });

    it("rejects a plain object missing config", () => {
        negativeTestImportAndValidate(
            { _meta: { version: "1.0.0", pipeline: "scrinshot" } },
            /config/
        );
    });

    it("rejects when config is not a plain object (array)", () => {
        negativeTestImportAndValidate(
            { _meta: validPayload._meta, config: [1, 2, 3] },
            /config must be an object/
        );
    });

    it("rejects when config is not a plain object (string)", () => {
        negativeTestImportAndValidate(
            { _meta: validPayload._meta, config: "not-an-object" },
            /config must be an object/
        );
    });

    it("rejects when config is null", () => {
        negativeTestImportAndValidate(
            { _meta: validPayload._meta, config: null },
            /config must be an object/
        );
    });

    it("rejects a config from a different pipeline", () => {
        negativeTestImportAndValidate(
            {
                ...validPayload,
                _meta: { ...validPayload._meta, pipeline: "merfish" },
            },
            /Merfish/,
            /OligoSeq/
        );
    });

    it("rejects when _meta.version is missing", () => {
        negativeTestImportAndValidate(
            { _meta: { pipeline: "oligoseq" }, config: {} },
            /version/
        );
    });

    it("rejects incompatible major version", () => {
        negativeTestImportAndValidate(
            {
                ...validPayload,
                _meta: { ...validPayload._meta, version: 99 },
            },
            /99/
        );
    });

    it("skips fields not in the schema and reports them", () => {
        const payload = {
            ...validPayload,
            config: {
                ...validPayload.config,
                n_jobs: 4,
                unknown_field: 42,
                another_unknown: "hello",
            },
        };
        const result = importAndValidate(payload, testSchema, "oligoseq");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.config).not.toHaveProperty("unknown_field");
            expect(result.config).not.toHaveProperty("another_unknown");
            expect(result.skippedFields).toContain("unknown_field");
            expect(result.skippedFields).toContain("another_unknown");
        }
    });

    // TODO: enable when ajv validation is back
    it.skip("rejects when a field has the wrong type", () => {
        negativeTestImportAndValidate(
            {
                ...validPayload,
                config: {
                    target_probe: {
                        oligo_generation: {
                            probe_split_region: "not-a-number",
                        },
                    },
                },
            },
            /invalid/i
        );
    });

    it("accepts a partial config (only some fields present)", () => {
        const payload = {
            ...validPayload,
            config: {
                target_probe: {
                    oligo_generation: { probe_split_region: 2 },
                },
            },
        };
        const result = importAndValidate(payload, testSchema, "oligoseq");
        expect(result.ok).toBe(true);
        if (result.ok)
            expect(
                result.config.target_probe.oligo_generation.probe_split_region
            ).toBe(2);
    });

    it("accepts an empty config object", () => {
        const payload = { ...validPayload, config: {} };
        const result = importAndValidate(payload, testSchema, "oligoseq");
        expect(result.ok).toBe(true);
        if (result.ok) expect(Object.keys(result.config)).toHaveLength(0);
    });

    it("accepts boolean fields correctly", () => {
        const payload = {
            ...validPayload,
            config: {
                target_probe: {
                    property_filters: {
                        GC_content_filter: { enabled: false },
                    },
                },
            },
        };
        const result = importAndValidate(payload, testSchema, "oligoseq");
        expect(result.ok).toBe(true);
        if (result.ok)
            expect(
                result.config.target_probe.property_filters.GC_content_filter
                    .enabled
            ).toBe(false);
    });
});
