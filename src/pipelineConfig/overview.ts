import { PIPELINE_CONFIG } from "./config";
import cycleHcrImage from "../images/cyclehr.jpg";
import hcrImage from "../images/hcr.jpg";

export interface PipelineOverviewItem {
    title: string;
    description: string;
    image: string;
    link?: string;
    available: boolean;
}

export const pipelineOverview: PipelineOverviewItem[] = [
    {
        title: PIPELINE_CONFIG.oligoseq.displayName,
        description: PIPELINE_CONFIG.oligoseq.description,
        image: PIPELINE_CONFIG.oligoseq.img,
        link: PIPELINE_CONFIG.oligoseq.link,
        available: !PIPELINE_CONFIG.oligoseq.disabled,
    },
    {
        title: PIPELINE_CONFIG.merfish.displayName.toUpperCase(),
        description: PIPELINE_CONFIG.merfish.description,
        image: PIPELINE_CONFIG.merfish.img,
        link: PIPELINE_CONFIG.merfish.link,
        available: !PIPELINE_CONFIG.merfish.disabled,
    },
    {
        title: PIPELINE_CONFIG.seqfish.displayName,
        description: PIPELINE_CONFIG.seqfish.description,
        image: PIPELINE_CONFIG.seqfish.img,
        link: PIPELINE_CONFIG.seqfish.link,
        available: !PIPELINE_CONFIG.seqfish.disabled,
    },
    {
        title: PIPELINE_CONFIG.scrinshot.displayName.toUpperCase(),
        description: PIPELINE_CONFIG.scrinshot.description,
        image: PIPELINE_CONFIG.scrinshot.img,
        link: PIPELINE_CONFIG.scrinshot.link,
        available: !PIPELINE_CONFIG.scrinshot.disabled,
    },
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
