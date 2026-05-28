import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RJSFSchema } from "@rjsf/utils";
import {
    buildExportPayload,
    triggerDownload,
    importAndValidate,
} from "../components/forms/pipelineConfigIO";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

// Minimal schema that mirrors the real pipeline schemas
const testSchema = PIPELINE_CONFIG["scrinshot"].schema;

// ---- buildExportPayload ----

describe("buildExportPayload", () => {
    it("sets _meta.pipeline to the given pipeline name", () => {
        const payload = buildExportPayload({}, "merfish", testSchema);
        expect(payload._meta.pipeline).toBe("merfish");
    });

    it("reads _meta.version from schema.description", () => {
        const payload = buildExportPayload({}, "scrinshot", testSchema);
        expect(payload._meta.version).toBe("1.0.0");
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
        expect(payload._meta.version).toBe("1.0.0");
    });

    it("sets _meta.exportedAt to an ISO timestamp", () => {
        const payload = buildExportPayload({}, "scrinshot", testSchema);
        expect(() => new Date(payload._meta.exportedAt)).not.toThrow();
        expect(payload._meta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

// ---- triggerDownload ----

describe("triggerDownload", () => {
    beforeEach(() => {
        // Mock URL and DOM APIs used by triggerDownload
        vi.stubGlobal("URL", {
            createObjectURL: vi.fn(() => "blob:mock-url"),
            revokeObjectURL: vi.fn(),
        });
        const mockLink = {
            href: "",
            download: "",
            click: vi.fn(),
        };
        vi.spyOn(document, "createElement").mockReturnValue(
            mockLink as unknown as HTMLElement
        );
        vi.spyOn(document.body, "appendChild").mockImplementation(
            () => mockLink as unknown as Node
        );
        vi.spyOn(document.body, "removeChild").mockImplementation(
            () => mockLink as unknown as Node
        );
    });

    it("triggers a download with the correct filename", () => {
        const payload = {
            _meta: {
                version: 1,
                pipeline: "scrinshot",
                exportedAt: "2026-04-10T12:00:00.000Z",
            },
            config: { n_jobs: 4 },
        };
        triggerDownload(payload);
        const mockLink = document.createElement("a") as unknown as {
            download: string;
            click: ReturnType<typeof vi.fn>;
        };
        expect(mockLink.download).toBe("scrinshot_config_2026-04-10.json");
        expect(mockLink.click).toHaveBeenCalled();
    });

    it("revokes the object URL after download", () => {
        const payload = {
            _meta: {
                version: 1,
                pipeline: "scrinshot",
                exportedAt: "2026-04-10T12:00:00.000Z",
            },
            config: {},
        };
        triggerDownload(payload);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
});

// ---- importAndValidate ----

describe("importAndValidate", () => {
    const negativeTestImportAndValidate = (
        payload: unknown,
        ...matchers: (string | RegExp)[]
    ) => {
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            for (const m of matchers) expect(result.error).toMatch(m);
        }
    };

    const validPayload = {
        _meta: {
            version: "1.0.0",
            pipeline: "scrinshot",
            exportedAt: "2026-04-10T12:00:00.000Z",
        },
        config: {
            n_jobs: 8,
            top_n_sets: 5,
            files_fasta_target_probe_database: {
                fasta_form: [
                    {
                        selectedSource: "ncbi",
                        formDataNcbi: {
                            source: "ncbi",
                            source_params: {
                                species: "Homo_sapiens",
                                annotation_release: "110",
                                taxon: "vertebrate_mammalian",
                            },
                            genomic_regions: {
                                gene: "false",
                                intergenic: "false",
                                exon: "true",
                                exon_exon_junction: "false",
                                utr: "false",
                                cds: "false",
                                intron: "false",
                            },
                            exon_exon_junction_block_size: "50",
                        },
                        formDataEns: {
                            source: "ensembl",
                            source_params: {
                                species: "homo_sapiens",
                                annotation_release: "current",
                            },
                            genomic_regions: {
                                gene: "false",
                                intergenic: "false",
                                exon: "true",
                                exon_exon_junction: "false",
                                utr: "false",
                                cds: "false",
                                intron: "false",
                            },
                            exon_exon_junction_block_size: "50",
                        },
                    },
                ],
                files: [],
            },
            files_fasta_reference_database_target_probe: {
                files: [],
                fasta_form: [],
            },
        },
    };

    it("accepts a valid export payload", () => {
        const result = importAndValidate(validPayload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.config.n_jobs).toBe(8);
            expect(result.config.top_n_sets).toBe(5);
            expect(result.skippedFields).toHaveLength(0);
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
            /Scrinshot/
        );
    });

    it("rejects when _meta.version is missing", () => {
        negativeTestImportAndValidate(
            { _meta: { pipeline: "scrinshot" }, config: {} },
            /version/
        );
    });

    it("rejects incompatible major version", () => {
        negativeTestImportAndValidate(
            {
                ...validPayload,
                _meta: { ...validPayload._meta, version: "99.0.0" },
            },
            /99\.0\.0/
        );
    });

    it("accepts a different minor/patch version with matching major", () => {
        const payload = {
            ...validPayload,
            _meta: { ...validPayload._meta, version: "1.5.3" },
        };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
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
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.config).not.toHaveProperty("unknown_field");
            expect(result.config).not.toHaveProperty("another_unknown");
            expect(result.skippedFields).toContain("unknown_field");
            expect(result.skippedFields).toContain("another_unknown");
        }
    });

    it("rejects when a field has the wrong type", () => {
        negativeTestImportAndValidate(
            { ...validPayload, config: { n_jobs: "not-a-number" } },
            /invalid/i
        );
    });

    it("accepts a partial config (only some fields present)", () => {
        const payload = { ...validPayload, config: { n_jobs: 12 } };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.config.n_jobs).toBe(12);
    });

    it("accepts an empty config object", () => {
        const payload = { ...validPayload, config: {} };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
        if (result.ok) expect(Object.keys(result.config)).toHaveLength(0);
    });

    it("accepts boolean fields correctly", () => {
        const payload = {
            ...validPayload,
            config: { heuristic: false },
        };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.config.heuristic).toBe(false);
    });
});
