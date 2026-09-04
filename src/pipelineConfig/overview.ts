import { PIPELINE_CONFIG, type Pipeline } from "./config";
import cycleHcrImage from "../images/rna_5_purple_gold.webp";
import hcrImage from "../images/rna_6_green_blue.webp";

export interface PipelineOverviewItem {
    title: string;
    description: string;
    image: string;
    link?: string;
    available: boolean;
}

/**
 * Order the configured pipelines are shown in. Any pipeline missing from this
 * list still appears, after the listed ones, so adding one to PIPELINE_CONFIG
 * is enough to surface it here.
 */
const displayOrder: Pipeline["name"][] = [
    "oligoseq",
    "merfish",
    "seqfish",
    "scrinshot",
];

const rank = (name: Pipeline["name"]) => {
    const index = displayOrder.indexOf(name);
    return index === -1 ? displayOrder.length : index;
};

const configuredPipelines: PipelineOverviewItem[] = (
    Object.keys(PIPELINE_CONFIG) as Pipeline["name"][]
)
    .sort((a, b) => rank(a) - rank(b))
    .map((name) => {
        const pipeline = PIPELINE_CONFIG[name];
        return {
            title: pipeline.displayName,
            description: pipeline.description,
            image: pipeline.img,
            link: pipeline.link,
            available: !pipeline.disabled,
        };
    });

// Announced pipelines that have no PIPELINE_CONFIG entry yet
const upcomingPipelines: PipelineOverviewItem[] = [
    {
        title: "cycleHCR",
        description: "Cyclic hybridization chain reaction probe design.",
        image: cycleHcrImage,
        available: false,
    },
    {
        title: "HCR",
        description: "Hybridization chain reaction probe design.",
        image: hcrImage,
        available: false,
    },
];

export const pipelineOverview: PipelineOverviewItem[] = [
    ...configuredPipelines,
    ...upcomingPipelines,
];
