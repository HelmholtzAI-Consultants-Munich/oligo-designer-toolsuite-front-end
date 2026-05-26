import { type Pipeline } from "../../pipelineConfig/config";
import { getEnabledPipelinesOnly } from "../../pipelineConfig/utils";

export type ReportPipelineKey = Pipeline["name"];

export const REPORT_PIPELINES: ReportPipelineKey[] = Object.values(
    getEnabledPipelinesOnly()
).map((pipeline) => pipeline.name);

export function formatReportMonth(month: number, format: "long" | "short") {
    return new Date(2000, month - 1, 1).toLocaleString(undefined, {
        month: format,
    });
}
