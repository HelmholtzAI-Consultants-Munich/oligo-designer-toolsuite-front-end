import { PIPELINE_CONFIG, type PipelineConfig } from "./config";

export function getPipelineDisplayName(pipeline: string) {
    const pipelineConfigKey = pipeline as keyof PipelineConfig;
    return PIPELINE_CONFIG[pipelineConfigKey]
        ? PIPELINE_CONFIG[pipelineConfigKey].displayName
        : "Unknown Pipeline";
}
