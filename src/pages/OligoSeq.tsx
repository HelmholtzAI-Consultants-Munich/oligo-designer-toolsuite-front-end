import { memo } from "react";
import PipelineTemplate from "../components/forms/PipelineTemplate";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const Oligoseq: React.FC = memo(() => {
    return (
        <PipelineTemplate
            pipeline="oligoseq"
            title={`${PIPELINE_CONFIG["oligoseq"].displayName} Probe Designer`}
            schema={PIPELINE_CONFIG["oligoseq"].schema}
            uiSchema={PIPELINE_CONFIG["oligoseq"].uiSchema}
        />
    );
});
export default Oligoseq;
