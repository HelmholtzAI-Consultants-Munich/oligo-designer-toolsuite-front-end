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
    EnsGenomicForm,
    FilePath,
    GenomicForm,
    GenomicRegionsForm,
    NcbiGenomicForm,
} from "./types";

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

export const defaultGenomicRegionsForm: GenomicRegionsForm = {
    gene: false,
    intergenic: false,
    exon: true,
    utr: false,
    cds: false,
    intron: false,
    exon_exon_junction: false,
};

export const defaultNcbiFormData: NcbiGenomicForm = {
    source: "ncbi",
    source_params: {
        species: "Homo_sapiens",
        annotation_release: "110",
        taxon: "vertebrate_mammalian",
        assembly_source: "auto",
        mode: "species",
    },
    genomic_regions: defaultGenomicRegionsForm,
    exon_exon_junction_block_size: 50,
};

export const defaultEnsFormData: EnsGenomicForm = {
    source: "ensembl",
    source_params: {
        species: "homo_sapiens",
        annotation_release: "current",
    },
    genomic_regions: defaultGenomicRegionsForm,
    exon_exon_junction_block_size: 50,
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

    try {
        const upload = {
            payload: JSON.stringify({
                formdata: uploadFormData,
                runid: newId,
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
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            showToast({
                title: "Pipeline Not Started",
                content: (
                    <>
                        <p>{errorMessage}</p>
                    </>
                ),
                type: "danger",
            });
        } else {
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
    } finally {
        updateRuns();
    }
};

export const FilePreview = (file: FilePath) => {
    return `${file}`;
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
