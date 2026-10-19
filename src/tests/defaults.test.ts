/**
 * Tests that falsy Pydantic overrides, such as `BlastnSearchParameters(soft_masking=False)`,
 * are still present after RJSF computes the form's defaults, once `falsyDeclaredDefaults` has
 * seeded them as form data.
 *
 * The schema below is written by hand, but it mirrors what Pydantic generates for ODT's BLAST
 * filters: each optional filter is a union with `enabled` as its discriminator, and a field whose
 * default is a model instance has that default next to its `$ref`.
 */
import { describe, it, expect } from "vitest";
import { getDefaultFormState, type RJSFSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { falsyDeclaredDefaults } from "../pipelineConfig/defaults";

const searchDefault = {
    "-strand": "minus",
    "-soft_masking": false,
    "-word_size": 10,
};

// The cast is needed because `discriminator` is an OpenAPI keyword that RJSF's JSON Schema
// type does not know about.
const schema = {
    type: "object",
    $defs: {
        SearchParameters: {
            type: "object",
            properties: {
                "-strand": {
                    anyOf: [{ type: "string" }, { type: "null" }],
                    default: null,
                },
                "-soft_masking": {
                    anyOf: [{ type: "boolean" }, { type: "null" }],
                    default: null,
                },
                "-word_size": {
                    anyOf: [{ type: "integer" }, { type: "null" }],
                    default: null,
                },
            },
        },
        FilterEnabled: {
            type: "object",
            properties: {
                enabled: { const: true, type: "boolean" },
                search_parameters: {
                    $ref: "#/$defs/SearchParameters",
                    default: searchDefault,
                },
            },
            required: ["enabled"],
        },
        FilterDisabled: {
            type: "object",
            properties: { enabled: { const: false, type: "boolean" } },
            required: ["enabled"],
        },
        Filters: {
            type: "object",
            properties: {
                // This union has no default of its own, so RJSF renders the first option.
                specificity: {
                    oneOf: [
                        { $ref: "#/$defs/FilterEnabled" },
                        { $ref: "#/$defs/FilterDisabled" },
                    ],
                    discriminator: { propertyName: "enabled" },
                },
                // This union declares its own default. Inside it, the default for `search_parameters`
                // contains the falsy `-soft_masking` override. Its `-word_size` (7) differs from the
                // `FilterEnabled` model's own default (10), so the test can check that the union's default wins.
                cross_hybridization: {
                    oneOf: [
                        { $ref: "#/$defs/FilterEnabled" },
                        { $ref: "#/$defs/FilterDisabled" },
                    ],
                    discriminator: { propertyName: "enabled" },
                    default: {
                        enabled: true,
                        search_parameters: {
                            ...searchDefault,
                            "-word_size": 7,
                        },
                    },
                },
                // This filter is disabled by default. Seeding must not enable it.
                optional: {
                    oneOf: [
                        { $ref: "#/$defs/FilterEnabled" },
                        { $ref: "#/$defs/FilterDisabled" },
                    ],
                    discriminator: { propertyName: "enabled" },
                    default: { enabled: false },
                },
            },
        },
    },
    properties: { filters: { $ref: "#/$defs/Filters" } },
} as RJSFSchema;

const formState = () =>
    getDefaultFormState(
        validator,
        schema,
        falsyDeclaredDefaults(schema, schema),
        schema,
        false,
        { nestedDefaultsPrecedence: "ancestorWins" }
    ) as { filters: Record<string, Record<string, unknown>> };

describe("falsyDeclaredDefaults", () => {
    it("keeps a falsy override inside the option a union picks", () => {
        expect(formState().filters.specificity).toEqual({
            enabled: true,
            search_parameters: searchDefault,
        });
    });

    it("keeps a falsy override nested in a union's declared default", () => {
        expect(
            formState().filters.cross_hybridization.search_parameters
        ).toEqual({
            ...searchDefault,
            "-word_size": 7,
        });
    });

    it("leaves a disabled optional filter disabled", () => {
        expect(formState().filters.optional).toEqual({ enabled: false });
    });
});
