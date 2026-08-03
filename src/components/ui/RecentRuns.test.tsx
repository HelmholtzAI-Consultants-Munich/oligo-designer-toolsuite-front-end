import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import RecentRuns from "./RecentRuns";
import { RunsContext } from "../../hooks/useRuns";
import type { PipelineRun } from "../../types";

const runs: PipelineRun[] = [
    {
        _id: "running-run",
        run_name: "Running run",
        pipeline: "oligoseq",
        status: "started",
        timestamp: new Date().toISOString(),
        user_id: "user",
        priority: "default",
        queue_position: [0, 0],
    },
    {
        _id: "completed-run",
        run_name: "Completed run",
        pipeline: "oligoseq",
        status: "success",
        timestamp: new Date().toISOString(),
        user_id: "user",
        priority: "default",
        queue_position: [0, 0],
    },
    {
        _id: "failed-run",
        run_name: "Failed run",
        pipeline: "oligoseq",
        status: "failure",
        timestamp: new Date().toISOString(),
        user_id: "user",
        priority: "default",
        queue_position: [0, 0],
    },
];

test("labels active and terminal recent-run states", () => {
    render(
        <MemoryRouter>
            <RunsContext value={{ runs, loading: false, updateRuns: () => {} }}>
                <RecentRuns />
            </RunsContext>
        </MemoryRouter>
    );

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
});
