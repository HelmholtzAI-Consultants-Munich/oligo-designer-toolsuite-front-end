import * as d3 from "d3";
import type { Oligo, GenomicRegions, GenomicRegion } from "../../types";

export const regionColors: { [key: string]: { color: string; label: string } } =
    {
        exon: { color: "blue", label: "Exon" },
        intron: { color: "red", label: "Intron" },
        CDS: { color: "green", label: "CDS" },
        three_prime_UTR: { color: "orange", label: "3' UTR" },
        five_prime_UTR: { color: "orange", label: "5' UTR" },
        exonexonjunction: { color: "darkblue", label: "Start / End of Exon" },
        gene: { color: "purple", label: "Gene" },
        unknown: { color: "lightgray", label: "Unknown" },
    };

// Collect one base per position from genomic regions within the specified range
const collectReferenceBases = (
    regions: GenomicRegions,
    start: number,
    end: number
) => {
    const allRegions = Object.values(regions).flat();
    allRegions.sort((a, b) => a.start - b.start);
    let collectingPosition = start;
    const bases: { char: string; position: number }[] = [];

    allRegions.forEach((region) => {
        if (!region.sequence) {
            return;
        }
        if (collectingPosition >= region.end + 1) {
            return; // already collected this region
        }
        if (collectingPosition > end) {
            return; // beyond desired end
        }

        // Start collecting from the max of current collecting position or region start
        const regionStartPos = Math.max(collectingPosition, region.start);
        for (let pos = regionStartPos; pos <= region.end && pos <= end; pos++) {
            bases.push({
                char: region.sequence[pos - region.start],
                position: pos,
            });
        }
        collectingPosition = region.end + 1;
    });

    return bases;
};

const GenomeAlignmentD3 = {
    create: (
        el: Element,
        oligos: Oligo[],
        genomicRegions: GenomicRegions,
        selectedOligo: number,
        setSelectedOligo: (index: number) => void
    ) => {
        // Set up SVG dimensions and scales
        const width = 800;
        const height = 200;
        const margin = 20;
        const innerWidth = width - margin * 2;
        const innerHeight = height - margin * 2;

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

        // Prepare oligo positions
        const oligoPositions = oligos.map((oligo) => ({
            start: oligo.start[0][0],
            end: oligo.end[0][0],
            id: oligo.oligo_id,
        }));

        // Define x scale based on combined extent of oligos and genomic regions
        const ext = d3.extent([
            ...oligoPositions.flatMap((d) => [d.start, d.end]),
            ...Object.values(genomicRegions)
                .flat()
                .flatMap((d: GenomicRegion) => [d.start, d.end]),
        ]) as [number, number];
        const x = d3
            .scaleLinear()
            .domain([ext[0] - 100, ext[1] + 100])
            .range([0, innerWidth]);
        const xAxis = d3.axisBottom(x).ticks(8);

        // Plot the oligos
        const plot = svg
            .append("g")
            .attr("transform", `translate(${margin},${margin})`);

        plot.append("g")
            .attr("class", "oligos")
            .selectAll("rect")
            .data(oligoPositions)
            .join("rect")
            .attr("x", (d) => x(d.start - 0.5))
            .attr("y", innerHeight * 0.05)
            .attr("width", (d) => x(d.end) - x(d.start))
            .attr("height", innerHeight / 10)
            .on("click", (_, data) => {
                const index = oligoPositions.findIndex(
                    (pos) => pos.id === data.id
                );
                setSelectedOligo(index);
            });

        // Calculate transcript layout
        const transcriptCount = Object.keys(genomicRegions).length;
        const transcriptHeight = (innerHeight * 0.6) / transcriptCount;

        // Draw genomic regions (multiple transcripts)
        const genomeGroup = plot.append("g").attr("class", "genome-regions");

        Object.entries(genomicRegions).forEach(([transcriptName, regions]) => {
            const yOffset =
                innerHeight / 4 +
                Object.keys(genomicRegions).indexOf(transcriptName) *
                    transcriptHeight;

            const tGroup = genomeGroup
                .append("g")
                .attr("transform", `translate(0, ${yOffset})`);

            // Draw a (bold) line for each region
            tGroup
                .selectAll("line")
                .data(regions)
                .join("line")
                .attr("x1", (d: GenomicRegion) => x(d.start - 0.5))
                .attr("x2", (d: GenomicRegion) => x(d.end + 0.5))
                .attr("y1", transcriptHeight / 2)
                .attr("y2", transcriptHeight / 2)
                .attr(
                    "stroke",
                    (d: GenomicRegion) =>
                        regionColors[d.regiontype || "unknown"].color ||
                        "lightgray"
                )
                .attr("stroke-width", (d: GenomicRegion) =>
                    d.regiontype === "intron"
                        ? Math.min(transcriptHeight / 10, 1)
                        : Math.min(transcriptHeight / 2, 10)
                );
        });

        // Reference sequence
        const baseGroup = plot.append("g").attr("class", "reference-bases");

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

        // Set up zoom behavior
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
            // Rescale x axis
            const zx = event.transform.rescaleX(x);

            // Rescale oligos
            plot.selectAll<SVGRectElement, (typeof oligoPositions)[0]>(
                ".oligos rect"
            )
                .attr("x", (d) => zx(d.start - 0.5))
                .attr("width", (d) => zx(d.end) - zx(d.start));
            gX.call(xAxis.scale(zx));

            // Rescale genomic regions
            genomeGroup
                .selectAll("g")
                .selectAll<SVGLineElement, GenomicRegion>("line")
                .attr("x1", (d) => zx(d.start - 0.5))
                .attr("x2", (d) => zx(d.end + 0.5));

            // Calculate visible range
            const domain = zx.domain();
            const visibleRange = domain[1] - domain[0];
            const showBases = visibleRange <= 120;

            // Show bases only when zoomed in to 200bp or less, and only if in view
            const bases = showBases
                ? collectReferenceBases(
                      genomicRegions,
                      Math.floor(domain[0]),
                      Math.ceil(domain[1])
                  )
                : [];
            baseGroup
                .selectAll<SVGTextElement, { char: string; position: number }>(
                    "text"
                )
                .data(bases)
                .join("text")
                .attr("x", (d) => zx(d.position))
                .attr("y", innerHeight - 10)
                .attr("font-size", 10)
                .attr("text-anchor", "middle")
                .text((d) => d.char);
        }

        // Prevent scrolling the whole page when zooming inside the SVG
        function filter(event: d3.D3ZoomEvent<Element, unknown>) {
            event.sourceEvent?.preventDefault();
            return (
                (!event.sourceEvent?.ctrlKey || event.type === "wheel") &&
                !event.sourceEvent?.button
            );
        }

        GenomeAlignmentD3.update(el, oligos, selectedOligo);
    },

    update: (el: Element, oligos: Oligo[], selectedOligo: number) => {
        // Prepare oligo positions
        const oligoPositions = oligos.map((oligo) => ({
            start: oligo.start[0][0],
            end: oligo.end[0][0],
            id: oligo.oligo_id,
        }));

        // Select the SVG element
        const svg = d3.select(el) as d3.Selection<
            Element,
            unknown,
            null,
            unknown
        >;

        // Update oligo colors based on selection
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
        // Clean up the SVG element
        d3.select(el).selectAll("*").remove();
    },
};

export default GenomeAlignmentD3;
