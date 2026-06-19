import React from "react";
import type { GenomicRegions, Probe } from "../../types";
import GenomeAlignmentD3 from "./GenomeAlignmentD3";
import { Horizontal, Vertical } from "../ui/Alignment";
import { Regions } from "./genomeAlignmentHelpers";
import { LegendItem } from "./LegendItem";

type Props = {
    probes: Probe[];
    selectedOligo: string | null;
    setSelectedOligo: (id: string | null) => void;
    genomicRegions: GenomicRegions | null;
};

/**
 * Displays a genome alignment visualization using D3. It shows the genomic regions of the transcripts and the positions of the oligos.
 *
 * @remarks
 * This component wraps the D3 visualization and synchronizes it with the React lifecycle and state.
 *
 * @param probes - The list of probes to visualize.
 * @param selectedOligo - The ID of the currently selected oligo, or null if no oligo is selected.
 * @param setSelectedOligo - A callback to update the selected oligo.
 * @param genomicRegions - The genomic regions data to visualize, or null if not available.
 * @returns A React component that renders the genome alignment visualization and its legend.
 */
class GenomeAlignment extends React.Component<Props> {
    private el: SVGSVGElement | null = null;

    componentDidMount() {
        // Initialize the D3 visualization when the component mounts
        GenomeAlignmentD3.create(
            this.el!,
            this.props.probes,
            this.props.genomicRegions || {},
            this.props.selectedOligo,
            this.props.setSelectedOligo
        );
    }

    componentDidUpdate(prevProps: Props) {
        // If genomicRegions changed, recreate the entire visualization
        if (prevProps.genomicRegions !== this.props.genomicRegions) {
            GenomeAlignmentD3.destroy(this.el!);
            GenomeAlignmentD3.create(
                this.el!,
                this.props.probes,
                this.props.genomicRegions || {},
                this.props.selectedOligo,
                this.props.setSelectedOligo
            );
        } else if (prevProps.selectedOligo !== this.props.selectedOligo) {
            // If selectedOligo changed, update the visualization and zoom into the oligo
            GenomeAlignmentD3.update(
                this.el!,
                this.props.probes,
                this.props.selectedOligo,
                true
            );
        } else {
            // Otherwise just update the visualization
            GenomeAlignmentD3.update(
                this.el!,
                this.props.probes,
                this.props.selectedOligo
            );
        }
    }

    componentWillUnmount() {
        // Clean up the D3 visualization when the component unmounts
        GenomeAlignmentD3.destroy(this.el!);
    }

    render() {
        const transcriptIds = Object.keys(this.props.genomicRegions || {});
        const isGene =
            transcriptIds.length === 1 && transcriptIds[0] === "unknown";

        if (!this.props.genomicRegions) {
            return (
                <p>
                    Genomic regions data is not available. Try reloading the
                    page.
                </p>
            );
        }
        return (
            <>
                <Horizontal gap="md">
                    <Vertical gap="md" fillHeight className="small">
                        <div
                            style={{
                                writingMode: "vertical-rl",
                                transform: "rotate(180deg)",
                            }}
                        >
                            Oligos
                        </div>
                        <div
                            className="flex-grow-1 text-center"
                            style={{
                                writingMode: "vertical-rl",
                                transform: "rotate(180deg)",
                            }}
                        >
                            {isGene ? "Gene" : "Transcripts"}
                        </div>
                    </Vertical>
                    {/* SVG element for D3 to hook into */}
                    <svg
                        ref={(el) => {
                            this.el = el;
                        }}
                    ></svg>
                </Horizontal>

                {/* Legend and strand information */}
                <Vertical>
                    <Horizontal wrap gap="md">
                        <strong>Oligos:</strong>
                        <LegendItem color="steelblue" label="Oligo" />
                        {this.props.selectedOligo && (
                            <LegendItem color="orange" label="Selected oligo" />
                        )}
                        {!isGene && this.props.selectedOligo && (
                            <LegendItem
                                color="#22bd28"
                                label="Selected oligo matches transcript"
                            />
                        )}
                    </Horizontal>
                    <Horizontal wrap gap="md">
                        <strong>Regions:</strong>
                        {Object.keys(Regions)
                            .filter((type) => {
                                return Object.values(
                                    this.props.genomicRegions!
                                ).some((regions) =>
                                    regions.some(
                                        (region) => region.regiontype === type
                                    )
                                );
                            })
                            .map((type, index) => {
                                return (
                                    <LegendItem
                                        key={index}
                                        color={
                                            Regions[type].color || "lightgray"
                                        }
                                        label={Regions[type].label}
                                    />
                                );
                            })}
                    </Horizontal>
                    <Horizontal wrap gap="md">
                        <strong>Strand:</strong>
                        {Object.values(this.props.genomicRegions)[0][0][
                            "strand"
                        ] == "+"
                            ? "plus"
                            : "minus"}
                    </Horizontal>
                </Vertical>
            </>
        );
    }
}

export default GenomeAlignment;
