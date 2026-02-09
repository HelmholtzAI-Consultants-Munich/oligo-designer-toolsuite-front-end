import { Tab, Tabs } from "react-bootstrap";
import type { GenomicRegions, Probe } from "../../types";
import OligoComponents from "./OligoComponents";
import { useState } from "react";
import GenomeAlignment from "./GenomeAlignment";

type Props = {
    probes: Probe[];
    selectedOligo: string;
    setSelectedOligo: (id: string) => void;
    genomicRegions: GenomicRegions | null;
};

const ResultVisualization: React.FC<Props> = ({
    probes,
    selectedOligo,
    setSelectedOligo,
    genomicRegions,
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
                    probes={probes}
                    selectedOligo={selectedOligo}
                    setSelectedOligo={setSelectedOligo}
                />
            </Tab>
            <Tab eventKey="alignment" title="Genomic Regions">
                <GenomeAlignment
                    key={probes.map((p) => p.oligo_id).join(",")} // Force remount on probes change
                    probes={probes}
                    selectedOligo={selectedOligo}
                    setSelectedOligo={setSelectedOligo}
                    genomicRegions={genomicRegions}
                />
            </Tab>
        </Tabs>
    );
};

export default ResultVisualization;
