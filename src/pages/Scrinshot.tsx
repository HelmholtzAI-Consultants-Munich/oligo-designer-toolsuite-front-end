import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";

const Scrinshot: React.FC = memo(() => (
    <PipelineForm pipeline="scrinshot" title="Scrinshot Probe Designer" />
));
export default Scrinshot;
