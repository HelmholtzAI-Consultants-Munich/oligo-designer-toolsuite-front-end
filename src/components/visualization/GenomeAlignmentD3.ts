import * as d3 from "d3";
import type { Oligo } from "../../types";

const GenomeAlignmentD3 = {
    create: (
        el: Element,
        oligos: any[],
        selectedOligo: number,
        setSelectedOligo: (index: number) => void
    ) => {
        const width = 800;
        const height = 200;
        const margin = 20;
        const innerWidth = width - margin * 2;
        const innerHeight = height - margin * 2;

        const oligoPositions = oligos.map((oligo) => ({
            start: oligo.start[0][0],
            end: oligo.end[0][0],
            id: oligo.oligo_id,
        }));

        const svg = d3.select(el) as d3.Selection<
            Element,
            unknown,
            null,
            unknown
        >;

        svg.attr("viewBox", [0, 0, width, height])
            .attr("width", width)
            .attr("height", height)
            .attr("style", "width: 100%; height: auto;");

        const ext = d3.extent(
            oligoPositions.flatMap((d) => [d.start, d.end])
        ) as [number, number];
        const x = d3
            .scaleLinear()
            .domain([ext[0] - 100, ext[1] + 100])
            .range([0, innerWidth]);
        const xAxis = d3.axisBottom(x).ticks(8);

        // Inner plot group with padding
        const plot = svg
            .append("g")
            .attr("transform", `translate(${margin},${margin})`);

        plot.append("g")
            .attr("class", "oligos")
            .selectAll("rect")
            .data(oligoPositions)
            .join("rect")
            .attr("x", (d) => x(d.start))
            .attr("y", innerHeight / 3)
            .attr("width", (d) => x(d.end) - x(d.start))
            .attr("height", innerHeight / 10)
            .on("click", (_, data) => {
                console.log(data);
                const index = oligoPositions.findIndex(
                    (pos) => pos.id === data.id
                );
                setSelectedOligo(index);
            });

        // Append the x-axis inside the plot area
        const gX = plot
            .append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis);

        const extent: [[number, number], [number, number]] = [
            [0, 0],
            [innerWidth, innerHeight],
        ];

        svg.call(
            d3
                .zoom()
                .scaleExtent([1, (x.domain()[1] - x.domain()[0]) / 100]) // max zoom to 100bp width
                .translateExtent(extent)
                .extent(extent)
                .filter(filter)
                .on("zoom", zoomed)
        );

        function zoomed(event: d3.D3ZoomEvent<Element, unknown>) {
            const zx = event.transform.rescaleX(x); // zoomed scale
            plot.selectAll<SVGRectElement, (typeof oligoPositions)[0]>(
                ".oligos rect"
            )
                .attr("x", (d) => zx(d.start))
                .attr("width", (d) => zx(d.end) - zx(d.start));
            gX.call(xAxis.scale(zx));
        }

        // prevent scrolling then apply the default filter
        function filter(event: any) {
            event.preventDefault();
            return (!event.ctrlKey || event.type === "wheel") && !event.button;
        }

        GenomeAlignmentD3.update(el, oligos, selectedOligo);
    },

    update: (el: Element, oligos: Oligo[], selectedOligo: number) => {
        const oligoPositions = oligos.map((oligo) => ({
            start: oligo.start[0][0],
            end: oligo.end[0][0],
            id: oligo.oligo_id,
        }));

        const svg = d3.select(el) as d3.Selection<
            Element,
            unknown,
            null,
            unknown
        >;

        svg.selectAll<SVGRectElement, (typeof oligoPositions)[0]>(
            ".oligos rect"
        )
            .data(oligoPositions)
            .join("rect")
            .attr("fill", (d, i) =>
                i === selectedOligo ? "orange" : "steelblue"
            );
    },

    destroy: (el: Element) => {
        d3.select(el).selectAll("*").remove();
    },
};

export default GenomeAlignmentD3;
