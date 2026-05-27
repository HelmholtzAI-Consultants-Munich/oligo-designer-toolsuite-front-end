import * as d3 from "d3";
import type { GenomicRegions, GenomicRegion, Probe } from "../../types";
import {
    calculeArrowSpacing,
    collectOligoBases,
    collectOligoComponents,
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
    positionLabelGroup: d3.Selection<SVGGElement, unknown, null, unknown>;
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
const MIN_PROBE_WIDTH = 2;

const centeredMinWidthRect = (startX: number, endX: number) => {
    const width = endX - startX;
    if (width >= MIN_PROBE_WIDTH) {
        return { x: startX, width };
    }

    const center = (startX + endX) / 2;
    return {
        x: center - MIN_PROBE_WIDTH / 2,
        width: MIN_PROBE_WIDTH,
    };
};

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
    const oligosGroup = plot.append("g");
    oligosGroup.append("g").attr("class", "probes");
    oligosGroup.append("g").attr("class", "components");
    const tooltip = d3.select("body").append("div");
    const regionsGroup = plot.append("g");
    const baseGroup = plot.append("g");
    const readingGridTicksGroup = plot.append("g");

    const zoomBehavior = d3.zoom();
    const xScale = d3.scaleLinear();
    const xAxis = plot.append("g");
    const positionLabelGroup = plot
        .append("g")
        .attr("id", "position-label-group");
    positionLabelGroup.append("rect");
    positionLabelGroup.append("text");

    return {
        svg,
        plot,
        locationIndicator,
        positionLabelGroup,
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
    oligoComponents: OligoPosition[]
) => {
    // Define x scale based on combined extent of oligos and genomic regions
    const ext = d3.extent([
        ...oligoComponents.flatMap((d) => [d.start, d.end]),
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
    oligoComponents: OligoPosition[],
    probes: Probe[]
) => {
    ctx.svg
        .attr("viewBox", [0, 0, WIDTH, ctx.height])
        .attr("width", WIDTH)
        .attr("height", ctx.height)
        .attr("style", "width: 100%; height: auto;");

    // Location indicator as vertical bar following the mouse
    ctx.locationIndicator
        .attr("id", "location-indicator")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", ctx.xScale(1) - ctx.xScale(0))
        .attr("height", ctx.height - AXIS_HEIGHT)
        .attr("fill", "black")
        .attr("opacity", 0.25)
        .attr("visibility", "hidden")
        .attr("pointer-events", "none"); // allow mouse events to pass through

    // Position label text (number)
    ctx.positionLabelGroup
        .select("text")
        .attr("id", "position-label")
        .attr("y", OLIGO_HEIGHT + GAP / 2 + 5) // position within the gap between oligos and transcripts
        .attr("text-anchor", "start")
        .attr("font-size", 9)
        .attr("fill", "black");

    // Position label background
    ctx.positionLabelGroup
        .select("rect")
        .attr("fill", "var(--bs-primary-bg-subtle)")
        .attr("opacity", 1)
        .attr("pointer-events", "none");

    // Initially hide position label until mouse enters
    ctx.positionLabelGroup
        .attr("opacity", 0)
        .attr("visibility", "hidden")
        .attr("pointer-events", "none");

    // Tooltip div for oligos, regions, and transcripts
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

    // Draw oligo components (probes and gaps)
    ctx.oligosGroup
        .selectAll("g.components")
        .selectAll<SVGRectElement, OligoPosition>("rect")
        .data(oligoComponents, function (d: OligoPosition) {
            return d ? `${d.id}-${d.start}` : (this as SVGRectElement).id;
        })
        .join("rect")
        .attr("x", (d) => ctx.xScale(d.start - 0.5))
        .attr("y", (d) => (d.type === "gap" ? OLIGO_HEIGHT / 2 - 1 : 0))
        .attr(
            "width",
            (d) => ctx.xScale(d.end + 0.5) - ctx.xScale(d.start - 0.5)
        )
        .attr("height", (d) => (d.type === "gap" ? 2 : OLIGO_HEIGHT))
        .attr("pointer-events", "none"); // allow mouse events to pass through to probe rects

    // Draw probe rectangles
    ctx.oligosGroup
        .selectAll("g.probes")
        .selectAll<SVGRectElement, Probe>("rect")
        .data(probes, function (d: Probe) {
            return d ? `${d.oligo_id}` : (this as SVGRectElement).id;
        })
        .join("rect")
        .attr("height", OLIGO_HEIGHT)
        .attr(
            "x",
            (d) =>
                centeredMinWidthRect(
                    ctx.xScale(d.start - 0.5),
                    ctx.xScale(d.end + 0.5)
                ).x
        )
        .attr("y", 0)
        .attr(
            "width",
            (d) =>
                centeredMinWidthRect(
                    ctx.xScale(d.start - 0.5),
                    ctx.xScale(d.end + 0.5)
                ).width
        )
        .attr("opacity", 0.5)
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

    // Draw genomic regions grouped by transcript
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
        if (transcriptName !== "unknown") {
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
                        .html(transcriptTooltipHTML(d, oligoComponents))
                        .style("left", event.pageX + 20 + "px")
                        .style("top", event.pageY + "px")
                        .style("bottom", ""); // reset bottom in case it was set before
                })
                .on("mouseleave", function () {
                    ctx.tooltip.style("opacity", 0);
                });
        }
    });

    ctx.baseGroup.attr("class", "reference-bases");
    ctx.readingGridTicksGroup.attr("class", "reading-grid-ticks");
};

// helper function to update location indicator and position label
const updateLocationIndicatorAndTooltip = (
    ctx: VisualizationContext,
    xPos: number
) => {
    const zx = ctx.currentZoomTransform.rescaleX(ctx.xScale);
    const domainX = zx.invert(xPos);
    const snapX = Math.floor(domainX + 0.5);
    const x = zx(snapX - 0.5);

    ctx.locationIndicator.attr("x", x);
    ctx.positionLabelGroup
        .select("text")
        .attr("x", x + 10) // add some padding from the indicator
        // insert commas for thousands
        .text(snapX.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));

    const positionLabelNode = ctx.positionLabelGroup
        .select("text")
        .node() as SVGTextElement;
    if (!positionLabelNode) {
        return;
    }

    const { x: labelX, y: labelY, width, height } = positionLabelNode.getBBox();
    const paddingRight = 4;
    const paddingLeft = 2;
    const paddingY = 5;
    ctx.positionLabelGroup
        .select("rect")
        .attr("x", labelX - paddingLeft)
        .attr("y", labelY - paddingY)
        .attr("width", width + paddingLeft + paddingRight)
        .attr("height", height + paddingY * 2);
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
            ctx.positionLabelGroup.attr("visibility", "visible");
        })
        .on("mousemove", (event) => {
            const [xPos] = d3.pointer(event, ctx.plot.node());
            updateLocationIndicatorAndTooltip(ctx, xPos);
        })
        .on("mouseleave", () => {
            ctx.locationIndicator.attr("visibility", "hidden");
            ctx.positionLabelGroup.attr("visibility", "hidden");
        });

    ctx.oligosGroup
        .select("g.probes")
        .selectAll<SVGRectElement, Probe>("rect")
        .on("click", (_, data) => {
            setSelectedOligo(data.oligo_id);
            // Zoom into selected oligo (even if already selected)
            GenomeAlignmentD3.update(el, probes, data.oligo_id, true);
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
            updateLocationIndicatorAndTooltip(ctx, xPos);
        }

        // Rescale location indicator
        ctx.locationIndicator.attr("width", zx(1) - zx(0));

        // Rescale oligos
        ctx.oligosGroup
            .select("g.components")
            .selectAll<SVGRectElement, OligoPosition>("rect")
            .attr("x", (d) => zx(d.start - 0.5))
            .attr("width", (d) => zx(d.end + 0.5) - zx(d.start - 0.5));

        ctx.oligosGroup
            .select("g.probes")
            .selectAll<SVGRectElement, Probe>("rect")
            .attr(
                "x",
                (d) =>
                    centeredMinWidthRect(zx(d.start - 0.5), zx(d.end + 0.5)).x
            )
            .attr(
                "width",
                (d) =>
                    centeredMinWidthRect(zx(d.start - 0.5), zx(d.end + 0.5))
                        .width
            );

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

        // Show bindings of the oligos to transcripts when zoomed in
        ctx.regionsGroup
            .selectAll<SVGLineElement, OligoPosition>("line")
            .data(oligoBases)
            .join("line")
            .attr("class", "binding")
            .attr("x1", (d) => zx(d.position))
            .attr("x2", (d) => zx(d.position))
            .attr("y1", OLIGO_HEIGHT + 20)
            .attr("y2", OLIGO_HEIGHT + GAP - 15)
            .attr("stroke", "#999")
            .attr("stroke-width", 1)
            .attr("pointer-events", "none"); // allow mouse events to pass through

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
            ctx.locationIndicator.attr("opacity", 0.25);
            ctx.positionLabelGroup.attr("opacity", 1);
        } else {
            ctx.locationIndicator.attr("opacity", 0);
            ctx.positionLabelGroup.attr("opacity", 0);
        }
    };
};

const GenomeAlignmentD3 = {
    create: (
        el: Element,
        probes: Probe[],
        genomicRegions: GenomicRegions,
        selectedOligo: string,
        setSelectedOligo: (id: string) => void
    ) => {
        const oligoComponents = collectOligoComponents(probes);
        const ctx = createContext(el, genomicRegions);
        contextByElement.set(el, ctx);

        setupScalesAndAxes(ctx, genomicRegions, oligoComponents);
        setupElements(ctx, genomicRegions, oligoComponents, probes);
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

        const oligoComponents = collectOligoComponents(probes);

        // Update oligo colors based on selection
        ctx.oligosGroup
            .select("g.components")
            .selectAll<SVGRectElement, OligoPosition>("rect")
            .data(oligoComponents, function (d: OligoPosition) {
                return d ? `${d.id}-${d.start}` : (this as SVGRectElement).id;
            })
            .join("rect")
            .attr("fill", (d) =>
                d.id === selectedOligo ? "orange" : "steelblue"
            )
            .filter((d) => d.id === selectedOligo)
            .raise();

        ctx.oligosGroup
            .select("g.probes")
            .selectAll<SVGRectElement, Probe>("rect")
            .data(probes, function (d: Probe) {
                return d ? `${d.oligo_id}` : (this as SVGRectElement).id;
            })
            .join("rect")
            .attr("fill", (d) =>
                d.oligo_id === selectedOligo ? "orange" : "steelblue"
            )
            .filter((d) => d.oligo_id === selectedOligo)
            .raise();

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
            const zoomedOligo = probes.find(
                (d) => d.oligo_id === selectedOligo
            );
            if (!zoomedOligo) return;

            // Smoothly zoom and pan to center the selected oligo
            const zoomScale = Math.min(
                (WIDTH /
                    (ctx.xScale(zoomedOligo.end) -
                        ctx.xScale(zoomedOligo.start))) *
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
                        .translate(WIDTH / 2, 0)
                        .scale(zoomScale)
                        .translate(
                            -(
                                (ctx.xScale(zoomedOligo.start) +
                                    ctx.xScale(zoomedOligo.end)) /
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
