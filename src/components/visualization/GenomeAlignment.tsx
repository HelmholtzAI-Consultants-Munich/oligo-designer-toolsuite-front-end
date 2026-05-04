import React from "react";
import type { GenomicRegions, Probe } from "../../types";
import GenomeAlignmentD3 from "./GenomeAlignmentD3";
import { Horizontal, Vertical } from "../ui/Alignment";
import { Regions } from "./visualizationHelpers";

type Props = {
    probes: Probe[];
    selectedOligo: string;
    setSelectedOligo: (id: string) => void;
    genomicRegions: GenomicRegions | null;
};

// This component mainly serves as a wrapper for the D3 visualization.
// It forwards the React lifecycle methods to the D3 module.
class GenomeAlignment extends React.Component<Props> {
    private el: SVGSVGElement | null = null;

    componentDidMount() {
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
        GenomeAlignmentD3.destroy(this.el!);
    }

    render() {
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
                            Transcripts
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
                                    <Horizontal
                                        key={index}
                                        gap="sm"
                                        align="baseline"
                                    >
                                        <span
                                            key={index}
                                            style={{
                                                display: "inline-block",
                                                width: "12px",
                                                height: "12px",
                                                backgroundColor:
                                                    Regions[type].color ||
                                                    "lightgray",
                                                marginRight: "5px",
                                            }}
                                        ></span>
                                        {Regions[type].label}
                                    </Horizontal>
                                );
                            })}
                    </Horizontal>
                    <Horizontal wrap gap="md">
                        <strong>Transcripts:</strong>
                        <Horizontal gap="sm" align="baseline">
                            <span
                                style={{
                                    display: "inline-block",
                                    width: "12px",
                                    height: "12px",
                                    backgroundColor: "#22bd28",
                                    marginRight: "5px",
                                }}
                            ></span>
                            Selected oligo matches transcript
                        </Horizontal>
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
