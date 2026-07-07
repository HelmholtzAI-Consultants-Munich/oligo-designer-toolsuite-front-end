import type { GenericObjectType, RJSFSchema } from "@rjsf/utils";

import type { RJSFFormData } from "../componentTypes";
import { getPipelineDisplayName } from "../../pipelineConfig/utils";

export interface PipelineConfigExport {
    _meta: {
        version: number;
        pipeline: string;
        exportedAt: string;
    };
    config: RJSFFormData;
}

// ---- Version helpers ----

function getSchemaVersion(schema: RJSFSchema): number {
    return (
        (schema.properties?.schema_version as { const: number } | undefined)
            ?.const ?? 1
    );
}

// ---- Export ----

/**
 * Removes file objects, that are potentially included in the formdata, because we can not set them again,
 * when the form pipeline config is reused.
 *
 * @param value - `formData` on first call and when the function is called recursively it is some nested object inside of `formData`
 * @returns `formData` with all file objects removed
 */
const removeFilesfromObject = (
    value: GenericObjectType
): GenericObjectType | undefined => {
    if (Array.isArray(value)) {
        return value.map(removeFilesfromObject).filter((v) => v !== undefined);
    }

    if (value instanceof File) {
        return undefined; // or null, or some placeholder value
    }

    if (typeof value === "object" && value !== null) {
        const newObj: GenericObjectType = {};
        for (const [key, val] of Object.entries(value)) {
            const cleanedVal = removeFilesfromObject(val);
            if (cleanedVal !== undefined) {
                newObj[key] = cleanedVal;
            }
        }
        return newObj;
    }

    return value; // primitive value, return as is
};

/**
 * Builds the payload for the pipeline config export. It includes a `_meta` object, which consists of
 * - version: the schema version (read from the schema)
 * - pipeline: the pipeline name
 * - exportedAt: timestamp of the export
 *
 * Further the pipeline config, where not JSON serializable fields are stripped, is attached
 *
 * @param formData - the pipeline config
 * @param pipeline - the pipeline name
 * @param schema - the JSON Schema for the pipeline
 * @returns A `PipelineConfigExport` object consisting of the values described above
 */
export function buildExportPayload(
    formData: RJSFFormData,
    pipeline: string,
    schema: RJSFSchema
): PipelineConfigExport {
    return {
        _meta: {
            version: getSchemaVersion(schema),
            pipeline,
            exportedAt: new Date().toISOString(),
        },
        config: removeFilesfromObject(formData)!,
    };
}

// ---- Import ----

export type ImportResult =
    | {
          ok: true;
          config: RJSFFormData;
          skippedFields: string[];
      }
    | { ok: false; error: string };

/**
 * Imports and validates a `PipelineConfigExport`. Because we can not be sure that the downloaded object is necessarily
 * a valid `PipelineConfigExport` object, we perform the following checks on the `raw` input:
 * 1. check the shape of `raw` and ensure all fields we expect are included
 * 2. validate that the config is a plain object
 * 3. check that the pipeline name of the imported config matches the pipeline name of the Form, where we want
 * to apply the config
 * 4. check that the schema versions match
 * 5. ensure that only those fields are present, which are expected by us
 *
 * @param raw - the pipeline config we want to import or an invalid one
 * @param schema - the schema of the pipeline form, where we want to apply the config
 * @param pipeline - the name of the pipeline form, where we want to apply the config
 * @returns An import result, which includes either a valid config with potentially skipped field or an error message
 */
export function importAndValidate(
    raw: unknown,
    schema: RJSFSchema,
    pipeline: string
): ImportResult {
    // 1. Shape check
    if (
        typeof raw !== "object" ||
        raw === null ||
        !("_meta" in raw) ||
        !("config" in raw)
    ) {
        return {
            ok: false,
            error: "Invalid file format: missing _meta or config.",
        };
    }

    const typed = raw as PipelineConfigExport;

    // 2. Validate config is a plain object
    if (
        typeof typed.config !== "object" ||
        typed.config === null ||
        Array.isArray(typed.config)
    ) {
        return {
            ok: false,
            error: "Invalid file format: config must be an object.",
        };
    }

    // 3. Pipeline check
    if (typed._meta?.pipeline !== pipeline) {
        return {
            ok: false,
            error: `This config is for "${getPipelineDisplayName(typed._meta?.pipeline)}", but the current pipeline is "${getPipelineDisplayName(pipeline)}".`,
        };
    }

    // 4. Version check
    const schemaVersion = getSchemaVersion(schema);
    if (typeof typed._meta?.version !== "number") {
        return { ok: false, error: "Invalid file format: missing version." };
    }
    if (typed._meta.version !== schemaVersion) {
        return {
            ok: false,
            error: `Incompatible config version "${typed._meta.version}". Current schema uses "${schemaVersion}". Versions must match.`,
        };
    }

    // 5. Drop fields not in current schema, collect for warning
    const incoming = { ...(typed.config ?? {}) };
    const knownFields = new Set(Object.keys(schema.properties ?? {}));
    const skippedFields: string[] = [];
    for (const key of Object.keys(incoming)) {
        if (!knownFields.has(key)) {
            if (key !== "fastaForms") {
                skippedFields.push(key);
            }
            delete incoming[key];
        }
    }

    // 6. AJV validation
    // disabled for now as this might be more of a hindrance than a help for users (e.g. when importing incomplete configs)

    return {
        ok: true,
        config: incoming,
        skippedFields,
    };
}
