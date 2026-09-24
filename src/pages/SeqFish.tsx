import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";
import { PIPELINE_CONFIG } from "../pipelineConfig/config";

const SeqFish: React.FC = memo(() => (
    <PipelineForm
        pipeline="seqfish"
        title={`${PIPELINE_CONFIG["seqfish"].displayName} Probe Designer`}
    />
));
export default SeqFish;
