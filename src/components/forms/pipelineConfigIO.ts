import type { GenericObjectType, RJSFSchema } from "@rjsf/utils";
import type { JSONSchema7Definition } from "json-schema";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2020 from "ajv/dist/2020";

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

// Created once at module level — no need to reinstantiate per call
const validator = customizeValidator({ AjvClass: Ajv2020 });

// ---- Version helpers ----

function getSchemaVersion(schema: RJSFSchema): number {
    return (
        (schema.properties?.schema_version as { const: number } | undefined)
            ?.const ?? 1
    );
}

// ---- Export ----

const removeFilesfromObject = (value: GenericObjectType): GenericObjectType | undefined => {
    if (Array.isArray(value)) {
        return value.map(removeFilesfromObject).filter(v => v !== undefined);
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

export function triggerDownload(payload: PipelineConfigExport): void {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${payload._meta.pipeline}_config_${payload._meta.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// ---- Import / Validation ----

function validationFailure(
    errors:
        | Array<{ instancePath?: string; message?: string }>
        | null
        | undefined,
    prefix: string
): { ok: false; error: string } | null {
    if (!errors?.length) return null;
    const msg = errors
        .map((e) => `${e.instancePath || "root"}: ${e.message}`)
        .join("; ");
    return { ok: false, error: `${prefix} ${msg}` };
}

export type ImportResult =
    | {
          ok: true;
          config: RJSFFormData;
          skippedFields: string[];
      }
    | { ok: false; error: string };

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
            error: `Incompatible config version "${typed._meta.version}". Current schema uses "${schemaVersion}". Major versions must match.`,
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

    // 6. AJV validation against a partial schema built from only the present fields.
    //    No $id to avoid collision with the form's already-registered schema.
    // TODO: check how to make this validation save, fails to validate fasta
    const schemaProps = schema.properties as Record<
        string,
        JSONSchema7Definition
    >;
    const partialSchema: RJSFSchema = {
        $schema: schema.$schema,
        type: "object",
        properties: Object.fromEntries(
            Object.keys(incoming).map((k) => [k, schemaProps[k]])
        ),
        additionalProperties: false,
    };

    const { errors } = validator.rawValidation(partialSchema, incoming);
    const configError = validationFailure(errors, "Config values are invalid:");
    if (configError) return configError;

    return {
        ok: true,
        config: incoming,
        skippedFields,
    };
}
