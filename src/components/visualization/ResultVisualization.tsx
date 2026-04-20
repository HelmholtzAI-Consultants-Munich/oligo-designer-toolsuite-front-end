import type { GenomicRegions, Probe } from "../../types";
import OligoComponents from "./OligoComponents";
import GenomeAlignment from "./GenomeAlignment";
import type { VisualizationType } from "../ui/utils";

type Props = {
    probes: Probe[];
    selectedOligo: string;
    setSelectedOligo: (id: string) => void;
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
        return (
            <OligoComponents probes={probes} selectedOligo={selectedOligo} />
        );
    }
};

export default ResultVisualization;
