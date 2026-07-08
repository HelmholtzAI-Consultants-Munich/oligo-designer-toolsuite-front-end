import { BACKEND_URL } from "../../config";
import { showToast } from "../../utils/toastUtil";
import { extractSubmissionError } from "../errorHandler";
import type { RJSFFormData } from "../componentTypes";
import type { PipelineConfigExport } from "../forms/pipelineConfigIO";
import axios from "axios";
import { useNavigate } from "react-router";
import {
    PIPELINE_CONFIG,
    type PipelineConfig,
} from "../../pipelineConfig/config";

export const replaceUnderscore = (s: string) => s.replaceAll("_", " ");

export const firstLetterUppercase = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1);

export const regionDisplayNames = {
    gene: "Gene",
    intergenic: "Intergenic",
    exon: "Exon",
    utr: "UTR",
    cds: "CDS",
    intron: "Intron",
    exon_exon_junction: "Exon-exon-junction",
};

export const unwrapQueuePosition = (queue_position: [number, number]) => {
    const [highPriorityAhead, defaultPriorityAhead] = queue_position;
    const runsAhead = highPriorityAhead + defaultPriorityAhead;
    return {
        runsAhead,
        ownPosition: runsAhead + 1,
    };
};

export const handleSubmit = async (
    formData: RJSFFormData,
    pipeline: string,
    run_name: string,
    updateRuns: () => void,
    token: string | null,
    navigate: ReturnType<typeof useNavigate>,
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
