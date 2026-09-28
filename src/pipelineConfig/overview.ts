import { PIPELINE_CONFIG, type Pipeline } from "./config";

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

export const pipelineOverview: PipelineOverviewItem[] = (
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
