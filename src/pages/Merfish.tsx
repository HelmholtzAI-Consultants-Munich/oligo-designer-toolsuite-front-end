import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";

const Merfish: React.FC = memo(() => (
    <PipelineForm pipeline="merfish" title="Merfish Probe Designer" />
));
export default Merfish;
