import * as d3 from "d3";
import { useEffect } from "react";
import type { Oligo } from "../../types";

type Props = {
    oligos: Oligo[];
    selectedOligo?: number;
}

const GenomeAlignment: React.FC<Props> = ({ oligos, selectedOligo }) => {
    useEffect(() => {
        const width = 800;
        const height = 200;
        const margin = 20;
        const innerWidth = width - margin * 2;
        const innerHeight = height - margin * 2;

        const oligoPositions = oligos.map(oligo => [oligo.start, oligo.end]);

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

        const x = d3.scaleLinear()
            .domain(d3.extent(oligoPositions.flat()) as [number, number])
            .range([0, innerWidth]);
        const xAxis = d3.axisBottom(x);

        // Inner plot group with padding
        const plot = svg.append("g")
            .attr("transform", `translate(${margin},${margin})`);

        plot.append("g")
            .attr("class", "oligos")
            .selectAll("rect")
            .data(oligoPositions)
            .join("rect")
            .attr("fill", (d, i) => i === selectedOligo ? "orange" : "steelblue")
            .attr("x", d => x(d[0]))
            .attr("y", innerHeight / 3)
            .attr("width", d => x(d[1]) - x(d[0]))
            .attr("height", innerHeight / 10);

        // Append the x-axis inside the plot area
        const gX = plot.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis);

        const extent: [[number, number], [number, number]] = [[0, 0], [innerWidth, innerHeight]];

        svg.call(d3.zoom()
            .scaleExtent([1, 8])
            .translateExtent(extent)
            .extent(extent)
            .filter(filter)
            .on("zoom", zoomed));

        function zoomed(event: d3.D3ZoomEvent<Element, unknown>) {
            const zx = event.transform.rescaleX(x); // zoomed scale
            plot.selectAll<SVGRectElement, number[]>(".oligos rect")
                .attr("x", d => zx(d[0]))
                .attr("width", d => zx(d[1]) - zx(d[0]));
            gX.call(xAxis.scale(zx));
        }

        // prevent scrolling then apply the default filter
        function filter(event: any) {
            event.preventDefault();
            return (!event.ctrlKey || event.type === 'wheel') && !event.button;
        }
    }, [oligos, selectedOligo]);

    return (
        <svg id="genome-alignment"></svg>
    );
}

export default GenomeAlignment;
