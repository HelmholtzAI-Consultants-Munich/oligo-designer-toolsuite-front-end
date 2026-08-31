/**
 * Tests that a pipeline form fetches its schema from the backend, renders once it arrives, and
 * reports a fetch that fails instead of leaving the page blank.
 *
 * @remarks
 * The schema is read from a committed fixture rather than the running backend, which vitest has
 * no way to reach. `test_schema_routes.py` fails if that copy drifts from the models.
 */
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PipelineForm from "../components/forms/PipelineForm";
import { BACKEND_URL } from "../config";
import { clearPipelineSchemaCache } from "../pipelineConfig/schemaApi";
import oligoseqSchema from "./fixtures/oligoseq.schema.json";

/** Answers every schema request with the fixture, as the backend would. */
const mockSchemaResponse = () =>
    vi.spyOn(axios, "get").mockResolvedValue({ data: oligoseqSchema });

/** Mounts the form under a router, which `ErrorAlert`'s contact link needs. */
const renderForm = () =>
    render(
        <MemoryRouter>
            <PipelineForm pipeline="oligoseq" title="OligoSeq Probe Designer" />
        </MemoryRouter>
    );

beforeEach(() => {
    // the cache outlives a test: it is module state, not component state
    clearPipelineSchemaCache();
    vi.restoreAllMocks();
});

describe("PipelineForm", () => {
    it("fetches the pipeline's schema and renders the form once it arrives", async () => {
        const get = mockSchemaResponse();

        renderForm();

        expect(screen.getByRole("status")).toBeInTheDocument();
        // a tab named after a section of the fetched schema, so the assertion fails if the form
        // renders from anything but what the backend sent
        await waitFor(() =>
            expect(
                screen.getByRole("tab", { name: /target probes/i })
            ).toBeInTheDocument()
        );
        // the timeout is asserted here because without one a hung backend leaves the form on
        // its spinner with no error and no way out
        expect(get).toHaveBeenCalledWith(
            `${BACKEND_URL}/api/pipelines/oligoseq/schema`,
            expect.objectContaining({ timeout: expect.any(Number) })
        );
    });

    it("asks for a schema only once, however many forms want it", async () => {
        const get = mockSchemaResponse();

        renderForm();
        renderForm();

        await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    });

    it("tells an unreachable backend apart from one that answered with a reason", async () => {
        // axios words this failure "Network Error", which is not advice a reader can act on
        vi.spyOn(axios, "get").mockRejectedValue(
            Object.assign(new Error("Network Error"), {
                isAxiosError: true,
                response: undefined,
            })
        );

        renderForm();

        await waitFor(() =>
            expect(
                screen.getByText(/check your connection/i)
            ).toBeInTheDocument()
        );
        expect(screen.queryByText("Network Error")).not.toBeInTheDocument();
    });

    it("shows the backend's own explanation when it gave one", async () => {
        vi.spyOn(axios, "get").mockRejectedValue(
            Object.assign(new Error("Request failed with status code 404"), {
                isAxiosError: true,
                response: {
                    data: { error: 'Pipeline "oligoseq" does not exist' },
                },
            })
        );

        renderForm();

        await waitFor(() =>
            expect(screen.getByText(/does not exist/i)).toBeInTheDocument()
        );
    });

    it("reports a schema that could not be fetched, and retries on the next mount", async () => {
        const get = mockSchemaResponse().mockRejectedValueOnce(
            new Error("offline")
        );

        const { unmount } = renderForm();

        await waitFor(() =>
            expect(screen.getByText("Form unavailable")).toBeInTheDocument()
        );
        unmount();

        renderForm();

        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    });
});
