import { memo } from "react";
import PipelineTemplate from "../components/forms/PipelineTemplate";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const CycleHcr: React.FC = memo(() => {
    return (
        <PipelineTemplate
            pipeline="cyclehcr"
            title="Cycle HCR Probe Designer"
            schema={PIPELINE_CONFIG["cyclehcr"].schema}
            uiSchema={PIPELINE_CONFIG["cyclehcr"].uiSchema}
        />
    );
});
export default CycleHcr;
