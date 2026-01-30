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

        // Location indicator
        const locationIndicator = plot.append("rect")
            .attr("id", "location-indicator")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", x(1) - x(0))
            .attr("height", innerHeight)
            .attr("fill", "#d4d4d4")
            .attr("opacity", 0)
            .attr("visibility", "hidden")

        // Position label above indicator
        const positionLabel = plot.append("text")
            .attr("id", "position-label")
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .attr("font-size", 9)
            .attr("fill", "black")
            .attr("opacity", 0)
            .attr("visibility", "hidden");

        // Track current zoom transform
        let currentZoomTransform: d3.ZoomTransform = d3.zoomIdentity;

        svg
            .on("mouseenter", () => {
                locationIndicator.attr("visibility", "visible");
                positionLabel.attr("visibility", "visible");
            })
            .on("mousemove", (event) => {
                const [xPos] = d3.pointer(event, plot.node());
                const zx = currentZoomTransform.rescaleX(x);
                const domainX = zx.invert(xPos);
                const snapX = Math.floor(domainX + 0.5);
                locationIndicator
                    .attr("x", zx(snapX - 0.5))
                positionLabel
                    .attr("x", zx(snapX - 0.5))
                    // insert commas for thousands
                    .text(snapX.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
            })
            .on("mouseleave", () => {
                locationIndicator.attr("visibility", "hidden");
                positionLabel.attr("visibility", "hidden");
            });

        plot.append("g")
            .attr("class", "oligos")
            .selectAll("rect")
            .data(oligoPositions)
            .join("rect")
            .attr("x", (d) => x(d.start - 0.5))
            .attr("y", innerHeight * 0.05)
            .attr("width", (d) => x(d.end + 0.5) - x(d.start - 0.5))
            .attr("height", innerHeight / 10)
            .on("click", (_, data) => {
                const index = oligoPositions.findIndex(
                    (pos) => pos.id === data.id
                );
                setSelectedOligo(index);
            });

        // Tooltip
        // TODO: do not append on body
        const tooltip = d3.select("body")
            .append("div")
            .style("opacity", 0)
            .attr("class", "tooltip")
            .style("background-color", "white")
            .style("border", "1px solid black")
            .style("border-width", "2px")
            .style("border-radius", "5px")
            .style("padding", "5px")
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("z-index", "1000");

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

            // Draw a rect for each region
            tGroup
                .selectAll("rect")
                .data(regions)
                .join("rect")
                .attr(
                    "width",
                    (d: GenomicRegion) => x(d.end + 0.5) - x(d.start - 0.5)
                )
                .attr("height", (d: GenomicRegion) =>
                    d.regiontype === "intron"
                        ? Math.min(transcriptHeight / 10, 2)
                        : Math.min(transcriptHeight / 2, 10)
                )
                .attr("x", (d: GenomicRegion) => x(d.start - 0.5))
                .attr("y", function (d: GenomicRegion) {
                    const height = d3.select(this).attr("height");
                    return transcriptHeight / 2 - Number(height) / 2;
                })
                .attr(
                    "fill",
                    (d: GenomicRegion) =>
                        regionColors[d.regiontype || "unknown"].color ||
                        "lightgray"
                )
                .on("mouseover", function () {
                    tooltip.style("opacity", 1);
                    d3.select(this).attr("stroke", "black");
                })
                .on("mousemove", (event, d: GenomicRegion) => {
                    tooltip
                        // TODO: escape HTML
                        .html("Region Type: " + d.regiontype + (d.exon_number ?
                            "<br>Exon " + d.exon_number : "")
                        )
                        .style("left", (event.pageX + 30) + "px")
                        .style("top", (event.pageY) + "px");
                })
                .on("mouseleave", function (_, d: GenomicRegion) {
                    tooltip.style("opacity", 0);
                    d3.select(this).attr("stroke", null);
                });
        });

        // Strand arrows
        const arrowGroup = genomeGroup.append("g").attr("class", "strand-arrows");

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
        const zoomBehavior = d3
            .zoom()
            .scaleExtent([1, (x.domain()[1] - x.domain()[0]) / 100]) // max zoom to 100bp width
            .translateExtent(extent)
            .extent(extent)
            .filter(filter)
            .on("zoom", zoomed);

        svg.call(zoomBehavior);

        function zoomed(event: d3.D3ZoomEvent<Element, unknown>) {
            // Track current zoom transform
            currentZoomTransform = event.transform;
            
            // Rescale x axis
            const zx = event.transform.rescaleX(x);

            // Rescale location indicator
            locationIndicator
                .attr("width", zx(1) - zx(0));

            // Rescale oligos
            plot.selectAll<SVGRectElement, (typeof oligoPositions)[0]>(
                ".oligos rect"
            )
                .attr("x", (d) => zx(d.start - 0.5))
                .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));
            gX.call(xAxis.scale(zx));

            // Rescale genomic regions
            genomeGroup
                .selectAll("g")
                .selectAll<SVGRectElement, GenomicRegion>("rect")
                .attr("x", (d) => zx(d.start - 0.5))
                .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));

            // Rescale tooltip
            plot.selectAll<SVGTextElement, GenomicRegion>("#tooltip").attr(
                "x",
                (d) => zx((d.start + d.end) / 2)
            );

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

            // Generate and render strand arrows
            if (showBases) {
                // Calculate arrow spacing based on zoom level
                // More arrows when zoomed in further
                const pixelsPerBp = zx(1) - zx(0);
                const arrowSpacing = pixelsPerBp >= 10 ? 1 : pixelsPerBp >= 5 ? 3 : 5;

                const arrows: Array<{
                    position: number;
                    strand: string;
                    transcriptIndex: number;
                }> = [];

                const transcriptCount = Object.keys(genomicRegions).length;
                const transcriptHeight = (innerHeight * 0.6) / transcriptCount;
                const actualHeight = Math.min(transcriptHeight / 2, 10);

                Object.entries(genomicRegions).forEach(([_, regions], transcriptIndex) => {
                    regions.forEach((region) => {
                        // Only show arrows for non-intron regions
                        if (region.regiontype === "intron") return;

                        // Only include visible regions
                        if (region.end < domain[0] || region.start > domain[1]) return;

                        // Generate arrow positions within the region
                        const startPos = Math.max(region.start, Math.floor(domain[0]));
                        const endPos = Math.min(region.end, Math.ceil(domain[1]));

                        for (let pos = startPos; pos <= endPos; pos += arrowSpacing) {
                            arrows.push({
                                position: pos,
                                strand: region.strand || "+",
                                transcriptIndex,
                            });
                        }
                    });
                });

                arrowGroup
                    .selectAll<
                        SVGTextElement,
                        {
                            position: number;
                            strand: string;
                            transcriptIndex: number;
                        }
                    >("text")
                    .data(arrows, (d, i) => `${d.position}-${d.transcriptIndex}`)
                    .join("text")
                    .attr("x", (d) => zx(d.position))
                    .attr("y", (d) => {
                        const yOffset =
                            innerHeight / 4 +
                            d.transcriptIndex * transcriptHeight +
                            transcriptHeight / 2;
                        return yOffset + actualHeight / 4;
                    })
                    .attr("font-size", actualHeight)
                    .attr("text-anchor", "middle")
                    .attr("fill", "white")
                    .text((d) => (d.strand === "+" || d.strand === "1" ? ">" : "<"));
            } else {
                // Clear arrows when zoomed out
                arrowGroup.selectAll("text").remove();
            }

            // Show location when bases are shown
            if (showBases) {
                locationIndicator.attr("opacity",1);
                positionLabel.attr("opacity", 1);
            } else {
                locationIndicator.attr("opacity", 0);
                positionLabel.attr("opacity", 0);
            }
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
