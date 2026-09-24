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
import {
    clearPipelineSchemaCache,
    type PipelinePreset,
} from "../pipelineConfig/schemaApi";
import oligoseqSchema from "./fixtures/oligoseq.schema.json";

const PRESETS_URL = `${BACKEND_URL}/api/pipelines/oligoseq/presets`;

/** Answers every schema request with the fixture and the presets request with `presets`. */
const mockSchemaResponse = (presets: PipelinePreset[] = []) =>
    vi.spyOn(axios, "get").mockImplementation((url: string) =>
        Promise.resolve({
            data: url === PRESETS_URL ? presets : oligoseqSchema,
        })
    );

const preset = (id: string): PipelinePreset => ({
    id,
    label: id,
    payload: {
        _meta: { version: 2, pipeline: "oligoseq" },
        config: { target_probes: {} },
    },
});

/** Records the modals the form asks for, since the modal host is not mounted here. */
const recordModals = () => {
    const titles: string[] = [];
    window.addEventListener("modal:show", (event) =>
        titles.push((event as CustomEvent<{ title: string }>).detail.title)
    );
    return titles;
};

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
    localStorage.clear();
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

        await waitFor(() =>
            expect(
                get.mock.calls.filter(([url]) => url.endsWith("/schema"))
            ).toHaveLength(1)
        );
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

    it("applies the only preset without asking and remembers it", async () => {
        mockSchemaResponse([preset("default")]);
        const modals = recordModals();

        renderForm();

        await waitFor(() =>
            expect(localStorage.getItem("odt.preset.oligoseq")).toBe("default")
        );
        expect(modals).toEqual([]);
    });

    it("asks which preset to use when there are several", async () => {
        mockSchemaResponse([preset("default"), preset("gandin")]);
        const modals = recordModals();

        renderForm();

        await waitFor(() =>
            expect(modals).toEqual(["Choose Default Parameters"])
        );
        expect(
            screen.getByRole("button", { name: /load defaults/i })
        ).toBeInTheDocument();
    });

    it("applies the remembered preset instead of asking again", async () => {
        localStorage.setItem("odt.preset.oligoseq", "gandin");
        const get = mockSchemaResponse([preset("default"), preset("gandin")]);
        const modals = recordModals();

        renderForm();

        await waitFor(() =>
            expect(get).toHaveBeenCalledWith(PRESETS_URL, expect.anything())
        );
        await screen.findByRole("button", { name: /load defaults/i });
        expect(modals).toEqual([]);
        expect(localStorage.getItem("odt.preset.oligoseq")).toBe("gandin");
    });
});
