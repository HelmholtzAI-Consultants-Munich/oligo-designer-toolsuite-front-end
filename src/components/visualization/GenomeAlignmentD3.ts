import * as d3 from "d3";
import type { GenomicRegions, GenomicRegion, Probe } from "../../types";
import {
    calculeArrowSpacing,
    collectOligoBases,
    collectOligoPositions,
    collectReferenceBases,
    oligoTooltipHTML,
    Regions,
    regionTooltipHTML,
    transcriptTooltipHTML,
    type Base,
    type OligoPosition,
} from "./visualizationHelpers";

type VisualizationContext = {
    svg: d3.Selection<Element, unknown, null, unknown>;
    plot: d3.Selection<SVGGElement, unknown, null, unknown>;
    locationIndicator: d3.Selection<SVGRectElement, unknown, null, unknown>;
    positionLabel: d3.Selection<SVGTextElement, unknown, null, unknown>;
    oligosGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, unknown>;
    regionsGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    baseGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    readingGridTicksGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
    xScale: d3.ScaleLinear<number, number>;
    xAxis: d3.Selection<SVGGElement, unknown, null, unknown>;
    zoomBehavior: d3.ZoomBehavior<Element, unknown>;
    currentZoomTransform: d3.ZoomTransform;
    height: number;
};

const contextByElement = new WeakMap<Element, VisualizationContext>();

const WIDTH = 800;
const OLIGO_HEIGHT = 20;
const TRANSCRIPT_HEIGHT = 20;
const TRANSCRIPT_MARKER_WIDTH = 8;
const GAP = 50;
const AXIS_HEIGHT = 20;

// Set up the SVG and initial elements
const createContext = (
    el: Element,
    genomicRegions: GenomicRegions
): VisualizationContext => {
    const svg = d3.select(el);
    const height =
        Object.keys(genomicRegions).length * TRANSCRIPT_HEIGHT +
        OLIGO_HEIGHT +
        GAP +
        AXIS_HEIGHT;

    const plot = svg.append("g");
    const locationIndicator = plot.append("rect");
    const positionLabel = plot.append("text");
    const oligosGroup = plot.append("g");
    const tooltip = d3.select("body").append("div");
    const regionsGroup = plot.append("g");
    const baseGroup = plot.append("g");
    const readingGridTicksGroup = plot.append("g");

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
        readingGridTicksGroup,
        xScale,
        xAxis,
        zoomBehavior,
        currentZoomTransform: d3.zoomIdentity,
        height,
    };
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
        .range([TRANSCRIPT_MARKER_WIDTH, WIDTH - 1]);
    const axis = d3.axisBottom(ctx.xScale).ticks(8);

    // Append the x-axis inside the plot area
    ctx.xAxis
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${ctx.height - AXIS_HEIGHT})`)
        .call(axis);
};

// Set up initial SVG elements and their attributes
const setupElements = (
    ctx: VisualizationContext,
    genomicRegions: GenomicRegions,
    oligoPositions: OligoPosition[]
) => {
    ctx.svg
        .attr("viewBox", [0, 0, WIDTH, ctx.height])
        .attr("width", WIDTH)
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
        .attr("y", OLIGO_HEIGHT + GAP / 2 + 5) // position above x-axis
        .attr("text-anchor", "left")
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
        .attr("height", OLIGO_HEIGHT)
        .attr("opacity", (d) => (d.type === "gap" ? 0.5 : 1.0))
        .on("mouseover", function () {
            ctx.tooltip.style("opacity", 1);
        })
        .on("mousemove", (event, d) => {
            ctx.tooltip
                .html(oligoTooltipHTML(d, genomicRegions))
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
                .style("bottom", window.innerHeight - event.pageY + "px")
                .style("top", ""); // reset top in case it was set before
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
        .attr("y1", OLIGO_HEIGHT / 2)
        .attr("y2", OLIGO_HEIGHT / 2)
        .attr("stroke-width", 2)
        .attr("pointer-events", "none"); // allow clicks to pass through to rects

    ctx.regionsGroup.attr("class", "genome-regions");
    Object.entries(genomicRegions).forEach(([transcriptName, regions]) => {
        const yOffset =
            OLIGO_HEIGHT +
            GAP +
            Object.keys(genomicRegions).indexOf(transcriptName) *
                TRANSCRIPT_HEIGHT;

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
                    .html(regionTooltipHTML(d, transcriptName))
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
                    .style("top", event.pageY + "px")
                    .style("bottom", ""); // reset bottom in case it was set before
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
                    ? TRANSCRIPT_HEIGHT / 10
                    : TRANSCRIPT_HEIGHT / 2
            )
            .attr("x", 0)
            .attr("y", function () {
                const height = d3.select(this).attr("height");
                return TRANSCRIPT_HEIGHT / 2 - Number(height) / 2;
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
            .attr("height", TRANSCRIPT_HEIGHT / 2)
            .attr("x", 0)
            .attr("y", TRANSCRIPT_HEIGHT / 4)
            .attr("fill", "transparent");

        // Strand arrows
        regionsContainer.append("g").attr("class", "strand-arrows");

        // Marker for transcript match with oligo
        transcriptGroup
            .append("rect")
            .data([transcriptName])
            .attr("class", "transcript-marker")
            .attr("x", 0)
            .attr("y", TRANSCRIPT_HEIGHT * 0.05)
            .attr("width", 8)
            .attr("height", TRANSCRIPT_HEIGHT * 0.9)
            .attr("fill", "transparent")
            .on("mouseover", function () {
                ctx.tooltip.style("opacity", 1);
            })
            .on("mousemove", (event, d) => {
                ctx.tooltip
                    .html(transcriptTooltipHTML(d, oligoPositions))
                    .style("left", event.pageX + 20 + "px")
                    .style("top", event.pageY + "px")
                    .style("bottom", ""); // reset bottom in case it was set before
            })
            .on("mouseleave", function () {
                ctx.tooltip.style("opacity", 0);
            });
    });

    ctx.baseGroup.attr("class", "reference-bases");
    ctx.readingGridTicksGroup.attr("class", "reading-grid-ticks");
};

// helper function to update location indicator and position label
const updateLocationIndicator = (ctx: VisualizationContext, xPos: number) => {
    const zx = ctx.currentZoomTransform.rescaleX(ctx.xScale);
    const domainX = zx.invert(xPos);
    const snapX = Math.floor(domainX + 0.5);
    const x = zx(snapX - 0.5);

    ctx.locationIndicator.attr("x", x);
    ctx.positionLabel
        .attr("x", x + 10) // add some padding from the indicator
        // insert commas for thousands
        .text(snapX.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
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
            updateLocationIndicator(ctx, xPos);
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
    genomicRegions: GenomicRegions,
    probes: Probe[]
) => {
    const extent: [[number, number], [number, number]] = [
        [0, 0],
        [WIDTH, ctx.height],
    ];

    ctx.zoomBehavior
        .scaleExtent([
            1,
            (ctx.xScale.domain()[1] - ctx.xScale.domain()[0]) / 100,
        ]) // max zoom to 100bp width
        .translateExtent(extent)
        .extent(extent)
        .on("zoom", zoomed(ctx, genomicRegions, probes));

    ctx.svg.call(ctx.zoomBehavior);
};

// Handle zoom events to rescale all elements accordingly
const zoomed = (
    ctx: VisualizationContext,
    genomicRegions: GenomicRegions,
    probes: Probe[]
) => {
    return (event: d3.D3ZoomEvent<Element, unknown>) => {
        ctx.currentZoomTransform = event.transform;
        const zx = event.transform.rescaleX(ctx.xScale);

        ctx.locationIndicator.attr("width", zx(1) - zx(0));
        const source = event.sourceEvent;
        const plotNode = ctx.plot.node();
        if (source instanceof MouseEvent && plotNode) {
            const [xPos] = d3.pointer(source, plotNode);
            updateLocationIndicator(ctx, xPos);
        }

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
        const showArrows = visibleRange <= 3000;

        // Show bases only when zoomed in and only if in view
        const bases = showBases
            ? collectReferenceBases(
                  genomicRegions,
                  Math.floor(domain[0]),
                  Math.ceil(domain[1])
              )
            : [];
        ctx.baseGroup
            .selectAll<SVGTextElement, Base>("text")
            .data(bases)
            .join("text")
            .attr("x", (d) => zx(d.position))
            .attr("y", OLIGO_HEIGHT + GAP - 2)
            .attr("font-size", 10)
            .attr("text-anchor", "middle")
            .text((d) => d.char);

        // Show oligo bases only when zoomed in and only if in view
        const oligoBases = showBases
            ? collectOligoBases(
                  probes,
                  Math.floor(domain[0]),
                  Math.ceil(domain[1])
              )
            : [];
        ctx.oligosGroup
            .selectAll<SVGTextElement, Base>("text")
            .data(oligoBases)
            .join("text")
            .attr("x", (d) => zx(d.position))
            .attr("y", OLIGO_HEIGHT + 15)
            .attr("font-size", 10)
            .attr("text-anchor", "middle")
            .text((d) => d.char);

        // Show reading grid ticks only when zoomed in and only if in view
        const readingGridTicks = showBases
            ? collectReadingGridTicks(
                  genomicRegions,
                  Math.floor(domain[0]),
                  Math.ceil(domain[1])
              )
            : [];
        ctx.readingGridTicksGroup
            .selectAll<SVGLineElement, ReadingGridTick>("line")
            .data(readingGridTicks, (d) => `${d.position}-${d.transcriptIndex}`)
            .join("line")
            .attr("x1", (d) => zx(d.position + 0.5))
            .attr("x2", (d) => zx(d.position + 0.5))
            .attr("y1", (d) => {
                const yOffset =
                    OLIGO_HEIGHT +
                    GAP +
                    d.transcriptIndex * TRANSCRIPT_HEIGHT;
                return yOffset + TRANSCRIPT_HEIGHT / 2 - 2;
            })
            .attr("y2", (d) => {
                const yOffset =
                    OLIGO_HEIGHT +
                    GAP +
                    d.transcriptIndex * TRANSCRIPT_HEIGHT;
                return yOffset + TRANSCRIPT_HEIGHT / 2 + 2;
            })
            .attr("stroke", "#cccccc")
            .attr("stroke-width", 1)
            .attr("pointer-events", "none");

        // Generate and render strand arrows
        if (showArrows) {
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
            visible_regions
                .selectAll<SVGGElement, GenomicRegion>(".strand-arrows")
                .each(function (d) {
                    const arrowGroup = d3.select(this);
                    arrowGroup.selectAll("*").remove();

                    const arrowPath = "M0,-3 L5,0 L0,3";
                    const arrowPathInverted = "M5,-3 L0,0 L5,3";

                    const arrowSpacing = calculeArrowSpacing(visibleRange);
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
                                `translate(${pos * columnWidth}, ${TRANSCRIPT_HEIGHT / 2})`
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

// Collect reading grid ticks from genomic regions within the specified range
// Ticks appear after every 3 bases in the reading frame
type ReadingGridTick = { position: number; transcriptIndex: number };

const collectReadingGridTicks = (
    genomicRegions: GenomicRegions,
    start: number,
    end: number
): ReadingGridTick[] => {
    const ticks: ReadingGridTick[] = [];
    let transcriptIndex = 0;

    console.log("Collecting reading grid ticks for range:", genomicRegions);

    Object.entries(genomicRegions).forEach(([, regions]) => {
        const exonRegions = regions.filter(
            (region) =>
                region.exom_position !== undefined
        );

        exonRegions.forEach((region) => {
            if (region.end < start || region.start > end) {
                return; // region not in visible range
            }

            // Calculate the first tick position in this region
            const direction = region.strand === "+" ? 1 : -1;
            const offset = region.exom_position! % 3;
            const firstTickInRegion = direction === 1
                ? region.start + ((3 - offset) % 3)
                : region.end - ((3 - offset) % 3);
            const regionStart = Math.max(region.start, start);
            const regionEnd = Math.min(region.end, end);

            // Collect all tick positions in this region and visible range
            for (
                let pos = firstTickInRegion;
                direction === 1 ? pos <= regionEnd : pos >= regionStart;
                pos += 3 * direction
            ) {
                if (pos >= regionStart) {
                    ticks.push({ position: pos, transcriptIndex });
                }
            }
        });

        transcriptIndex++;
    });

    return ticks;
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
        setupZoom(ctx, genomicRegions, probes);

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
            .selectAll<SVGRectElement, string>(".transcript-marker")
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
                (WIDTH / (ctx.xScale(oligoEnd) - ctx.xScale(oligoStart))) * 0.9, // add some padding
                ctx.zoomBehavior.scaleExtent()[1] // don't exceed max zoom
            );
            ctx.svg
                .transition()
                .duration(2500)
                .ease(d3.easeCubicInOut)
                .call(
                    ctx.zoomBehavior.transform,
                    d3.zoomIdentity
                        .translate(WIDTH / 2, 0)
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
