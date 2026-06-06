import { ArrowRight } from "react-bootstrap-icons";
import { BACKEND_URL } from "../../config";
import { createRunId } from "../../contexts/authHelpers";
import { showToast } from "../../utils/toastUtil";
import { extractSubmissionError } from "../errorHandler";
import type { RJSFFormData } from "../componentTypes";
import type { PipelineConfigExport } from "../forms/pipelineConfigIO";
import axios from "axios";
import { Link } from "react-router";
import type {
    EnsemblGenomicForm,
    GenomicForm,
    GenomicRegionsForm,
    NcbiGenomicForm,
} from "./types";
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
    updateRuns: () => void,
    token: string | null,
    pipelineRunConfig?: PipelineConfigExport
) => {
    // copy to avoid modifying formData
    const uploadFormData = structuredClone(formData);

    const newId = await createRunId();
    if (!newId) {
        showToast({
            title: "Pipeline Failed",
            content: "Our servers have failed to create a new run.",
            type: "danger",
        });
        return;
    }

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
                runid: newId,
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

        const { queue_position } = response.data;
        const { ownPosition } = unwrapQueuePosition(queue_position);

        showToast({
            title: "Pipeline Enqueued",
            content: (
                <>
                    <p>The pipeline run was successfully added to the queue.</p>
                    <p>Queue Position: {ownPosition}</p>
                    <Link to={`/runs/${newId}`}>
                        View the run here <ArrowRight />
                    </Link>
                </>
            ),
            type: "success",
        });
    } catch (error) {
        const errorMessage = extractSubmissionError(error);
        if (axios.isAxiosError(error)) {
            switch (error.response?.status) {
                case 401: {
                    showToast({
                        title: "Pipeline Not Started",
                        content: (
                            <>
                                <p>{errorMessage}</p>
                            </>
                        ),
                        type: "danger",
                    });
                    break;
                }
                case 403: {
                    showToast({
                        title: "Pipeline Not Started",
                        content: (
                            <>
                                <p>
                                    We couldn't verify that you are human.
                                    Please try again.
                                </p>
                            </>
                        ),
                        type: "danger",
                    });
                    break;
                }
                case 413: {
                    showToast({
                        title: "Pipeline Not Started",
                        content: (
                            <>
                                <p>
                                    The uploaded files exceed the maximum
                                    allowed size.
                                </p>
                            </>
                        ),
                        type: "danger",
                    });
                    break;
                }
                default: {
                    showToast({
                        title: "Pipeline Failed",
                        content: (
                            <>
                                <p>{errorMessage}</p>
                                <Link className="mt-2" to={`/runs/${newId}`}>
                                    View the run here <ArrowRight />
                                </Link>
                            </>
                        ),
                        type: "danger",
                    });
                }
            }
        }
    } finally {
        updateRuns();
    }
};

export const FilePreview = (file: File) => {
    return `${file.name}`;
};

export const GenomicFormPreview = (form: GenomicForm) => {
    const species = replaceUnderscore(
        firstLetterUppercase(form.source_params.species)
    );
    const selectedRegions = Object.entries(form.genomic_regions)
        .filter(([, selected]) => selected === true)
        .map(
            ([key]) =>
                regionDisplayNames[key as keyof typeof regionDisplayNames]
        );

    return `${species}: ${selectedRegions.join(", ") || "no regions selected"}`;
};
