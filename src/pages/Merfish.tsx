import { memo } from "react";
import PipelineTemplate from "../components/forms/PipelineTemplate";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const Merfish: React.FC = memo(() => {
    return (
        <PipelineTemplate
            pipeline="merfish"
            title={`${PIPELINE_CONFIG["merfish"].displayName} Probe Designer`}
            schema={PIPELINE_CONFIG["merfish"].schema}
            uiSchema={PIPELINE_CONFIG["merfish"].uiSchema}
        />
    );
});
export default Merfish;
