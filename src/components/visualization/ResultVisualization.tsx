import { Tab, Tabs } from "react-bootstrap";
import type { Oligo } from "../../types";
import OligoComponents from "./OligoComponents";
import { useState } from "react";
import GenomeAlignment from "./GenomeAlignment";

type Props = {
    oligos: Oligo[];
    pipeline: string;
    selectedOligo: number;
    setSelectedOligo: (index: number) => void;
}

const ResultVisualization: React.FC<Props> = ({ oligos, pipeline, selectedOligo, setSelectedOligo }) => {
    const [key, setKey] = useState('components');

    return (
        <Tabs
            id="result-visualization-tabs"
            activeKey={key}
            onSelect={(k) => k && setKey(k)}
        >
            <Tab eventKey="components" title="Oligo Components">
                <OligoComponents
                    oligos={oligos}
                    pipeline={pipeline}
                    selectedOligo={selectedOligo}
                    setSelectedOligo={setSelectedOligo}
                />
            </Tab>
            <Tab eventKey="alignment" title="Genome Alignment">
                <GenomeAlignment oligos={oligos} />
            </Tab>
        </Tabs>
    );
};

export default ResultVisualization;
