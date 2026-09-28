import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const Scrinshot: React.FC = memo(() => (
    <PipelineForm
        pipeline="scrinshot"
        title={`${PIPELINE_CONFIG["scrinshot"].displayName} Probe Designer`}
    />
));
export default Scrinshot;
