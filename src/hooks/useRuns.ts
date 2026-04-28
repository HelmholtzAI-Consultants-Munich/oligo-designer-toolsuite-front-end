import { createContext, useContext } from "react";
import type { PipelineRun } from "../types";

export const RunsContext = createContext<{
    runs: PipelineRun[];
    loading: boolean;
    updateRuns: () => void;
}>({
    runs: [],
    loading: false,
    updateRuns: () => {},
});

export const useRuns = () => {
    return useContext(RunsContext);
};
