import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RJSFSchema } from "@rjsf/utils";
import {
    isVersionCompatible,
    buildExportPayload,
    triggerDownload,
    importAndValidate,
    EXCLUDED_FIELDS,
} from "../components/forms/pipelineConfigIO";

// Minimal schema that mirrors the real pipeline schemas
const testSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "odt:test",
    description: "1.0.0",
    type: "object",
    properties: {
        n_jobs: { type: "integer", default: 4, title: "N Jobs" },
        top_n_sets: { type: "integer", default: 3, title: "Top N Sets" },
        heuristic: { type: "boolean", default: true, title: "Heuristic" },
        // file fields that must be excluded
        file_regions: { type: "string", default: "" },
        files_fasta_target_probe_database: {
            type: "array",
            items: { type: "string" },
            default: [],
        },
    },
} as unknown as RJSFSchema;

// ---- isVersionCompatible ----

describe("isVersionCompatible", () => {
    it("returns true when major versions match", () => {
        expect(isVersionCompatible("1.0.0", "1.0.0")).toBe(true);
        expect(isVersionCompatible("1.3.2", "1.0.0")).toBe(true);
        expect(isVersionCompatible("0.5.1", "0.1.0")).toBe(true);
    });

    it("returns false when major versions differ", () => {
        expect(isVersionCompatible("2.0.0", "1.0.0")).toBe(false);
        expect(isVersionCompatible("0.5.0", "1.0.0")).toBe(false);
        expect(isVersionCompatible("99.0.0", "1.0.0")).toBe(false);
    });

    it("returns false for malformed version strings", () => {
        expect(isVersionCompatible("not-a-version", "1.0.0")).toBe(false);
        expect(isVersionCompatible("1.0.0", "bad")).toBe(false);
        expect(isVersionCompatible("1.0", "1.0.0")).toBe(false);
        expect(isVersionCompatible("1.0.0.0", "1.0.0")).toBe(false);
    });
});

// ---- buildExportPayload ----

describe("buildExportPayload", () => {
    it("excludes all file-related fields from the config", () => {
        const formData = {
            n_jobs: 8,
            file_regions: "/some/path",
            files_fasta_target_probe_database: ["/db.fasta"],
            files_fasta_reference_database_target_probe: ["/ref.fasta"],
            files_fasta_reference_database_readout_probe: ["/ro.fasta"],
            files_fasta_reference_database_primer: ["/primer.fasta"],
        };
        const payload = buildExportPayload(formData, "scrinshot", testSchema);
        expect(payload.config).not.toHaveProperty("file_regions");
        for (const field of EXCLUDED_FIELDS) {
            expect(payload.config).not.toHaveProperty(field);
        }
    });

    it("includes non-file fields in the config", () => {
        const formData = {
            n_jobs: 8,
            top_n_sets: 5,
            file_regions: "/some/path",
        };
        const payload = buildExportPayload(formData, "scrinshot", testSchema);
        expect(payload.config.n_jobs).toBe(8);
        expect(payload.config.top_n_sets).toBe(5);
    });

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
        } as unknown as RJSFSchema;
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
                version: "1.0.0",
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
                version: "1.0.0",
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
    const validPayload = {
        _meta: {
            version: "1.0.0",
            pipeline: "scrinshot",
            exportedAt: "2026-04-10T12:00:00.000Z",
        },
        config: { n_jobs: 8, top_n_sets: 5 },
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
        const result = importAndValidate(null, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
    });

    it("rejects a plain object missing _meta", () => {
        const result = importAndValidate(
            { config: { n_jobs: 4 } },
            testSchema,
            "scrinshot"
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/_meta/);
    });

    it("rejects a plain object missing config", () => {
        const result = importAndValidate(
            { _meta: { version: "1.0.0" } },
            testSchema,
            "scrinshot"
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/config/);
    });

    it("rejects when config is not a plain object (array)", () => {
        const payload = { _meta: validPayload._meta, config: [1, 2, 3] };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
        if (!result.ok)
            expect(result.error).toMatch(/config must be an object/);
    });

    it("rejects when config is not a plain object (string)", () => {
        const payload = { _meta: validPayload._meta, config: "not-an-object" };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
        if (!result.ok)
            expect(result.error).toMatch(/config must be an object/);
    });

    it("rejects when config is null", () => {
        const payload = { _meta: validPayload._meta, config: null };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
        if (!result.ok)
            expect(result.error).toMatch(/config must be an object/);
    });

    it("rejects a config from a different pipeline", () => {
        const payload = {
            ...validPayload,
            _meta: { ...validPayload._meta, pipeline: "merfish" },
        };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/merfish/);
            expect(result.error).toMatch(/scrinshot/);
        }
    });

    it("rejects when _meta.version is missing", () => {
        const payload = { _meta: { pipeline: "scrinshot" }, config: {} };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/version/);
    });

    it("rejects incompatible major version", () => {
        const payload = {
            ...validPayload,
            _meta: { ...validPayload._meta, version: "99.0.0" },
        };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/99\.0\.0/);
    });

    it("accepts a different minor/patch version with matching major", () => {
        const payload = {
            ...validPayload,
            _meta: { ...validPayload._meta, version: "1.5.3" },
        };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
    });

    it("strips excluded fields even if present in config", () => {
        const payload = {
            ...validPayload,
            config: {
                n_jobs: 4,
                file_regions: "/should/be/removed",
                files_fasta_target_probe_database: ["/also/removed"],
            },
        };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.config).not.toHaveProperty("file_regions");
            expect(result.config).not.toHaveProperty(
                "files_fasta_target_probe_database"
            );
        }
    });

    it("skips fields not in the schema and reports them", () => {
        const payload = {
            ...validPayload,
            config: { n_jobs: 4, unknown_field: 42, another_unknown: "hello" },
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
        const payload = {
            ...validPayload,
            config: { n_jobs: "not-a-number" }, // should be integer
        };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/invalid/i);
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
        const payload = { ...validPayload, config: { heuristic: false } };
        const result = importAndValidate(payload, testSchema, "scrinshot");
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.config.heuristic).toBe(false);
    });
});
