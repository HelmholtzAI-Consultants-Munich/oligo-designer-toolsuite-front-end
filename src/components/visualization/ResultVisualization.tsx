import type { GenomicRegions, Probe } from "../../types";
import OligoComponents from "./OligoComponents";
import GenomeAlignment from "./GenomeAlignment";
import type { VisualizationType } from "../ui/utils";

type Props = {
    probes: Probe[];
    selectedOligo: string | null;
    setSelectedOligo: (id: string | null) => void;
    genomicRegions: GenomicRegions | null;
    selectedVisualization: VisualizationType;
};

const ResultVisualization: React.FC<Props> = ({
    probes,
    selectedOligo,
    setSelectedOligo,
    genomicRegions,
    selectedVisualization,
}) => {
    if (selectedVisualization === "alignment") {
        return (
            <GenomeAlignment
                key={probes.map((p) => p.oligo_id).join(",")} // Force remount on probes change
                probes={probes}
                selectedOligo={selectedOligo}
                setSelectedOligo={setSelectedOligo}
                genomicRegions={genomicRegions}
            />
        );
    } else if (selectedVisualization === "components") {
        if (!selectedOligo) {
            return <div>Please select an oligo to view its components.</div>;
        }
        return (
            <OligoComponents probes={probes} selectedOligo={selectedOligo} />
        );
    }
};

export default ResultVisualization;
