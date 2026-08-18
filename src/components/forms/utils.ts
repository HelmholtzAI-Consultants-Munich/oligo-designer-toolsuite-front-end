import { getUiOptions, type RJSFSchema, type UiSchema } from "@rjsf/utils";

export const snakeCaseToTitleCase = (str: string): string =>
    str
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

export const spaceBeforeCapitalLetters = (str: string): string =>
    str.replace(/([a-z])([A-Z])/g, "$1 $2");

// `required_parameters` holds only the inputs pinned to the Quick Settings panel, so the
// section itself has nothing left to show and gets no tab.
const EXCLUDED_TABS = new Set(["schema_version", "required_parameters"]);

export const excludeHiddenTabs = (tabs: string[]) =>
    tabs.filter((tab) => !EXCLUDED_TABS.has(tab));

/** A section's accordion key, matching the `fieldPathId.$id` RJSF gives that section. */
export const sectionKey = (tabId: string, name: string): string =>
    `${tabId}_${name}`;

/** Narrows away the `true`/`false` form a property schema can take, which carries no keywords. */
const asSchema = (
    schema: RJSFSchema | boolean | undefined
): (RJSFSchema & Record<string, unknown>) | undefined =>
    schema && typeof schema !== "boolean" ? schema : undefined;

/**
 * Whether a schema carries one of the backend's `x-` flags, set on a Pydantic `Field` through
 * `json_schema_extra` and unknown to RJSF's own types.
 *
 * @param schema - the field's JSON Schema, unresolved `$ref`s included
 * @param flag - the flag's keyword, e.g. `x-collapsed`
 * @returns A boolean that is True if the flag is set
 */
export const hasSchemaFlag = (
    schema: RJSFSchema | boolean | undefined,
    flag: string
): boolean => asSchema(schema)?.[flag] === true;

/**
 * Whether a schema's options are discriminated by an `enabled` boolean, i.e. an optional
 * filter, which renders as a checkbox rather than a schema picker.
 *
 * @param schema - the field's JSON Schema
 * @returns A boolean that is True if the discriminator is `enabled`
 */
export const isEnabledDiscriminated = (
    schema: RJSFSchema | boolean | undefined
): boolean =>
    (asSchema(schema)?.discriminator as { propertyName?: string } | undefined)
        ?.propertyName === "enabled";

/**
 * Whether a field lays out its own children (object, list, oneOf or custom field) and so
 * needs a whole grid row rather than one compact column.
 *
 * @param schema - the field's JSON Schema, unresolved `$ref`s included
 * @param uiSchema - the field's UiSchema
 * @returns A boolean that is True if the field spans the full row
 */
export const spansFullRow = (
    schema: RJSFSchema | boolean | undefined,
    uiSchema: UiSchema | undefined
): boolean => {
    const field = asSchema(schema);
    return (
        !!uiSchema?.["ui:field"] ||
        !!field?.$ref ||
        !!field?.oneOf ||
        field?.type === "object" ||
        field?.type === "array"
    );
};

/**
 * Whether the backend flagged a field as a quick setting, pinning it to the panel above the
 * tabs instead of leaving it in its own section.
 *
 * @remarks
 * `uiSchemaFromJsonSchema` copies the backend's `x-quick-setting` into `ui:options`; the schema
 * is read as a fallback for the pipelines whose uiSchema is hand-written.
 *
 * @param schema - the field's JSON Schema, unresolved `$ref`s included
 * @param uiSchema - the field's UiSchema
 * @returns A boolean that is True if the field belongs in the Quick Settings panel
 */
export const isQuickSetting = (
    schema: RJSFSchema | boolean | undefined,
    uiSchema: UiSchema | undefined
): boolean =>
    getUiOptions(uiSchema).quickSetting === true ||
    hasSchemaFlag(schema, "x-quick-setting");

/**
 * Checks if an error message should be removed from the output. These errors are caused by
 * unsupported JSON schema discriminator usage and are not helpful to users.
 *
 * TODO: Remove this filter once discriminators in the forms no longer produce these errors alongside the informative ones.
 *
 * @param error - error message that gets checked
 * @returns A boolean that is True if the error is informative
 */
export const filterUninformativeErrors = (error: string) =>
    ![
        "must match exactly one schema in oneOf",
        "must match a schema in anyOf",
        "must be equal to constant",
    ].includes(error);
