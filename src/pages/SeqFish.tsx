import { memo } from "react";
import PipelineTemplate from "../components/forms/PipelineTemplate";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const Seqfish: React.FC = memo(() => {
    return (
        <PipelineTemplate
            pipeline="seqfish"
            title="Seqfish+ Probe Designer"
            schema={PIPELINE_CONFIG["seqfish"].schema}
            uiSchema={PIPELINE_CONFIG["seqfish"].uiSchema}
        />
    );
});
export default Seqfish;
