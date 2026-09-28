import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";

const CycleHcr: React.FC = memo(() => (
    <PipelineForm pipeline="cyclehcr" title="Cycle HCR Probe Designer" />
));
export default CycleHcr;
