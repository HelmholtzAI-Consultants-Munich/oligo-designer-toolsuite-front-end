import { memo } from "react";
import PipelineTemplate from "../components/forms/PipelineTemplate";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const Scrinshot: React.FC = memo(() => {
    return (
        <PipelineTemplate
            pipeline="scrinshot"
            title="Scrinshot Probe Designer"
            schema={PIPELINE_CONFIG["scrinshot"].schema}
            uiSchema={PIPELINE_CONFIG["scrinshot"].uiSchema}
        />
    );
});
export default Scrinshot;
