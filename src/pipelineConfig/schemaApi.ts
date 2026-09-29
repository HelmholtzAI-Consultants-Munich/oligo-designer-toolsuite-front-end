import axios from "axios";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";

import { BACKEND_URL } from "../config";
import { uiSchemaFromJsonSchema } from "./uiSchemas";
import type { Pipeline } from "./config";

// Without a timeout axios waits forever, leaving the form on its spinner if the backend accepts the
// connection but never answers. The limit is generous: the backend serves the schema from memory, so
// hitting it means the server hangs, not that it is slow.
const SCHEMA_REQUEST_TIMEOUT_MS = 15_000;

/** A pipeline's JSON Schema and the UI Schema derived from it. */
export interface PipelineSchemas {
    schema: RJSFSchema;
    uiSchema: UiSchema;
}

// A schema only changes when the backend restarts on a different ODT version, so it is fetched once
// per page load and kept here. `pending` caches the promise, so components that mount together share
// one request. `resolved` caches the value, so a revisit renders the form at once, without a spinner.
const pending = new Map<string, Promise<PipelineSchemas>>();
const resolved = new Map<string, PipelineSchemas>();

/**
 * Fetches a pipeline's schema, derives its UI Schema and stores both in `resolved`.
 *
 * @param pipeline - name of the pipeline
 * @returns A promise of the schemas
 */
const requestPipelineSchema = async (
    pipeline: Pipeline["name"]
): Promise<PipelineSchemas> => {
    const { data } = await axios.get<RJSFSchema>(
        `${BACKEND_URL}/api/pipelines/${pipeline}/schema`,
        { timeout: SCHEMA_REQUEST_TIMEOUT_MS }
    );
    const schemas = { schema: data, uiSchema: uiSchemaFromJsonSchema(data) };
    resolved.set(pipeline, schemas);
    return schemas;
};

/**
 * Gets the pipeline's schemas if they have already arrived, so a revisit renders without a flash.
 *
 * @param pipeline - name of the pipeline
 * @returns The cached schemas, or undefined if they have not arrived yet
 */
export const peekPipelineSchema = (
    pipeline: Pipeline["name"]
): PipelineSchemas | undefined => resolved.get(pipeline);

/**
 * Fetches the JSON Schema the pipeline's form is built from, and derives its UI Schema.
 *
 * @param pipeline - name of the pipeline
 * @returns A promise of the schemas, shared with any request already in flight for this pipeline
 */
export const fetchPipelineSchema = (
    pipeline: Pipeline["name"]
): Promise<PipelineSchemas> => {
    let request = pending.get(pipeline);
    if (!request) {
        // a failed fetch is dropped again, so the next mount retries rather than replaying it
        request = requestPipelineSchema(pipeline).catch((error: unknown) => {
            pending.delete(pipeline);
            throw error;
        });
        pending.set(pipeline, request);
    }
    return request;
};

/**
 * Turns a failed schema fetch into a message for the user.
 *
 * @remarks
 * Used instead of `getErrorMessage`, which shows axios's "Network Error" when the backend cannot be reached.
 *
 * @param error - whatever `fetchPipelineSchema` rejected with
 * @returns The backend's error message if it answered, otherwise advice to check the connection
 */
export const schemaErrorMessage = (error: unknown): string =>
    (axios.isAxiosError<{ error?: string }>(error) &&
        error.response?.data?.error) ||
    "The form could not be loaded. Check your connection and try again.";

/** Drops everything cached, so a test can start from a cold cache. */
export const clearPipelineSchemaCache = () => {
    pending.clear();
    resolved.clear();
};
