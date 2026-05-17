import { Ban, Check2, ClockHistory, XLg } from "react-bootstrap-icons";
import Pulse from "./Pulse";

export const visualizationDisplayNames = {
    alignment: "Genomic Regions",
    components: "Oligo Components",
};

export type VisualizationType = keyof typeof visualizationDisplayNames;

export const runStatusDisplay = {
    success: {
        title: "Success",
        variant: "secondary",
        icon: Check2,
    },
    failure: {
        title: "Failure",
        variant: "danger",
        icon: XLg,
    },
    timeout: {
        title: "Timeout",
        variant: "warning",
        icon: ClockHistory,
    },
    empty_result: {
        title: "Empty Result",
        variant: "warning",
        icon: Ban,
    },
    started: {
        title: "Started",
        variant: "secondary",
        icon: Pulse,
    },
    pending: {
        title: "Pending",
        variant: "secondary",
        icon: Pulse.Paused,
    },
};
