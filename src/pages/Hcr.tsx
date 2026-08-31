import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";

const Hcr: React.FC = memo(() => (
    <PipelineForm pipeline="hcr" title="HCR Probe Designer" />
));
export default Hcr;
