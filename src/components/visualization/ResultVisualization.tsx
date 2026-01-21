import { Tab, Tabs } from "react-bootstrap";
import type { Oligo, GenomicRegions } from "../../types";
import OligoComponents from "./OligoComponents";
import { useState } from "react";
import GenomeAlignment from "./GenomeAlignment";

type Props = {
    oligos: Oligo[];
    pipeline: string;
    selectedOligo: number;
    setSelectedOligo: (index: number) => void;
    genomicRegions: GenomicRegions | null;
};

const ResultVisualization: React.FC<Props> = ({
    oligos,
    pipeline,
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
                    oligos={oligos}
                    pipeline={pipeline}
                    selectedOligo={selectedOligo}
                    setSelectedOligo={setSelectedOligo}
                />
            </Tab>
            <Tab eventKey="alignment" title="Genomic Regions">
                <GenomeAlignment
                    key={oligos.map((o) => o.oligo_id).join(",")} // Force remount on oligos change
                    oligos={oligos}
                    selectedOligo={selectedOligo}
                    setSelectedOligo={setSelectedOligo}
                    genomicRegions={genomicRegions}
                />
            </Tab>
        </Tabs>
    );
};

export default ResultVisualization;
