/**
 * Tests pipeline configuration import/export behavior for the OligoSeq pipeline.
 *
 * This file verifies that export payloads include expected metadata fields,
 * that imported payloads are validated against the pipeline schema, and that
 * invalid or unsupported payloads are rejected or filtered correctly.
 *
 * The checks only look at the top-level fields and `schema_version`, so a small
 * hand-written schema covers them. Whether a real ODT config round-trips is left
 * to the e2e tests, which run against the schema the backend serves.
 */
import { describe, it, expect } from "vitest";
import type { RJSFSchema } from "@rjsf/utils";
import {
    buildExportPayload,
    importAndValidate,
} from "../components/forms/pipelineConfigIO";
import pipelineSchema from "./fixtures/pipeline.schema.json";

const testSchema = pipelineSchema as RJSFSchema;

// ---- buildExportPayload ----
//
// These tests validate export payload metadata generation, including the
// pipeline name, version extraction, and export timestamp format.

describe("buildExportPayload", () => {
    it("sets _meta.pipeline to the given pipeline name", () => {
        const payload = buildExportPayload({}, "merfish", testSchema);
        expect(payload._meta.pipeline).toBe("merfish");
    });

    it("reads _meta.version from schema_version", () => {
        const payload = buildExportPayload({}, "scrinshot", testSchema);
        expect(payload._meta.version).toBe(2);
    });

    it("falls back to version 1 if the schema has no schema_version", () => {
        const properties = { ...testSchema.properties };
        delete properties.schema_version;
        const schemaWithoutVersion = { ...testSchema, properties };
        const payload = buildExportPayload(
            {},
            "scrinshot",
            schemaWithoutVersion
        );
        expect(payload._meta.version).toBe(1);
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

    /** A valid export payload that sets every field of the test schema. */
    const validPayload = {
        _meta: {
            version: 2,
            pipeline: "oligoseq",
            exportedAt: "2026-06-02T11:28:27.523Z",
        },
        config: {
            schema_version: 2,
            target_probes: {
                oligo_generation: {
                    probe_length_min: 26,
                    probe_split_region: 4,
                },
                property_filters: {
                    GC_content_filter: { enabled: true, GC_content_min: 45 },
                },
            },
        },
    };

    it("accepts a valid export payload", () => {
        const result = importAndValidate(validPayload, testSchema, "oligoseq");
        expect(result.ok).toBe(true);

        if (result.ok) {
            expect(
                result.config.target_probes.property_filters.GC_content_filter
                    .GC_content_min
            ).toBe(45);
            expect(
                result.config.target_probes.oligo_generation.probe_length_min
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
            /MERFISH/,
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
                    target_probes: {
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
                target_probes: {
                    oligo_generation: { probe_split_region: 2 },
                },
            },
        };
        const result = importAndValidate(payload, testSchema, "oligoseq");
        expect(result.ok).toBe(true);
        if (result.ok)
            expect(
                result.config.target_probes.oligo_generation.probe_split_region
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
                target_probes: {
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
                result.config.target_probes.property_filters.GC_content_filter
                    .enabled
            ).toBe(false);
    });
});
