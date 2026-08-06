import type { RJSFSchema, UiSchema } from "@rjsf/utils";

export const isRootField = (fieldPathId: { $id: string }): boolean =>
    fieldPathId.$id === "root";

export const snakeCaseToTitleCase = (str: string): string =>
    str
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

export const spaceBeforeCapitalLetters = (str: string): string =>
    str.replace(/([a-z])([A-Z])/g, "$1 $2");

const EXCLUDED_TABS = new Set(["schema_version"]);

export const excludeHiddenTabs = (tabs: string[]) =>
    tabs.filter((tab) => !EXCLUDED_TABS.has(tab));

/** Grid columns shared by every compact field group (see `.compact-field-item` in theme.scss). */
export const COMPACT_GRID_COLUMNS = "repeat(4, 1fr)";

/**
 * Whether a field needs a whole grid row instead of one compact column, i.e. anything
 * that lays out its own children: objects, lists, oneOf branches and custom fields.
 *
 * @param schema - the field's JSON Schema, unresolved `$ref`s included
 * @param uiSchema - the field's UiSchema
 * @returns A boolean that is True if the field spans the full row
 */
export const spansFullRow = (
    schema: RJSFSchema | boolean | undefined,
    uiSchema: UiSchema | undefined
): boolean =>
    !!uiSchema?.["ui:field"] ||
    (!!schema &&
        typeof schema !== "boolean" &&
        (!!schema.$ref ||
            !!schema.oneOf ||
            schema.type === "object" ||
            schema.type === "array"));

/**
 * Helper function that checks if an error message should be removed from the output
 * These errors are caused by unsupported JSON schema discriminator usage and are not helpful to users.
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
