import type { RJSFSchema } from "@rjsf/utils";
import type { JSONSchema7Definition } from "json-schema";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2020 from "ajv/dist/2020";

import type { RJSFFormData } from "../types";

export const EXCLUDED_FIELDS = [
    "file_regions",
    "files_fasta_target_probe_database",
    "files_fasta_reference_database_target_probe",
    "files_fasta_reference_database_readout_probe",
    "files_fasta_reference_database_primer",
] as const;

export interface PipelineConfigExport {
    _meta: {
        version: string;
        pipeline: string;
        exportedAt: string;
    };
    config: RJSFFormData;
}

// ---- Version helpers ----

function parseSemver(v: string): [number, number, number] | null {
    const parts = v.split(".");
    if (parts.length !== 3) return null;
    const nums = parts.map(Number);
    if (nums.some(isNaN)) return null;
    return nums as [number, number, number];
}

export function isVersionCompatible(
    fileVersion: string,
    schemaVersion: string
): boolean {
    const file = parseSemver(fileVersion);
    const schema = parseSemver(schemaVersion);
    if (!file || !schema) return false;
    return file[0] === schema[0];
}

// ---- Export ----

export function buildExportPayload(
    formData: RJSFFormData,
    pipeline: string,
    schema: RJSFSchema
): PipelineConfigExport {
    const config: RJSFFormData = {};
    for (const key of Object.keys(formData)) {
        if (!(EXCLUDED_FIELDS as readonly string[]).includes(key)) {
            config[key] = formData[key];
        }
    }
    const schemaVersion =
        (schema as { configVersion?: string }).configVersion ?? "1.0.0";
    return {
        _meta: {
            version: schemaVersion,
            pipeline,
            exportedAt: new Date().toISOString(),
        },
        config,
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

export type ImportResult =
    | { ok: true; config: RJSFFormData; skippedFields: string[] }
    | { ok: false; error: string };

export function importAndValidate(
    raw: unknown,
    schema: RJSFSchema
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

    // 2. Version check
    const schemaVersion =
        (schema as { configVersion?: string }).configVersion ?? "1.0.0";
    if (typeof typed._meta?.version !== "string") {
        return { ok: false, error: "Invalid file format: missing version." };
    }
    if (!isVersionCompatible(typed._meta.version, schemaVersion)) {
        return {
            ok: false,
            error: `Incompatible config version "${typed._meta.version}". Current schema uses "${schemaVersion}". Major versions must match.`,
        };
    }

    // 3. Strip excluded fields (defensive — they should not be present)
    const incoming = { ...(typed.config ?? {}) };
    for (const f of EXCLUDED_FIELDS) {
        delete incoming[f];
    }

    // 4. Drop fields not in current schema, collect for warning
    const knownFields = new Set(Object.keys(schema.properties ?? {}));
    const skippedFields: string[] = [];
    for (const key of Object.keys(incoming)) {
        if (!knownFields.has(key)) {
            skippedFields.push(key);
            delete incoming[key];
        }
    }

    // 5. AJV validation against a partial schema built from only the present fields.
    //    No $id to avoid collision with the form's already-registered schema.
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

    const validator = customizeValidator({ AjvClass: Ajv2020 });
    const { errors } = validator.rawValidation(partialSchema, incoming);
    if (errors?.length) {
        const msg = errors
            .map((e) => `${e.instancePath || "root"}: ${e.message}`)
            .join("; ");
        return { ok: false, error: `Config values are invalid: ${msg}` };
    }

    return { ok: true, config: incoming, skippedFields };
}
