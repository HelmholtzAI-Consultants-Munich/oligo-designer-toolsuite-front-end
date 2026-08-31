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
        const get = vi
            .spyOn(axios, "get")
            .mockResolvedValue({ data: oligoseqSchema });

        renderForm();

        expect(screen.getByRole("status")).toBeInTheDocument();
        // a tab named after a section of the fetched schema, so the assertion fails if the form
        // renders from anything but what the backend sent
        await waitFor(() =>
            expect(
                screen.getByRole("tab", { name: /target probes/i })
            ).toBeInTheDocument()
        );
        expect(get).toHaveBeenCalledWith(
            `${BACKEND_URL}/api/pipelines/oligoseq/schema`
        );
    });

    it("asks for a schema only once, however many forms want it", async () => {
        const get = vi
            .spyOn(axios, "get")
            .mockResolvedValue({ data: oligoseqSchema });

        renderForm();
        renderForm();

        await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    });

    it("reports a schema that could not be fetched, and retries on the next mount", async () => {
        const get = vi
            .spyOn(axios, "get")
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValue({ data: oligoseqSchema });

        const { unmount } = renderForm();

        await waitFor(() =>
            expect(screen.getByText("Form unavailable")).toBeInTheDocument()
        );
        unmount();

        renderForm();

        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    });
});
