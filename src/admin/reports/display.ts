import { pipelineDisplayNames } from "../../components/ui/utils";
import type { MonthlyReport } from "./types";

export type ReportPipelineKey = keyof MonthlyReport["runs"]["by_pipeline"];

export const REPORT_PIPELINES: ReportPipelineKey[] = [
    "scrinshot",
    "seqfish",
    "merfish",
    "oligoseq",
];

export function formatReportMonth(month: number, format: "long" | "short") {
    return new Date(2000, month - 1, 1).toLocaleString(undefined, {
        month: format,
    });
}

export function getReportPipelineDisplayName(pipeline: ReportPipelineKey) {
    return pipelineDisplayNames[pipeline] ?? pipeline;
}
