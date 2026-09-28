import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const OligoSeq: React.FC = memo(() => (
    <PipelineForm
        pipeline="oligoseq"
        title={`${PIPELINE_CONFIG["oligoseq"].displayName} Probe Designer`}
    />
));
export default OligoSeq;
