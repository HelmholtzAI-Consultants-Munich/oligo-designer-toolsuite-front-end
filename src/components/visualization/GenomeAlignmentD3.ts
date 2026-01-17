import * as d3 from "d3";
import type { Oligo } from "../../types";

const GenomeAlignmentD3 = {
    create: (
        el: Element,
        oligos: any[],
        genomeRegions: any[],
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

        const ext = d3.extent([
            ...oligoPositions.flatMap((d) => [d.start, d.end]),
            ...Object.values(genomeRegions).flat().flatMap((d: any) => [d.start, d.end]),
        ]) as [number, number];
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

        const transcriptCount = Object.keys(genomeRegions).length;
        const transcriptHeight = innerHeight / 2 / transcriptCount;

        // Draw genome regions as lines
        const genomeGroup = plot.append("g").attr("class", "genome-regions");

        Object.entries(genomeRegions).forEach(([transcriptName, regions]) => {
            const tGroup = genomeGroup
                .append("g")
                .attr(
                    "transform",
                    `translate(0, ${
                        innerHeight / 2 +
                        Object.keys(genomeRegions).indexOf(transcriptName) *
                            transcriptHeight
                    })`
                );

            // Transcript label
            // tGroup
            //     .append("text")
            //     .attr("x", -margin + 5)
            //     .attr("y", transcriptHeight / 2)
            //     .attr("dominant-baseline", "middle")
            //     .text(transcriptName);

            // Regions
            tGroup
                .selectAll("line")
                .data(regions)
                .join("line")
                .attr("x1", (d: any) => x(d.start))
                .attr("x2", (d: any) => x(d.end + 1))
                .attr("y1", transcriptHeight / 2)
                .attr("y2", transcriptHeight / 2)
                .attr("stroke", "black")
                .attr("stroke-width", (d: any) => (d.regiontype === 'intron' ? 1 : transcriptHeight / 4));
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

            genomeGroup.selectAll("g").selectAll("line")
                .attr("x1", (d: any) => zx(d.start))
                .attr("x2", (d: any) => zx(d.end + 1));
        }

        // prevent scrolling then apply the default filter
        function filter(event: any) {
            event.preventDefault();
            return (!event.ctrlKey || event.type === "wheel") && !event.button;
        }

        GenomeAlignmentD3.update(el, oligos, genomeRegions, selectedOligo);
    },

    update: (el: Element, oligos: Oligo[], genomeRegions: any[], selectedOligo: number) => {
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
