import * as d3 from "d3";
import type { Oligo, GenomicRegions, GenomicRegion } from "../../types";

export const Regions: { [key: string]: { color: string; label: string } } = {
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

let zoomBehavior: d3.ZoomBehavior<Element, unknown>;
let x: d3.ScaleLinear<number, number>;
let innerWidth: number;
let currentZoomTransform: d3.ZoomTransform = d3.zoomIdentity;

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
        const height = Object.keys(genomicRegions).length * 12 + 150;
        const margin = 20;
        innerWidth = width - margin * 2;
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

        // Prepare oligo positions (fallback to 0 if start/end missing).
        // Oligo uses OligoValue for dynamic keys, so start/end are typed broadly;
        // at runtime they are [[number]] from the pipeline YAML output.
        const oligoPositions = oligos.map((oligo) => {
            const startArr = oligo.start as number[][] | null;
            const endArr = oligo.end as number[][] | null;
            return {
                start: startArr?.[0]?.[0] ?? 0,
                end: endArr?.[0]?.[0] ?? 0,
                id: oligo.oligo_id,
            };
        });

        // Define x scale based on combined extent of oligos and genomic regions
        const ext = d3.extent([
            ...oligoPositions.flatMap((d) => [d.start, d.end]),
            ...Object.values(genomicRegions)
                .flat()
                .flatMap((d: GenomicRegion) => [d.start, d.end]),
        ]) as [number, number];
        x = d3
            .scaleLinear()
            .domain([ext[0] - 100, ext[1] + 100])
            .range([0, innerWidth]);
        const xAxis = d3.axisBottom(x).ticks(8);

        // Create plot group
        const plot = svg
            .append("g")
            .attr("transform", `translate(${margin},${margin})`);

        // Location indicator
        const locationIndicator = plot
            .append("rect")
            .attr("id", "location-indicator")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", x(1) - x(0))
            .attr("height", innerHeight)
            .attr("fill", "#eaeaea")
            .attr("opacity", 0)
            .attr("visibility", "hidden");

        // Position label above indicator
        const positionLabel = plot
            .append("text")
            .attr("id", "position-label")
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .attr("font-size", 9)
            .attr("fill", "black")
            .attr("opacity", 0)
            .attr("visibility", "hidden");

        // Mouse events for location indicator
        svg.on("mouseenter", () => {
            locationIndicator.attr("visibility", "visible");
            positionLabel.attr("visibility", "visible");
        })
            .on("mousemove", (event) => {
                const [xPos] = d3.pointer(event, plot.node());
                const zx = currentZoomTransform.rescaleX(x);
                const domainX = zx.invert(xPos);
                const snapX = Math.floor(domainX + 0.5);
                locationIndicator.attr("x", zx(snapX - 0.5));
                positionLabel
                    .attr("x", zx(snapX - 0.5))
                    // insert commas for thousands
                    .text(
                        snapX.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    );
            })
            .on("mouseleave", () => {
                locationIndicator.attr("visibility", "hidden");
                positionLabel.attr("visibility", "hidden");
            });

        // Draw oligos
        plot.append("g")
            .attr("class", "oligos")
            .selectAll("rect")
            .data(oligoPositions)
            .join("rect")
            .attr("x", (d) => x(d.start - 0.5))
            .attr("y", 10)
            .attr("width", (d) => x(d.end + 0.5) - x(d.start - 0.5))
            .attr("height", 20)
            .on("click", (_, data) => {
                const index = oligoPositions.findIndex(
                    (pos) => pos.id === data.id
                );
                setSelectedOligo(index);
                // Zoom into selected oligo (even if already selected)
                GenomeAlignmentD3.update(el, oligos, index, true);
            });

        // Tooltip
        const tooltip = d3
            .select("body")
            .append("div")
            .style("opacity", 0)
            .attr("id", "region-tooltip")
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
        const transcriptHeight = (innerHeight - 60) / transcriptCount;

        // Draw genomic regions (multiple transcripts)
        const regionsGroup = plot.append("g").attr("class", "genome-regions");

        Object.entries(genomicRegions).forEach(([transcriptName, regions]) => {
            const yOffset =
                40 +
                Object.keys(genomicRegions).indexOf(transcriptName) *
                    transcriptHeight;

            const transcriptGroup = regionsGroup
                .append("g")
                .attr("transform", `translate(0, ${yOffset})`);

            const regionsContainer = transcriptGroup
                .selectAll("g")
                .data(regions)
                .join("g")
                .attr("class", "genomic-region")
                .attr(
                    "transform",
                    (d: GenomicRegion) => `translate(${x(d.start - 0.5)}, 0)`
                )
                .attr("opacity", (d) => (d.inferred === true ? 0.6 : 0.9))
                .on("mouseover", function () {
                    tooltip.style("opacity", 1);
                    d3.select(this).attr("opacity", (d) =>
                        (d as GenomicRegion).inferred === true ? 0.7 : 1.0
                    );
                })
                .on("mousemove", (event, d: GenomicRegion) => {
                    tooltip
                        .html(
                            Regions[d.regiontype || "unknown"].label +
                                (d.exon_number
                                    ? " " + encodeURI(d.exon_number.toString())
                                    : "") +
                                (d.inferred ? "<br><i>(inferred)</i>" : "")
                        )
                        .style("left", event.pageX + 30 + "px")
                        .style("top", event.pageY + "px");
                })
                .on("mouseleave", function () {
                    tooltip.style("opacity", 0);
                    d3.select(this).attr("opacity", (_d) =>
                        (_d as GenomicRegion).inferred === true ? 0.6 : 0.9
                    );
                });

            // Draw a rect for each region
            regionsContainer
                .append("rect")
                .attr("class", "region-rect")
                .attr(
                    "width",
                    (d: GenomicRegion) => x(d.end + 0.5) - x(d.start - 0.5)
                )
                .attr("height", (d: GenomicRegion) =>
                    d.regiontype === "intron"
                        ? Math.min(transcriptHeight / 10, 2)
                        : Math.min(transcriptHeight / 2, 10)
                )
                .attr("x", 0)
                .attr("y", function () {
                    const height = d3.select(this).attr("height");
                    return transcriptHeight / 2 - Number(height) / 2;
                })
                .attr(
                    "fill",
                    (d: GenomicRegion) =>
                        Regions[d.regiontype || "unknown"].color || "lightgray"
                );

            // Padding container for intron hovering
            regionsContainer
                .append("rect")
                .attr("class", "region-hover-pad")
                .attr(
                    "width",
                    (d: GenomicRegion) => x(d.end + 0.5) - x(d.start - 0.5)
                )
                .attr("height", Math.min(transcriptHeight / 2, 10))
                .attr("x", 0)
                .attr(
                    "y",
                    transcriptHeight / 2 -
                        Math.min(transcriptHeight / 2, 10) / 2
                )
                .attr("fill", "transparent");

            // Strand arrows
            regionsContainer.append("g").attr("class", "strand-arrows");
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
        // TODO: zoom not centered correctly on mouse position
        zoomBehavior = d3
            .zoom()
            .scaleExtent([1, (x.domain()[1] - x.domain()[0]) / 100]) // max zoom to 100bp width
            .translateExtent(extent)
            .extent(extent)
            .filter(filter)
            .on("zoom", zoomed);

        svg.call(zoomBehavior);

        function zoomed(event: d3.D3ZoomEvent<Element, unknown>) {
            currentZoomTransform = event.transform;

            // Rescale x axis
            const zx = event.transform.rescaleX(x);

            // Rescale location indicator
            locationIndicator.attr("width", zx(1) - zx(0));

            // Rescale oligos
            plot.selectAll<SVGRectElement, (typeof oligoPositions)[0]>(
                ".oligos rect"
            )
                .attr("x", (d) => zx(d.start - 0.5))
                .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));
            gX.call(xAxis.scale(zx));

            // Rescale genomic regions
            regionsGroup
                .selectAll<SVGGElement, GenomicRegion>(".genomic-region")
                .attr("transform", (d) => `translate(${zx(d.start - 0.5)}, 0)`);
            regionsGroup
                .selectAll<SVGRectElement, GenomicRegion>(".region-rect")
                .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));
            regionsGroup
                .selectAll<SVGRectElement, GenomicRegion>(".region-hover-pad")
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
                const regions = regionsGroup.selectAll<
                    SVGGElement,
                    GenomicRegion
                >(".genomic-region");
                // only keep visible regions
                const visible_regions = regions.filter(
                    (d) =>
                        d.end >= domain[0] &&
                        d.start <= domain[1] &&
                        d.regiontype !== "intron"
                );
                visible_regions
                    .selectAll<SVGGElement, GenomicRegion>(".strand-arrows")
                    .each(function (d) {
                        const arrowGroup = d3.select(this);
                        arrowGroup.selectAll("*").remove();

                        // arrows 3 bases apart
                        const arrowSpacing = 3;
                        const arrowPath = "M0,-3 L0,3 L5,0 Z"; // simple triangle
                        const arrowPathInverted = "M0,0 L5,3 L5,-3 Z";

                        const startPos =
                            d.strand === "+"
                                ? (3 - (d.reading_grid_offset || 0)) % 3
                                : (d.end -
                                      d.start +
                                      (d.reading_grid_offset || 0)) %
                                  3;

                        for (
                            let pos = startPos;
                            pos <= d.end - d.start;
                            pos += arrowSpacing
                        ) {
                            const columnWidth = zx(1) - zx(0);
                            const regionHeight = Math.min(
                                transcriptHeight / 2,
                                10
                            );
                            arrowGroup
                                .append("path")
                                .attr(
                                    "d",
                                    d.strand === "+"
                                        ? arrowPath
                                        : arrowPathInverted
                                )
                                .attr("fill", "white")
                                .attr(
                                    "transform",
                                    `translate(${pos * columnWidth}, ${transcriptHeight / 2}) scale(${regionHeight / 10})`
                                );
                        }
                    });
            } else {
                // Clear arrows when zoomed out
                regionsGroup
                    .selectAll<SVGGElement, GenomicRegion>(".genomic-region")
                    .selectAll<SVGGElement, GenomicRegion>(".strand-arrows")
                    .each(function () {
                        d3.select(this).selectAll("*").remove();
                    });
            }

            // Show location when bases are shown
            if (showBases) {
                locationIndicator.attr("opacity", 1);
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

    update: (
        el: Element,
        oligos: Oligo[],
        selectedOligo: number,
        zoomIntoOligo: boolean = false
    ) => {
        console.log("Updating GenomeAlignmentD3");
        console.log(el, oligos, selectedOligo, zoomIntoOligo);
        // Prepare oligo positions (fallback to 0 if start/end missing).
        // Oligo uses OligoValue for dynamic keys, so start/end are typed broadly;
        // at runtime they are [[number]] from the pipeline YAML output.
        const oligoPositions = oligos.map((oligo) => {
            const startArr = oligo.start as number[][] | null;
            const endArr = oligo.end as number[][] | null;
            return {
                start: startArr?.[0]?.[0] ?? 0,
                end: endArr?.[0]?.[0] ?? 0,
                id: oligo.oligo_id,
            };
        });

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

        if (zoomIntoOligo) {
            const oligo = oligoPositions[selectedOligo];
            svg.transition()
                .duration(2500)
                .ease(d3.easeCubicInOut)
                .call(
                    zoomBehavior.transform,
                    d3.zoomIdentity
                        .translate(innerWidth / 2, 0)
                        .scale(
                            innerWidth /
                                (x(oligo.end + 100) - x(oligo.start - 100))
                        )
                        .translate(
                            -((x(oligo.start - 100) + x(oligo.end + 100)) / 2),
                            0
                        )
                );
        }
    },

    destroy: (el: Element) => {
        // Clean up the SVG element
        d3.select(el).selectAll("*").remove();
        // Remove tooltip
        d3.select("#region-tooltip").remove();
    },
};

export default GenomeAlignmentD3;
