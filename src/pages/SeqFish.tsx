import { memo } from "react";
import PipelineForm from "../components/forms/PipelineForm";

const SeqFish: React.FC = memo(() => (
    <PipelineForm pipeline="seqfish" title="Seqfish+ Probe Designer" />
));
export default SeqFish;
