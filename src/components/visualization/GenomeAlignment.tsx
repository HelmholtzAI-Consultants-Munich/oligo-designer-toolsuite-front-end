import React from "react";
import type { Oligo } from "../../types";
import GenomeAlignmentD3 from "./GenomeAlignmentD3";

type Props = {
    oligos: Oligo[];
    selectedOligo: number;
    setSelectedOligo: (index: number) => void;
    genomeRegions: any;
};

class GenomeAlignment extends React.Component<Props> {
    private el: SVGSVGElement | null = null;

    componentDidMount() {
        GenomeAlignmentD3.create(
            this.el!,
            this.props.oligos,
            this.props.genomeRegions,
            this.props.selectedOligo,
            this.props.setSelectedOligo,
        );
    }

    componentDidUpdate() {
        console.log(this.props.genomeRegions);
        GenomeAlignmentD3.update(
            this.el!,
            this.props.oligos,
            this.props.genomeRegions,
            this.props.selectedOligo
        );
    }

    componentWillUnmount() {
        GenomeAlignmentD3.destroy(this.el!);
    }

    render() {
        return (
            <svg
                ref={(el) => {
                    this.el = el;
                }}
            ></svg>
        );
    }
}

export default GenomeAlignment;
