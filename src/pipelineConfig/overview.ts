import {
    Activity,
    ArrowRight,
    Bezier2,
    Bullseye,
    Diagram3,
    type Icon,
} from "react-bootstrap-icons";
import { PIPELINE_CONFIG } from "./config";

export interface PipelineOverviewItem {
    title: string;
    description: string;
    icon: Icon;
    iconColor: string;
    link?: string;
    available: boolean;
}

export const pipelineOverview: PipelineOverviewItem[] = [
    {
        title: PIPELINE_CONFIG.oligoseq.displayName,
        description: PIPELINE_CONFIG.oligoseq.description,
        icon: Bezier2,
        iconColor: "#006593",
        link: PIPELINE_CONFIG.oligoseq.link,
        available: !PIPELINE_CONFIG.oligoseq.disabled,
    },
    {
        title: "MERFISH",
        description: PIPELINE_CONFIG.merfish.description,
        icon: Bullseye,
        iconColor: "#3c9c50",
        link: PIPELINE_CONFIG.merfish.link,
        available: !PIPELINE_CONFIG.merfish.disabled,
    },
    {
        title: PIPELINE_CONFIG.seqfish.displayName,
        description: PIPELINE_CONFIG.seqfish.description,
        icon: Activity,
        iconColor: "#6f2da8",
        link: PIPELINE_CONFIG.seqfish.link,
        available: !PIPELINE_CONFIG.seqfish.disabled,
    },
    {
        title: "SCRINSHOT",
        description: PIPELINE_CONFIG.scrinshot.description,
        icon: Bullseye,
        iconColor: "#e56b1f",
        link: PIPELINE_CONFIG.scrinshot.link,
        available: !PIPELINE_CONFIG.scrinshot.disabled,
    },
    {
        title: "cycleHCR",
        description: "Cyclic hybridization chain reaction probe design.",
        icon: ArrowRight,
        iconColor: "#2563a8",
        available: false,
    },
    {
        title: "HCR",
        description: "Hybridization chain reaction probe design.",
        icon: Diagram3,
        iconColor: "#48bfc0",
        available: false,
    },
];
