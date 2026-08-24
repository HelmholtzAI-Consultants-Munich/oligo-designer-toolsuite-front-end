import { memo } from "react";
import PipelineTemplate from "../components/forms/PipelineTemplate";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const Hcr: React.FC = memo(() => {
    return (
        <PipelineTemplate
            pipeline="hcr"
            title="HCR Probe Designer"
            schema={PIPELINE_CONFIG["hcr"].schema}
            uiSchema={PIPELINE_CONFIG["hcr"].uiSchema}
        />
    );
});
export default Hcr;
