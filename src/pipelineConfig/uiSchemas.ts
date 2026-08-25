import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import TabsLayout from "../components/forms/TabsLayout";
import TabLayout from "../components/forms/TabLayout";
import SectionLayout from "../components/forms/SectionLayout";
import CollapsibleSectionLayout from "../components/forms/CollapsibleSectionLayout";
import EnabledToggleObjectTemplate from "../components/forms/EnabledToggleObjectTemplate";
import CompactFieldGroupTemplate from "../components/forms/CompactFieldGroupTemplate";
import BareGroupTemplate from "../components/forms/BareGroupTemplate";
import { findSchemaDefinition, mergeObjects } from "@rjsf/utils";
import {
    hasSchemaFlag,
    isEnabledDiscriminated,
    snakeCaseToTitleCase,
} from "../components/forms/utils";

/** Resolves a `$ref` against the full schema, returning the node unchanged if it has none. */
const resolveSchema = (
    schema: RJSFSchema,
    baseSchema: RJSFSchema
): RJSFSchema => {
    if (!schema.$ref) {
        return schema;
    }
    try {
        return findSchemaDefinition(schema.$ref, baseSchema);
    } catch {
        return schema;
    }
};

/**
 * Determines whether a field's schema is a "scalar" (not an object or array), following
 * $ref and oneOf/anyOf so that e.g. nullable scalar fields (`anyOf: [{type: "integer"}, {type: "null"}]`)
 * are still recognized as scalar.
 */
const isScalarSchema = (
    schema: RJSFSchema,
    baseSchema: RJSFSchema
): boolean => {
    const resolved = resolveSchema(schema, baseSchema);
    if (resolved.type === "object" || resolved.type === "array") {
        return false;
    }
    const options = resolved.oneOf || resolved.anyOf;
    if (options) {
        return options.every((option) =>
            isScalarSchema(option as RJSFSchema, baseSchema)
        );
    }
    return true;
};

export const uiSchemaFromJsonSchema = (jsonSchema: RJSFSchema): UiSchema => {
    return uiSchemaFromJsonSchemaRecursive(jsonSchema, jsonSchema, 0);
};

/**
 * Generates an RJSF UiSchema based on a JSON Schema. Therefore it recursively iterates each level of the JSON Schema
 * and applies the appropriate components and ui options
 *
 * @param baseSchema - the full JSON Schema of the pipeline
 * @param localSchema - the schema of the current level the function is inside of the pipeline schema
 * @param level - the current depth of recursion
 * @returns A RJSF UiSchema which is filled with the necessary fields to match our UI style
 *
 */
const uiSchemaFromJsonSchemaRecursive = (
    baseSchema: RJSFSchema,
    localSchema: RJSFSchema,
    level: number
): UiSchema => {
    let uiSchema: UiSchema = {};

    if (localSchema.$ref) {
        try {
            const refSchema = findSchemaDefinition(
                localSchema.$ref,
                baseSchema
            );
            return uiSchemaFromJsonSchemaRecursive(
                baseSchema,
                refSchema,
                level
            );
        } catch (error) {
            console.error(
                `Error resolving reference: ${localSchema.$ref}`,
                error
            );
            return uiSchema;
        }
    }

    if (localSchema.oneOf || localSchema.anyOf) {
        // we deeply merge the uiSchemas of all options, to ensure all possible fields are covered
        for (const option of localSchema.oneOf || localSchema.anyOf || []) {
            const optionSchema = option as RJSFSchema;
            const optionUiSchema = uiSchemaFromJsonSchemaRecursive(
                baseSchema,
                optionSchema,
                level
            );
            uiSchema = mergeObjects(uiSchema, optionUiSchema);
        }

        // Fields discriminated by "enabled" (e.g. optional filters) render as a single
        // checkbox-and-name row instead of a schema-picker dropdown plus a separate title.
        if (isEnabledDiscriminated(localSchema)) {
            uiSchema["ui:ObjectFieldTemplate"] = EnabledToggleObjectTemplate;
            uiSchema["ui:title"] = localSchema.title;
        } else {
            // Any other discriminator (e.g. `source: "generate" | "load"`) is a `const` on
            // each option, redundant with RJSF's own schema-picker dropdown and, unlike
            // "enabled", not something the user can meaningfully edit.
            const discriminatorProperty = (
                localSchema.discriminator as
                    | { propertyName?: string }
                    | undefined
            )?.propertyName;
            if (discriminatorProperty) {
                uiSchema[discriminatorProperty] = { "ui:widget": "hidden" };

                // Name each option by the value it selects, so the dropdown reads
                // "Generate"/"Load" instead of repeating the model's class name, which the
                // field's own title already says. The option body then needs no heading.
                const optionsKey = localSchema.oneOf ? "oneOf" : "anyOf";
                const merged = uiSchema;
                uiSchema[optionsKey] = (localSchema[optionsKey] ?? []).map(
                    (option) => {
                        const value = resolveSchema(
                            option as RJSFSchema,
                            baseSchema
                        ).properties?.[discriminatorProperty] as
                            | RJSFSchema
                            | undefined;
                        return {
                            ...merged,
                            "ui:ObjectFieldTemplate": BareGroupTemplate,
                            ...(typeof value?.const === "string" && {
                                "ui:title": snakeCaseToTitleCase(value.const),
                            }),
                        };
                    }
                );
            }
        }
    }
    if (localSchema.properties) {
        const fields = Object.keys(localSchema.properties);
        if (level === 0) {
            // root -> TabsLayout
            uiSchema["ui:ObjectFieldTemplate"] = TabsLayout;
        } else if (level === 1) {
            // first level -> TabLayout
            uiSchema["ui:ObjectFieldTemplate"] = TabLayout;
        } else if (level === 2) {
            // second level -> SectionLayout
            uiSchema["ui:ObjectFieldTemplate"] = SectionLayout;
        } else if (fields.length === 1 && fields[0] === "enabled") {
            // an "enabled"-only object is still a toggle, just without parameters
            uiSchema["ui:ObjectFieldTemplate"] = EnabledToggleObjectTemplate;
        } else if (
            fields.length > 0 &&
            fields.every((field) =>
                isScalarSchema(
                    localSchema.properties![field] as RJSFSchema,
                    baseSchema
                )
            )
        ) {
            // A nested object made up entirely of small scalar fields (e.g. per-base
            // thresholds) renders as a compact inline row instead of a full-width grid.
            uiSchema["ui:ObjectFieldTemplate"] = CompactFieldGroupTemplate;
        }

        // Widgets are picked by field name: nothing in the schema separates `target_genome`
        // from `channels_ids`, both string arrays.
        // TODO: use an `x-widget` flag on the ODT model, like `x-quick-setting`. Names are
        // fragile -- the rename to `target_genome` silently dropped both genome pickers.
        for (const field of fields) {
            const propertySchema = localSchema.properties[field] as RJSFSchema;
            if (field === "file_region_ids" || field === "targets") {
                // file_region_ids / targets (any level) -> txtUploadInput
                uiSchema[field] = {
                    "ui:field": "txtUploadInput",
                    "ui:fieldReplacesAnyOrOneOf": true,
                };
            } else if (
                field.startsWith("files_fasta_") ||
                field === "target_genome" ||
                field === "reference_genome"
            ) {
                // files_fasta_* / target_genome / reference_genome -> genomicInput
                uiSchema[field] = { "ui:field": "genomicInput" };
            } else if (field.startsWith("files_vcf_")) {
                // files_vcf_* (any level) -> fileUpload
                uiSchema[field] = { "ui:field": "fileUpload" };
            } else if (field === "file") {
                // `file` names the single file a "load" branch reads (a codebook, an
                // initiator or readout probe table) -> singleFileInput. The field is widened
                // to accept the picked `File` (see `accept_uploaded_files`), and the input
                // stands in for that union rather than letting RJSF offer it as a choice.
                uiSchema[field] = {
                    "ui:field": "singleFileInput",
                    "ui:fieldReplacesAnyOrOneOf": true,
                };
            } else {
                const fieldUiSchema = uiSchemaFromJsonSchemaRecursive(
                    baseSchema,
                    propertySchema,
                    level + 1
                );
                // ODT groups the user-supplied inputs here without flagging them. Pinning the
                // section, not its fields, survives a rename inside the model.
                if (field === "required_parameters") {
                    for (const name of Object.keys(
                        resolveSchema(propertySchema, baseSchema).properties ??
                            {}
                    )) {
                        fieldUiSchema[name] = {
                            ...fieldUiSchema[name],
                            "ui:options": {
                                ...fieldUiSchema[name]?.["ui:options"],
                                quickSetting: "required",
                            },
                        };
                    }
                }
                // A `$ref` titles the section after the model, so two fields sharing one -- a
                // forward and a reverse primer -- read identically. The field name is unique
                // within its object, and does not repeat the tab's own name.
                if (
                    propertySchema.$ref &&
                    resolveSchema(propertySchema, baseSchema).properties
                ) {
                    fieldUiSchema["ui:title"] = snakeCaseToTitleCase(field);
                }
                // The backend's `x-` flags are read here, not in the recursive call, because
                // they sit as siblings of `$ref`, which that call resolves away. Any field
                // carrying one is treated the same, whichever pipeline or model set it.
                if (hasSchemaFlag(propertySchema, "x-collapsed")) {
                    // renders collapsed by default
                    fieldUiSchema["ui:ObjectFieldTemplate"] =
                        CollapsibleSectionLayout;
                }
                // A description beside a `$ref` or union describes the field, but the call
                // above resolves the pointer and never sees it. Carry it over.
                if (
                    propertySchema.description &&
                    (propertySchema.$ref ||
                        propertySchema.oneOf ||
                        propertySchema.anyOf)
                ) {
                    fieldUiSchema["ui:description"] =
                        propertySchema.description;
                }
                // A `const` states which branch this is, not something to fill in, and a model
                // with only one branch has no selector to hide it as. Left alone it renders as
                // an input showing a value that cannot be changed. `enabled` is the exception:
                // its toggle template draws it as the section's own checkbox.
                if (
                    field !== "enabled" &&
                    resolveSchema(propertySchema, baseSchema).const !==
                        undefined
                ) {
                    fieldUiSchema["ui:widget"] = "hidden";
                }
                if (hasSchemaFlag(propertySchema, "x-quick-setting")) {
                    // pinned to the Quick Settings panel above the tabs, not its own section
                    fieldUiSchema["ui:options"] = {
                        ...fieldUiSchema["ui:options"],
                        quickSetting: true,
                    };
                }
                // If every field this section owns just got pinned above, its own body has
                // nothing left to show. TabLayout uses this to skip it as the default-open
                // section; CSS (`:has(.compact-grid:empty)`) hides the section itself.
                const childProperties = resolveSchema(
                    propertySchema,
                    baseSchema
                ).properties;
                const childNames = Object.keys(childProperties ?? {});
                if (
                    childNames.length > 0 &&
                    childNames.every(
                        (name) =>
                            fieldUiSchema[name]?.["ui:options"]?.quickSetting
                    )
                ) {
                    fieldUiSchema["ui:options"] = {
                        ...fieldUiSchema["ui:options"],
                        allFieldsPortaled: true,
                    };
                }
                uiSchema[field] = fieldUiSchema;
            }
        }
    }

    return uiSchema;
};
