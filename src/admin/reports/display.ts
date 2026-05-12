import { PIPELINE_CONFIG, type Pipeline } from "../../pipelineConfig/config";

export type ReportPipelineKey = Pipeline["name"];

export const REPORT_PIPELINES: ReportPipelineKey[] = Object.values(
    PIPELINE_CONFIG
).map((pipeline) => pipeline.name);

export function formatReportMonth(month: number, format: "long" | "short") {
    return new Date(2000, month - 1, 1).toLocaleString(undefined, {
        month: format,
    });
}
