import * as d3 from "d3";
import type { GenomicRegions, GenomicRegion, Probe } from "../../types";

type VisualizationContext = {
    svg: d3.Selection<Element, unknown, null, unknown>;
    plot: d3.Selection<SVGGElement, unknown, null, unknown>;
    locationIndicator: d3.Selection<SVGRectElement, unknown, null, unknown>;
    positionLabel: d3.Selection<SVGTextElement, unknown, null, unknown>;
    oligosGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, unknown>;
    regionsGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    baseGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    xScale: d3.ScaleLinear<number, number>;
    xAxis: d3.Selection<SVGGElement, unknown, null, unknown>;
    zoomBehavior: d3.ZoomBehavior<Element, unknown>;
    currentZoomTransform: d3.ZoomTransform;
    width: number;
    height: number;
};

const contextByElement = new WeakMap<Element, VisualizationContext>();

type OligoPosition = {
    start: number;
    end: number;
    id: string;
    transcript_ids: string[];
    type: "probe" | "gap";
};

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

// Set up the SVG and initial elements
const createContext = (
    el: Element,
    genomicRegions: GenomicRegions
): VisualizationContext => {
    const svg = d3.select(el);
    const width = 800;
    const height = Object.keys(genomicRegions).length * 12 + 150; // TODO:

    const plot = svg.append("g");
    const positionLabel = plot.append("text");
    const oligosGroup = plot.append("g");
    const tooltip = d3.select("body").append("div");
    const regionsGroup = plot.append("g");
    const baseGroup = plot.append("g");
    const locationIndicator = plot.append("rect");

    const zoomBehavior = d3.zoom();
    const xScale = d3.scaleLinear();
    const xAxis = plot.append("g");

    return {
        svg,
        plot,
        locationIndicator,
        positionLabel,
        oligosGroup,
        tooltip,
        regionsGroup,
        baseGroup,
        xScale,
        xAxis,
        zoomBehavior,
        currentZoomTransform: d3.zoomIdentity,
        width,
        height,
    };
};

// Collect oligo positions for all components of all probes
const collectOligoPositions = (probes: Probe[]): OligoPosition[] => {
    return probes.flatMap((oligo) =>
        oligo.components.map((component) => ({
            start: component.start,
            end: component.end,
            id: oligo.oligo_id,
            transcript_ids: oligo.transcript_ids,
            type: component.type,
        }))
    );
};

// Set up x scale and axis based on the extent of oligo positions and genomic regions
const setupScalesAndAxes = (
    ctx: VisualizationContext,
    genomicRegions: GenomicRegions,
    oligoPositions: OligoPosition[]
) => {
    // Define x scale based on combined extent of oligos and genomic regions
    const ext = d3.extent([
        ...oligoPositions.flatMap((d) => [d.start, d.end]),
        ...Object.values(genomicRegions)
            .flat()
            .flatMap((d: GenomicRegion) => [d.start, d.end]),
    ]) as [number, number];
    const extentPadding = (ext[1] - ext[0]) * 0.01; // add % padding on each side
    ctx.xScale
        .domain([ext[0] - extentPadding, ext[1] + extentPadding])
        .range([8, ctx.width - 1]);
    const axis = d3.axisBottom(ctx.xScale).ticks(8);

    // Append the x-axis inside the plot area
    ctx.xAxis
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${ctx.height - 20})`)
        .call(axis);
};

// Set up initial SVG elements and their attributes
const setupElements = (
    ctx: VisualizationContext,
    genomicRegions: GenomicRegions,
    oligoPositions: OligoPosition[]
) => {
    ctx.svg
        .attr("viewBox", [0, 0, ctx.width, ctx.height])
        .attr("width", ctx.width)
        .attr("height", ctx.height)
        .attr("style", "width: 100%; height: auto;");

    ctx.locationIndicator
        .attr("id", "location-indicator")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", ctx.xScale(1) - ctx.xScale(0))
        .attr("height", ctx.height)
        .attr("fill", "black")
        .attr("opacity", 0.3)
        .attr("visibility", "hidden")
        .attr("pointer-events", "none"); // allow mouse events to pass through

    ctx.positionLabel
        .attr("id", "position-label")
        .attr("y", ctx.height - 40 + 1) // position above x-axis
        .attr("text-anchor", "middle")
        .attr("font-size", 9)
        .attr("fill", "black")
        .attr("opacity", 0)
        .attr("visibility", "hidden");

    ctx.tooltip
        .style("opacity", 0)
        .attr("id", "region-tooltip")
        .style("background-color", "white")
        .style("border", "1px solid #b0b0b0")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("box-shadow", "0 0.5rem 1rem rgba(0, 0, 0, 0.1)")
        .style("padding", "5px")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "2000");

    ctx.oligosGroup
        .attr("class", "oligos")
        .selectAll("rect")
        .data(oligoPositions)
        .join("rect")
        .attr("x", (d) => ctx.xScale(d.start - 0.5))
        .attr("y", 0)
        .attr(
            "width",
            (d) => ctx.xScale(d.end + 0.5) - ctx.xScale(d.start - 0.5)
        )
        .attr("height", 20)
        .attr("opacity", (d) => (d.type === "gap" ? 0.5 : 1.0))
        .on("mouseover", function () {
            ctx.tooltip.style("opacity", 1);
        })
        .on("mousemove", (event, d) => {
            ctx.tooltip
                .html(
                    `${d.id}<br>Transcripts:<br>${
                        d.transcript_ids.length < 10
                            ? d.transcript_ids.join(", ")
                            : `${d.transcript_ids.length} of ${Object.keys(genomicRegions).length} transcripts match this oligo`
                    }`
                )
                .style(
                    "left",
                    event.pageX > window.innerWidth / 2
                        ? ""
                        : event.pageX + 20 + "px"
                )
                .style(
                    "right",
                    event.pageX > window.innerWidth / 2
                        ? window.innerWidth - event.pageX + 10 + "px"
                        : ""
                )
                .style("top", event.pageY + "px");
        })
        .on("mouseleave", function () {
            ctx.tooltip.style("opacity", 0);
        });

    // Append line to oligo gaps
    ctx.oligosGroup
        .selectAll("line")
        .data(oligoPositions.filter((d) => d.type === "gap"))
        .join("line")
        .attr("x1", (d) => ctx.xScale(d.start - 0.5))
        .attr("x2", (d) => ctx.xScale(d.end + 0.5))
        .attr("y1", 10)
        .attr("y2", 10)
        .attr("stroke-width", 2)
        .attr("pointer-events", "none"); // allow clicks to pass through to rects

    ctx.regionsGroup.attr("class", "genome-regions");
    const transcriptHeight = calculateTranscriptHeight(
        genomicRegions,
        ctx.height
    );
    Object.entries(genomicRegions).forEach(([transcriptName, regions]) => {
        const yOffset =
            40 +
            Object.keys(genomicRegions).indexOf(transcriptName) *
                transcriptHeight;

        const transcriptGroup = ctx.regionsGroup
            .append("g")
            .attr("class", "transcript")
            .attr("transform", `translate(0, ${yOffset})`);

        const regionsContainer = transcriptGroup
            .selectAll("g")
            .data(regions)
            .join("g")
            .attr("class", "genomic-region")
            .attr(
                "transform",
                (d: GenomicRegion) =>
                    `translate(${ctx.xScale(d.start - 0.5)}, 0)`
            )
            .on("mouseover", function () {
                ctx.tooltip.style("opacity", 1);
            })
            .on("mousemove", (event, d: GenomicRegion) => {
                ctx.tooltip
                    .html(
                        Regions[d.regiontype || "unknown"].label +
                            (d.exon_number
                                ? " " + d.exon_number.toString()
                                : "") +
                            `<br>Transcript: ${transcriptName}`
                    )
                    .style(
                        "left",
                        event.pageX > window.innerWidth / 2
                            ? ""
                            : event.pageX + 20 + "px"
                    )
                    .style(
                        "right",
                        event.pageX > window.innerWidth / 2
                            ? window.innerWidth - event.pageX + 10 + "px"
                            : ""
                    )
                    .style("top", event.pageY + "px");
            })
            .on("mouseleave", function () {
                ctx.tooltip.style("opacity", 0);
            });

        // Draw a rect for each region
        regionsContainer
            .append("rect")
            .attr("class", "region-rect")
            .attr(
                "width",
                (d: GenomicRegion) =>
                    ctx.xScale(d.end + 0.5) - ctx.xScale(d.start - 0.5)
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
                (d: GenomicRegion) =>
                    ctx.xScale(d.end + 0.5) - ctx.xScale(d.start - 0.5)
            )
            .attr("height", Math.min(transcriptHeight / 2, 10))
            .attr("x", 0)
            .attr(
                "y",
                transcriptHeight / 2 - Math.min(transcriptHeight / 2, 10) / 2
            )
            .attr("fill", "transparent");

        // Strand arrows
        regionsContainer.append("g").attr("class", "strand-arrows");

        // Marker for transcript match with oligo
        transcriptGroup
            .append("rect")
            .data([transcriptName])
            .attr("class", "transcript-match-marker")
            .attr("x", 0)
            .attr("y", 5)
            .attr("width", 8)
            .attr("height", transcriptHeight - 10)
            .attr("fill", "transparent")
            .on("mouseover", function () {
                ctx.tooltip.style("opacity", 1);
            })
            .on("mousemove", (event, d) => {
                const matchingOligos = oligoPositions.filter((oligo) =>
                    oligo.transcript_ids.includes(d)
                );
                const uniqueOligoIds = Array.from(
                    new Set(matchingOligos.map((o) => o.id))
                );
                ctx.tooltip
                    .html(
                        `Transcript: ${d}<br>Matching Oligos:<br>${
                            uniqueOligoIds.length < 10
                                ? uniqueOligoIds.join(", ")
                                : `${uniqueOligoIds.length} oligos match this transcript`
                        }`
                    )
                    .style("left", event.pageX + 20 + "px")
                    .style("top", event.pageY + "px");
            })
            .on("mouseleave", function () {
                ctx.tooltip.style("opacity", 0);
            });
    });

    ctx.baseGroup.attr("class", "reference-bases");
};

// Calculate transcript height based on number of transcripts and available vertical space
const calculateTranscriptHeight = (
    genomicRegions: GenomicRegions,
    innerHeight: number
) => {
    const transcriptCount = Object.keys(genomicRegions).length;
    return (innerHeight - 70) / transcriptCount;
};

// Set up mouse events for showing location indicator and handling oligo clicks
const setupMouseEvents = (
    el: Element,
    probes: Probe[],
    ctx: VisualizationContext,
    setSelectedOligo: (id: string) => void
) => {
    const preventPageScroll: EventListener = (event) => {
        event.preventDefault();
    };
    ctx.svg
        .on("wheel", preventPageScroll, { passive: false })
        .on("mouseenter", () => {
            ctx.locationIndicator.attr("visibility", "visible");
            ctx.positionLabel.attr("visibility", "visible");
        })
        .on("mousemove", (event) => {
            const [xPos] = d3.pointer(event, ctx.plot.node());
            const zx = ctx.currentZoomTransform.rescaleX(ctx.xScale);
            const domainX = zx.invert(xPos);
            const snapX = Math.floor(domainX + 0.5);
            ctx.locationIndicator.attr("x", zx(snapX - 0.5));
            ctx.positionLabel
                .attr("x", zx(snapX - 0.5))
                // insert commas for thousands
                .text(snapX.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
        })
        .on("mouseleave", () => {
            ctx.locationIndicator.attr("visibility", "hidden");
            ctx.positionLabel.attr("visibility", "hidden");
        });

    ctx.oligosGroup
        .selectAll<SVGRectElement, OligoPosition>("rect")
        .on("click", (_, data) => {
            setSelectedOligo(data.id);
            // Zoom into selected oligo (even if already selected)
            GenomeAlignmentD3.update(el, probes, data.id, true);
        });
};

// Set up zoom behavior and event handling
const setupZoom = (
    ctx: VisualizationContext,
    genomicRegions: GenomicRegions
) => {
    const extent: [[number, number], [number, number]] = [
        [0, 0],
        [ctx.width, ctx.height],
    ];

    ctx.zoomBehavior
        .scaleExtent([
            1,
            (ctx.xScale.domain()[1] - ctx.xScale.domain()[0]) / 100,
        ]) // max zoom to 100bp width
        .translateExtent(extent)
        .extent(extent)
        .on("zoom", zoomed(ctx, genomicRegions));

    ctx.svg.call(ctx.zoomBehavior);
};

// Handle zoom events to rescale all elements accordingly
const zoomed = (ctx: VisualizationContext, genomicRegions: GenomicRegions) => {
    return (event: d3.D3ZoomEvent<Element, unknown>) => {
        ctx.currentZoomTransform = event.transform;
        const zx = event.transform.rescaleX(ctx.xScale);

        // Rescale location indicator
        ctx.locationIndicator.attr("width", zx(1) - zx(0));

        // Rescale oligos
        ctx.oligosGroup
            .selectAll<SVGRectElement, OligoPosition>("rect")
            .attr("x", (d) => zx(d.start - 0.5))
            .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));

        // Rescale oligo gap lines
        ctx.oligosGroup
            .selectAll<SVGLineElement, OligoPosition>("line")
            .attr("x1", (d) => zx(d.start - 0.5))
            .attr("x2", (d) => zx(d.end + 0.5));

        // Rescale x axis
        const axis = d3.axisBottom(zx).ticks(8);
        ctx.xAxis.call(axis);

        // Rescale genomic regions
        ctx.regionsGroup
            .selectAll<SVGGElement, GenomicRegion>(".genomic-region")
            .attr("transform", (d) => `translate(${zx(d.start - 0.5)}, 0)`);
        ctx.regionsGroup
            .selectAll<SVGRectElement, GenomicRegion>(".region-rect")
            .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));
        ctx.regionsGroup
            .selectAll<SVGRectElement, GenomicRegion>(".region-hover-pad")
            .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));

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
        ctx.baseGroup
            .selectAll<SVGTextElement, { char: string; position: number }>(
                "text"
            )
            .data(bases)
            .join("text")
            .attr("x", (d) => zx(d.position))
            .attr("y", ctx.height - 25)
            .attr("font-size", 10)
            .attr("text-anchor", "middle")
            .text((d) => d.char);

        // Generate and render strand arrows
        if (showBases) {
            const regions = ctx.regionsGroup.selectAll<
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
            const transcriptHeight = calculateTranscriptHeight(
                genomicRegions,
                ctx.height
            );
            visible_regions
                .selectAll<SVGGElement, GenomicRegion>(".strand-arrows")
                .each(function (d) {
                    const arrowGroup = d3.select(this);
                    arrowGroup.selectAll("*").remove();

                    const arrowPath = "M0,-3 L5,0 L0,3";
                    const arrowPathInverted = "M5,-3 L0,0 L5,3";

                    const arrowSpacing = 5;
                    const startPos =
                        Math.ceil(d.start / arrowSpacing) * arrowSpacing -
                        d.start;

                    for (
                        let pos = startPos;
                        pos <= d.end - d.start;
                        pos += arrowSpacing
                    ) {
                        const columnWidth = zx(1) - zx(0);
                        arrowGroup
                            .append("path")
                            .attr(
                                "d",
                                d.strand === "+" ? arrowPath : arrowPathInverted
                            )
                            .attr("stroke", "white")
                            .attr("fill", "transparent")
                            .attr(
                                "transform",
                                `translate(${pos * columnWidth}, ${transcriptHeight / 2})`
                            );
                    }
                });
        } else {
            // Clear arrows when zoomed out
            ctx.regionsGroup
                .selectAll<SVGGElement, GenomicRegion>(".genomic-region")
                .selectAll<SVGGElement, GenomicRegion>(".strand-arrows")
                .each(function () {
                    d3.select(this).selectAll("*").remove();
                });
        }

        // Show location when bases are shown
        if (showBases) {
            ctx.locationIndicator.attr("opacity", 0.3);
            ctx.positionLabel.attr("opacity", 1);
        } else {
            ctx.locationIndicator.attr("opacity", 0);
            ctx.positionLabel.attr("opacity", 0);
        }
    };
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
        probes: Probe[],
        genomicRegions: GenomicRegions,
        selectedOligo: string,
        setSelectedOligo: (id: string) => void
    ) => {
        const oligoPositions = collectOligoPositions(probes);
        const ctx = createContext(el, genomicRegions);
        contextByElement.set(el, ctx);

        setupScalesAndAxes(ctx, genomicRegions, oligoPositions);
        setupElements(ctx, genomicRegions, oligoPositions);
        setupMouseEvents(el, probes, ctx, setSelectedOligo);
        setupZoom(ctx, genomicRegions);

        GenomeAlignmentD3.update(el, probes, selectedOligo);
    },

    update: (
        el: Element,
        probes: Probe[],
        selectedOligo: string,
        zoomIntoOligo: boolean = false
    ) => {
        const ctx = contextByElement.get(el);
        if (!ctx) {
            return;
        }

        const oligoPositions = collectOligoPositions(probes);

        // Update oligo colors based on selection
        ctx.oligosGroup
            .selectAll<SVGRectElement, OligoPosition>("rect")
            .data(oligoPositions)
            .join("rect")
            .attr("fill", (d) =>
                d.id === selectedOligo ? "orange" : "steelblue"
            );

        ctx.oligosGroup
            .selectAll<SVGLineElement, OligoPosition>("line")
            .data(oligoPositions.filter((d) => d.type === "gap"))
            .join("line")
            .attr("stroke", (d) =>
                d.id === selectedOligo ? "orange" : "steelblue"
            );

        ctx.svg
            .selectAll<SVGRectElement, string>(".transcript-match-marker")
            .attr("fill", (d) => {
                const selected = probes.find(
                    (oligo) => oligo.oligo_id === selectedOligo
                );
                if (selected) {
                    const isSelected = selected.transcript_ids.includes(d);
                    return isSelected ? "#22bd28" : "#b0b0b0";
                }
                return "transparent";
            });

        if (zoomIntoOligo) {
            const oligoComponents = oligoPositions.filter(
                (d) => d.id === selectedOligo
            );
            if (oligoComponents.length === 0) {
                return;
            }
            // Get the min start and max end of all components of the selected oligo
            const oligoStart = Math.min(...oligoComponents.map((d) => d.start));
            const oligoEnd = Math.max(...oligoComponents.map((d) => d.end));

            // Smoothly zoom and pan to center the selected oligo
            const zoomScale = Math.min(
                (ctx.width / (ctx.xScale(oligoEnd) - ctx.xScale(oligoStart))) *
                    0.9, // add some padding
                ctx.zoomBehavior.scaleExtent()[1] // don't exceed max zoom
            );
            ctx.svg
                .transition()
                .duration(2500)
                .ease(d3.easeCubicInOut)
                .call(
                    ctx.zoomBehavior.transform,
                    d3.zoomIdentity
                        .translate(ctx.width / 2, 0)
                        .scale(zoomScale)
                        .translate(
                            -(
                                (ctx.xScale(oligoStart) +
                                    ctx.xScale(oligoEnd)) /
                                2
                            ),
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
        contextByElement.delete(el);
    },
};

export default GenomeAlignmentD3;
