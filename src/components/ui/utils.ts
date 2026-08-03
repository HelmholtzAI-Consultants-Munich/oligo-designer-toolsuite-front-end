import { Ban, Check2, ClockHistory, XLg } from "react-bootstrap-icons";
import type { RunState } from "../../types";
import Pulse from "./Pulse";

export const visualizationDisplayNames = {
    alignment: "Genomic Regions",
    components: "Oligo Components",
};

export type VisualizationType = keyof typeof visualizationDisplayNames;

export const runStatusDisplay = {
    success: {
        title: "Success",
        label: "Completed",
        variant: "secondary",
        icon: Check2,
    },
    failure: {
        title: "Failure",
        label: "Failed",
        variant: "danger",
        icon: XLg,
    },
    timeout: {
        title: "Timeout",
        label: "Failed",
        variant: "warning",
        icon: ClockHistory,
    },
    empty_result: {
        title: "Empty Result",
        label: "Completed",
        variant: "warning",
        icon: Ban,
    },
    started: {
        title: "Started",
        label: "Running",
        variant: "secondary",
        icon: Pulse,
    },
    pending: {
        title: "Pending",
        label: "Queued",
        variant: "secondary",
        icon: Pulse.Paused,
    },
};

export const getRunStatusLabel = (status: RunState) =>
    runStatusDisplay[status].label;

export const formatDateTime = (date: string | Date): string =>
    new Date(date).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

export const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)} s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
};
