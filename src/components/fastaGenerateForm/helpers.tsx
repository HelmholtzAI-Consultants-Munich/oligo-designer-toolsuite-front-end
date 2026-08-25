import { BACKEND_URL } from "../../config";
import { showToast } from "../../utils/toastUtil";
import { extractSubmissionError } from "../errorHandler";
import type { RJSFFormData } from "../componentTypes";
import type { PipelineConfigExport } from "../forms/pipelineConfigIO";
import axios from "axios";
import { type NavigateFunction } from "react-router";
import {
    PIPELINE_CONFIG,
    type PipelineConfig,
} from "../../pipelineConfig/config";

export const replaceUnderscore = (s: string) => s.replaceAll("_", " ");

export const firstLetterUppercase = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Map to convert genomic region names to ones that are nicely displayed
 */
export const regionDisplayNames = {
    gene: "Gene",
    intergenic: "Intergenic",
    exon: "Exon",
    utr: "UTR",
    cds: "CDS",
    intron: "Intron",
    exon_exon_junction: "Exon-exon-junction",
};

/**
 * Build an object from the queue position tuple to simplify working with it.
 *
 * @param queue_position - tuple that describes the number of high priority runs ahead in the first part and the number of low priority runs ahead in the second part
 * @returns object that describes the number of total runs ahead and the queue position
 */
export const unwrapQueuePosition = (queue_position: [number, number]) => {
    const [highPriorityAhead, defaultPriorityAhead] = queue_position;
    const runsAhead = highPriorityAhead + defaultPriorityAhead;
    return {
        runsAhead,
        ownPosition: runsAhead + 1,
    };
};
/**
 * Handles the submission of a pipeline form, including file uploads and API requests, navigates to the run page.
 * @param formData - The data from the form to be submitted.
 * @param pipeline - The name of the pipeline being run.
 * @param run_name - The name of the run.
 * @param updateRuns - A function to refresh the list of runs after submission.
 * @param token - A token for turnstile verification.
 * @param navigate - A function to navigate to a different route after submission.
 * @param pipelineRunConfig - Optional configuration for the pipeline run.
 *
 * @returns A Promise that resolves when the submission process is complete.
 */

/**
 * Custom submit handler for our form that overrides the default submit handler of RJSF.
 * It allow us to inject custom logic for handling file uploads that are not well integrated in RJSF.
 *
 * @param formData - state of the whole Form
 * @param pipeline - name of the pipeline this form is for
 * @param updateRuns - callback to re-fetch the current state of runs from the server after submitting the new one
 * @param token - token for turnstile verification
 * @param pipelineRunConfig - copy of the formData with metadata attached and non savable fields removed, used for useSettings feature
 */
export const handleSubmit = async (
    formData: RJSFFormData,
    pipeline: string,
    run_name: string,
    updateRuns: () => void,
    token: string | null,
    navigate: NavigateFunction,
    pipelineRunConfig?: PipelineConfigExport
) => {
    // copy to avoid modifying formData
    const uploadFormData = structuredClone(formData);

    const retrieveValueFromFormData = (
        formData: RJSFFormData,
        path: (keyof RJSFFormData)[]
    ) => {
        for (const part of path) {
            if (!Object.hasOwn(formData, part)) return;
            formData = formData[part];
        }
        return formData;
    };

    const prepareFileUploads = (
        formData: RJSFFormData,
        uploadFormData: RJSFFormData,
        pipelineName: string
    ) => {
        const fileUploadFieldPath =
            PIPELINE_CONFIG[pipelineName as keyof PipelineConfig]
                .fileUploadFields;

        if (!fileUploadFieldPath) return;

        let files = {};

        for (const path of fileUploadFieldPath) {
            const parentField = retrieveValueFromFormData(
                uploadFormData,
                path.slice(0, -1)
            );
            const filesField = retrieveValueFromFormData(formData, path);

            if (!parentField || !filesField) continue;

            // A codebook or probe table names one file, the other inputs take a list; both
            // send the name in the payload and the file itself alongside it.
            const fileList: File[] = Array.isArray(filesField)
                ? filesField
                : [filesField];

            parentField[path[path.length - 1]] = Array.isArray(filesField)
                ? fileList.map((file) => file.name)
                : fileList[0].name;
            files = fileList.reduce(
                (acc: Record<string, File>, cur: File) => ({
                    ...acc,
                    ...{ [cur.name]: cur },
                }),
                files
            );
        }

        return files;
    };

    try {
        const files = prepareFileUploads(formData, uploadFormData, pipeline);

        const upload = {
            ...files,
            payload: JSON.stringify({
                formdata: uploadFormData,
                token,
                run_name,
                pipeline_run_config: pipelineRunConfig ?? null,
            }),
        };

        const response = await axios.post(
            BACKEND_URL + `/api/${pipeline}`,
            upload,
            {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" },
            }
        );

        const { run_id } = response.data;
        navigate(`/runs/${run_id}`);
    } catch (error) {
        const errorMessage = extractSubmissionError(error);
        if (axios.isAxiosError(error)) {
            const displayedErrorMessage =
                error.response?.status == 413 // flask returns 413 for too large file uploads
                    ? "The uploaded files exceed the maximum allowed size."
                    : errorMessage;

            showToast({
                title: "Pipeline Not Started",
                content: displayedErrorMessage,
                type: "danger",
            });

            if (
                error.response?.status == 403 &&
                errorMessage.includes("verify that you are human")
            ) {
                const turnstile = document.querySelector(
                    ".pipeline-turnstile"
                ) as HTMLDivElement;
                if (turnstile) {
                    turnstile.scrollIntoView({ behavior: "smooth" });
                }
            }
        }
    } finally {
        updateRuns();
    }
};
