import axios from "axios";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";

import { BACKEND_URL } from "../config";
import { uiSchemaFromJsonSchema } from "./uiSchemas";
import type { Pipeline } from "./config";

export interface PipelineSchemas {
    schema: RJSFSchema;
    uiSchema: UiSchema;
}

// A schema only changes when the backend restarts on a different ODT version, so it is fetched
// once per page load and kept here. Both maps earn their place: caching the promise means two
// components mounting in the same tick share one request, and caching the value means a revisit
// renders the form straight away, instead of showing a spinner while it is built.
const pending = new Map<string, Promise<PipelineSchemas>>();
const resolved = new Map<string, PipelineSchemas>();

const requestPipelineSchema = async (
    pipeline: Pipeline["name"]
): Promise<PipelineSchemas> => {
    const { data } = await axios.get<RJSFSchema>(
        `${BACKEND_URL}/api/pipelines/${pipeline}/schema`
    );
    const schemas = { schema: data, uiSchema: uiSchemaFromJsonSchema(data) };
    resolved.set(pipeline, schemas);
    return schemas;
};

/** The pipeline's schemas if they have already arrived, so a revisit renders without a flash. */
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

/** Drops everything cached, so a test can start from a cold cache. */
export const clearPipelineSchemaCache = () => {
    pending.clear();
    resolved.clear();
};
