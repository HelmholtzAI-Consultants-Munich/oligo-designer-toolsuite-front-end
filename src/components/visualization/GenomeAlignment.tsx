import React from "react";
import type { Oligo, GenomicRegions } from "../../types";
import GenomeAlignmentD3, { regionColors } from "./GenomeAlignmentD3";

type Props = {
    oligos: Oligo[];
    selectedOligo: number;
    setSelectedOligo: (index: number) => void;
    genomicRegions: GenomicRegions | null;
};

// This component mainly serves as a wrapper for the D3 visualization.
// It forwards the React lifecycle methods to the D3 module.
class GenomeAlignment extends React.Component<Props> {
    private el: SVGSVGElement | null = null;

    componentDidMount() {
        GenomeAlignmentD3.create(
            this.el!,
            this.props.oligos,
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
                this.props.oligos,
                this.props.genomicRegions || {},
                this.props.selectedOligo,
                this.props.setSelectedOligo
            );
        } else {
            // Otherwise just update the selection
            GenomeAlignmentD3.update(
                this.el!,
                this.props.oligos,
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
                {/* SVG element for D3 to hook into */}
                <svg
                    ref={(el) => {
                        this.el = el;
                    }}
                ></svg>

                {/* Legend and strand information */}
                <div className="container mt-2 mb-4">
                    <div className="row">
                        <div className="col col-auto">
                            <strong>Legend:</strong>
                        </div>
                        {Object.keys(regionColors)
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
                                    <div className="col col-auto" key={index}>
                                        <span
                                            style={{
                                                display: "inline-block",
                                                width: "12px",
                                                height: "12px",
                                                backgroundColor:
                                                    regionColors[type].color ||
                                                    "lightgray",
                                                marginRight: "5px",
                                            }}
                                        ></span>
                                        {regionColors[type].label}
                                    </div>
                                );
                            })}
                    </div>
                    <div className="row">
                        <div className="col col-auto">
                            <strong>Strand:</strong>
                        </div>
                        {Object.values(this.props.genomicRegions)[0][0][
                            "strand"
                        ] || "unknown"}
                    </div>
                </div>
            </>
        );
    }
}

export default GenomeAlignment;
