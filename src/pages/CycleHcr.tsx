import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";

/** The Cycle HCR probe designer page. */
const CycleHcr: React.FC = memo(() => (
    <PipelineForm pipeline="cyclehcr" title="Cycle HCR Probe Designer" />
));
export default CycleHcr;
