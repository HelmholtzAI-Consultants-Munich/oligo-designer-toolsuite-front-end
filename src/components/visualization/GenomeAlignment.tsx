import React from "react";
import type { Oligo, GenomicRegions } from "../../types";
import GenomeAlignmentD3, { regionColors } from "./GenomeAlignmentD3";

type Props = {
    oligos: Oligo[];
    selectedOligo: number;
    setSelectedOligo: (index: number) => void;
    genomicRegions: GenomicRegions;
};

class GenomeAlignment extends React.Component<Props> {
    private el: SVGSVGElement | null = null;

    componentDidMount() {
        GenomeAlignmentD3.create(
            this.el!,
            this.props.oligos,
            this.props.genomicRegions,
            this.props.selectedOligo,
            this.props.setSelectedOligo
        );
    }

    componentDidUpdate() {
        GenomeAlignmentD3.update(
            this.el!,
            this.props.oligos,
            this.props.selectedOligo
        );
    }

    componentWillUnmount() {
        GenomeAlignmentD3.destroy(this.el!);
    }

    render() {
        return (
            <>
                <svg
                    ref={(el) => {
                        this.el = el;
                    }}
                ></svg>
                <div className="container mt-2 mb-4">
                    <div className="row">
                        <div className="col col-auto">
                            <strong>Legend:</strong>
                        </div>
                        {Object.keys(regionColors)
                            .filter((label) => {
                                return Object.values(
                                    this.props.genomicRegions
                                ).some((regions) =>
                                    regions.some(
                                        (region) => region.regiontype === label
                                    )
                                );
                            })
                            .map((label, index) => {
                                return (
                                    <div className="col col-auto" key={index}>
                                        <span
                                            style={{
                                                display: "inline-block",
                                                width: "12px",
                                                height: "12px",
                                                backgroundColor:
                                                    regionColors[label] ||
                                                    "lightgray",
                                                marginRight: "5px",
                                            }}
                                        ></span>
                                        {label}
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
