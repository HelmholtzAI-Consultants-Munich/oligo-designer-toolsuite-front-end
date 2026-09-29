import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";

/** The HCR probe designer page. */
const Hcr: React.FC = memo(() => (
    <PipelineForm pipeline="hcr" title="HCR Probe Designer" />
));
export default Hcr;
