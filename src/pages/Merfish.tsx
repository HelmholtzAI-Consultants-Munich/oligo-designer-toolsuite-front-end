import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

/** The MERFISH probe designer page. */
const Merfish: React.FC = memo(() => (
    <PipelineForm
        pipeline="merfish"
        title={`${PIPELINE_CONFIG["merfish"].displayName} Probe Designer`}
    />
));
export default Merfish;
