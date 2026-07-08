import { ArrowRight } from "react-bootstrap-icons";
import { BACKEND_URL } from "../../config";
import { showToast } from "../../utils/toastUtil";
import { extractSubmissionError } from "../errorHandler";
import type { RJSFFormData } from "../componentTypes";
import type { PipelineConfigExport } from "../forms/pipelineConfigIO";
import axios from "axios";
import { Link } from "react-router";
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
    updateRuns: () => void,
    token: string | null,
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

            parentField[path[path.length - 1]] = filesField.map(
                (file: File) => file.name
            );
            files = filesField.reduce(
                (acc: Record<string, File>, cur: File) => ({
                    ...acc,
                    ...{ [cur.name]: cur },
                }),
                {}
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

        const { queue_position, run_id } = response.data;
        const { ownPosition } = unwrapQueuePosition(queue_position);

        showToast({
            title: "Pipeline Enqueued",
            content: (
                <>
                    <p>The pipeline run was successfully added to the queue.</p>
                    <p>Queue Position: {ownPosition}</p>
                    <Link to={`/runs/${run_id}`}>
                        View the run here <ArrowRight />
                    </Link>
                </>
            ),
            type: "success",
        });
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
