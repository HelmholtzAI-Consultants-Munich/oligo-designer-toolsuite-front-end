import axios from "axios";
import { useCallback } from "react";
import { type NavigateFunction } from "react-router";
import { BACKEND_URL } from "../config";
import { showToast } from "./toastUtil";
import type { PipelineRun } from "../types";
import { getPipelineDisplayName } from "../pipelineConfig/utils";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";
import { downloadFile } from "./fileDownloadUtil";

/**
 * Navigates to a pipeline form with a run's configuration pre-loaded.
 * @param run The pipeline run object containing the run ID and pipeline type.
 * @param navigate The navigation function from react-router.
 * @returns A promise resolving when the navigation is complete.
 */
export async function navigateWithRunConfig(
    run: PipelineRun,
    navigate: NavigateFunction
): Promise<void> {
    const route =
        PIPELINE_CONFIG[run.pipeline as keyof typeof PIPELINE_CONFIG]?.link;
    if (!route) {
        showToast({
            title: "Not Supported",
            content: `Loading config is not supported for the "${getPipelineDisplayName(run.pipeline)}" pipeline.`,
            type: "danger",
        });
        return;
    }

    try {
        const response = await axios.get(
            BACKEND_URL + `/api/runs/${run._id}/config`,
            { withCredentials: true }
        );
        navigate(route, { state: { importedConfig: response.data } });
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            showToast({
                title: "No Config Available",
                content: "No saved configuration was found for this run.",
                type: "danger",
            });
        } else {
            showToast({
                title: "Failed to Load Config",
                content:
                    "An error occurred while fetching the run configuration. Please try again.",
                type: "danger",
            });
        }
    }
}

export async function downloadConfig(run: PipelineRun | undefined) {
    if (!run) return;
    const pipelineConfig =
        PIPELINE_CONFIG[run.pipeline as keyof typeof PIPELINE_CONFIG];
    if (!pipelineConfig?.link) {
        showToast({
            title: "Not Supported",
            content: `Loading config is not supported for the "${getPipelineDisplayName(run.pipeline)}" pipeline.`,
            type: "danger",
        });
        return;
    }

    downloadFile(
        BACKEND_URL + `/api/runs/${run._id}/config`,
        `run-${run.pipeline}_config.json`,
        {
            notFound: {
                title: "No Config Available",
                content: "No saved configuration was found for this run.",
            },
            general: {
                title: "Failed to Load Config",
                content:
                    "An error occurred while fetching the run configuration. Please try again.",
            },
        }
    );
}

export function useNavigateWithRunConfig(
    run: PipelineRun | null | undefined,
    navigate: NavigateFunction
) {
    return useCallback(
        () => (run ? navigateWithRunConfig(run, navigate) : Promise.resolve()),
        [run, navigate]
    );
}
