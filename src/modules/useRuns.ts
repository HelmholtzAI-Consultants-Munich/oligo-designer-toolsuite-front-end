import { createContext, useContext } from "react";
import type { PipelineRun } from "../types";

export const RunsContext = createContext<{
    runs: PipelineRun[];
    updateRuns: () => void;
}>({
    runs: [],
    updateRuns: () => {},
});

export const useRuns = () => {
    return useContext(RunsContext);
}
