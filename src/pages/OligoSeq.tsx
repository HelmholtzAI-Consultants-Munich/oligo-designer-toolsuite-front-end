import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";

const OligoSeq: React.FC = memo(() => (
    <PipelineForm pipeline="oligoseq" title="OligoSeq Probe Designer" />
));
export default OligoSeq;
