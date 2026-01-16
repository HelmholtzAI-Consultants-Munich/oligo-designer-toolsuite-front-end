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
    // TODO: Define proper type for visualizationRegions
    visualizationRegions: any;
};

const ResultVisualization: React.FC<Props> = ({
    oligos,
    pipeline,
    selectedOligo,
    setSelectedOligo,
    visualizationRegions,
}) => {
    const [key, setKey] = useState("components");

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
                <GenomeAlignment
                    key={oligos.map((o) => o.oligo_id).join(",")} // Force remount on oligos change
                    oligos={oligos}
                    selectedOligo={selectedOligo}
                    setSelectedOligo={setSelectedOligo}
                    visualizationRegions={visualizationRegions}
                />
            </Tab>
        </Tabs>
    );
};

export default ResultVisualization;
