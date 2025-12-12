import * as d3 from "d3";
import { useEffect } from "react";
import type { Oligo } from "../../types";

type Props = {
    oligos: Oligo[];
}

const GenomeAlignment: React.FC<Props> = ({ oligos }) => {
    useEffect(() => {
        const width = 800;
        const height = 200;
        const margin = 20;

        const x = d3.scaleLinear()
            .domain([1000, 10000])
            .range([margin, width - margin])
        const xAxis = d3.axisBottom(x).tickSizeOuter(0);

        const svg = d3.select("#genome-alignment") as d3.Selection<
            Element,
            unknown,
            Element,
            unknown
        >;

        /* Clear previous contents and transforms */
        svg.selectAll("*").remove();
        svg.call(d3.zoom().transform, d3.zoomIdentity);

        svg.attr("viewBox", [0, 0, width, height])
            .attr("width", width)
            .attr("height", height)
            .attr("style", "width: 100%; height: auto;")

        svg.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height - margin})`)
            .call(xAxis);

        const extent = [[margin, margin], [width - margin, height - margin]];

        svg.call(d3.zoom()
            .scaleExtent([1, 8])
            .translateExtent(extent as [[number, number], [number, number]])
            .extent(extent as [[number, number], [number, number]])
            .on("zoom", zoomed));

        function zoomed(event: d3.D3ZoomEvent<Element, unknown>) {
            x.range([margin, width - margin].map(d => event.transform.applyX(d)));
            svg.selectAll(".x-axis").call(xAxis);
        }
    }, [oligos]);

    return (
        <svg id="genome-alignment"></svg>
    );
}

export default GenomeAlignment;
