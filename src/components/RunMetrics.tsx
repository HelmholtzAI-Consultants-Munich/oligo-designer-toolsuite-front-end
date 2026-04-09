import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { Badge, Card, Col, Row } from "react-bootstrap";
import type { MetricSample, RunMetrics } from "../types";

interface MetricChartProps {
    samples: MetricSample[];
    yLabel: string;
    color: string;
}

const MetricChart: React.FC<MetricChartProps> = ({
    samples,
    yLabel,
    color,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || samples.length < 2) return;

        const margin = { top: 10, right: 20, bottom: 40, left: 65 };
        const width = 600 - margin.left - margin.right;
        const height = 180 - margin.top - margin.bottom;

        d3.select(svgRef.current).selectAll("*").remove();

        const svg = d3
            .select(svgRef.current)
            .attr(
                "viewBox",
                `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`
            )
            .attr("style", "width: 100%; height: auto;")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const xScale = d3
            .scaleLinear()
            .domain([0, d3.max(samples, (d) => d[0]) ?? 1])
            .range([0, width]);

        const yScale = d3
            .scaleLinear()
            .domain([0, (d3.max(samples, (d) => d[1]) ?? 1) * 1.1])
            .range([height, 0]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(
                d3
                    .axisBottom(xScale)
                    .ticks(6)
                    .tickFormat((d) => `${d}s`)
            );

        svg.append("g").call(d3.axisLeft(yScale).ticks(4));

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 4)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", "#6c757d")
            .text("Elapsed time (s)");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -margin.left + 14)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", "#6c757d")
            .text(yLabel);

        const area = d3
            .area<MetricSample>()
            .x((d) => xScale(d[0]))
            .y0(height)
            .y1((d) => yScale(d[1]))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(samples)
            .attr("fill", color)
            .attr("fill-opacity", 0.1)
            .attr("d", area);

        const line = d3
            .line<MetricSample>()
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]))
            .curve(d3.curveMonotoneX);

        svg.append("path")
            .datum(samples)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("d", line);
    }, [samples, yLabel, color]);

    if (samples.length < 2) {
        return (
            <p className="text-muted small">Not enough data to render chart.</p>
        );
    }

    return <svg ref={svgRef}></svg>;
};

interface Props {
    metrics: RunMetrics;
}

const RunMetrics: React.FC<Props> = ({ metrics }) => {
    const formatRuntime = (seconds: number): string => {
        if (seconds < 60) return `${seconds.toFixed(1)} s`;
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m}m ${s}s`;
    };

    const formatMb = (mb: number): string =>
        mb > 0 ? `${mb.toFixed(1)} MB` : "—";

    return (
        <Card className="mt-3">
            <Card.Header>
                <strong>Run Metrics</strong>
            </Card.Header>
            <Card.Body>
                <Row className="g-2 mb-3">
                    <Col xs={6} md={3}>
                        <Card
                            body
                            className="text-center border-0 bg-light h-100"
                        >
                            <div className="text-muted small">Runtime</div>
                            <div className="fs-5 fw-semibold">
                                {formatRuntime(metrics.runtime_seconds)}
                            </div>
                        </Card>
                    </Col>
                    <Col xs={6} md={3}>
                        <Card
                            body
                            className="text-center border-0 bg-light h-100"
                        >
                            <div className="text-muted small">Peak Memory</div>
                            <div className="fs-5 fw-semibold">
                                {formatMb(metrics.peak_memory_mb)}
                            </div>
                        </Card>
                    </Col>
                    <Col xs={6} md={3}>
                        <Card
                            body
                            className="text-center border-0 bg-light h-100"
                        >
                            <div className="text-muted small">Disk Read</div>
                            <div className="fs-5 fw-semibold">
                                {formatMb(metrics.total_read_mb)}
                            </div>
                        </Card>
                    </Col>
                    <Col xs={6} md={3}>
                        <Card
                            body
                            className="text-center border-0 bg-light h-100"
                        >
                            <div className="text-muted small">Disk Write</div>
                            <div className="fs-5 fw-semibold">
                                {formatMb(metrics.total_write_mb)}
                            </div>
                        </Card>
                    </Col>
                </Row>

                <Row className="g-3">
                    <Col xs={12} md={6}>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="small fw-semibold">
                                Memory Usage
                            </span>
                            <Badge bg="primary" style={{ fontSize: "0.65rem" }}>
                                {metrics.memory_samples.length} samples
                            </Badge>
                        </div>
                        <MetricChart
                            samples={metrics.memory_samples}
                            yLabel="Memory (MB)"
                            color="#0d6efd"
                        />
                    </Col>
                    <Col xs={12} md={6}>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="small fw-semibold">CPU Usage</span>
                            <Badge bg="success" style={{ fontSize: "0.65rem" }}>
                                {metrics.cpu_samples.length} samples
                            </Badge>
                        </div>
                        <MetricChart
                            samples={metrics.cpu_samples}
                            yLabel="CPU (%)"
                            color="#198754"
                        />
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

export default RunMetrics;
