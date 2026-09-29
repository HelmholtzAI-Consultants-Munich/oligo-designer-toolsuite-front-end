import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

/** The SCRINSHOT probe designer page. */
const Scrinshot: React.FC = memo(() => (
    <PipelineForm
        pipeline="scrinshot"
        title={`${PIPELINE_CONFIG["scrinshot"].displayName} Probe Designer`}
    />
));
export default Scrinshot;
