import { useEffect, useState } from "react";
import { Spinner } from "react-bootstrap";
import { ExclamationTriangleFill } from "react-bootstrap-icons";

import type { Pipeline } from "../../pipelineConfig/config";
import {
    fetchPipelineSchema,
    peekPipelineSchema,
    type PipelineSchemas,
} from "../../pipelineConfig/schemaApi";
import { getErrorMessage } from "../../utils/errorUtil";
import ErrorAlert from "../ui/ErrorAlert";
import Page from "../ui/Page";
import PipelineTemplate from "./PipelineTemplate";

type Props = {
    pipeline: Pipeline["name"];
    title: string;
};

type SchemaState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; schemas: PipelineSchemas };

/**
 * Loads a pipeline's schema from the backend, or reports why it could not.
 *
 * @remarks
 * A pipeline already fetched comes back from the cache in `schemaApi`, so the initial state is
 * `ready` and navigating back to a form neither refetches it nor shows a spinner again.
 *
 * @param pipeline - name of the pipeline
 * @returns The schemas once they have arrived, or the loading or error state until then
 */
const usePipelineSchema = (pipeline: Pipeline["name"]): SchemaState => {
    const [state, setState] = useState<SchemaState>(() => {
        const schemas = peekPipelineSchema(pipeline);
        return schemas ? { status: "ready", schemas } : { status: "loading" };
    });

    useEffect(() => {
        let cancelled = false;

        fetchPipelineSchema(pipeline)
            .then((schemas) => {
                if (!cancelled) {
                    setState({ status: "ready", schemas });
                }
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setState({
                        status: "error",
                        message: getErrorMessage(
                            error,
                            "The form could not be loaded. Please try again later."
                        ),
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pipeline]);

    return state;
};

/**
 * Fetches a pipeline's schema from the backend and renders its form once it has arrived.
 *
 * @remarks
 * The form is built from the schema as it mounts, so it cannot be rendered before the schema is
 * there. This wrapper owns the loading and error states, leaving `PipelineTemplate` free to read
 * a schema it already has.
 *
 * @param pipeline - name of the pipeline
 * @param title - the beautified human accessible name of the pipeline
 * @returns A React Component holding the pipeline's form, a spinner, or a report of what failed
 */
const PipelineForm: React.FC<Props> = ({ pipeline, title }) => {
    const state = usePipelineSchema(pipeline);

    if (state.status === "loading") {
        return (
            <Page title={title}>
                <div className="d-flex justify-content-center py-5">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading form…</span>
                    </Spinner>
                </div>
            </Page>
        );
    }

    if (state.status === "error") {
        return (
            <Page title={title}>
                <ErrorAlert
                    variant="danger"
                    icon={ExclamationTriangleFill}
                    title="Form unavailable"
                >
                    <p className="mb-0">{state.message}</p>
                </ErrorAlert>
            </Page>
        );
    }

    return (
        <PipelineTemplate
            pipeline={pipeline}
            title={title}
            schema={state.schemas.schema}
            uiSchema={state.schemas.uiSchema}
        />
    );
};

export default PipelineForm;
