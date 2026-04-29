import React, { useMemo, useState } from "react";
import { area, line, max, scaleLinear, scalePoint } from "d3";
import { Card, Form } from "react-bootstrap";
import { formatReportMonth } from "./display";
import type { MonthlyReport } from "./types";

const METRICS: Array<{
    label: string;
    getValue: (report: MonthlyReport) => number;
}> = [
    { label: "Total Runs", getValue: (report) => report.runs.total },
    {
        label: "Successful Runs",
        getValue: (report) => report.runs.by_status.success,
    },
    {
        label: "Failed Runs",
        getValue: (report) => report.runs.by_status.failure,
    },
    {
        label: "Pipeline: Scrinshot",
        getValue: (report) => report.runs.by_pipeline.scrinshot,
    },
    {
        label: "Pipeline: Seqfish",
        getValue: (report) => report.runs.by_pipeline.seqfish,
    },
    {
        label: "Pipeline: Merfish",
        getValue: (report) => report.runs.by_pipeline.merfish,
    },
    {
        label: "Pipeline: Oligoseq",
        getValue: (report) => report.runs.by_pipeline.oligoseq,
    },
    {
        label: "New Users",
        getValue: (report) => report.users.new_registrations,
    },
    { label: "Active Users", getValue: (report) => report.users.active },
    { label: "Feedback", getValue: (report) => report.feedback.total },
];

const WIDTH = 800;
const HEIGHT = 180;
const MARGINS = {
    left: 48,
    right: 24,
    top: 20,
    bottom: 40,
};
const LINE_COLOR = "#0d6efd";
const GRID_COLOR = "#dee2e6";
const LABEL_COLOR = "#6c757d";

type TrendPoint = {
    id: string;
    label: string;
    year: number;
    value: number;
};

const TrendChart: React.FC<{ reports: MonthlyReport[] }> = ({ reports }) => {
    const [metricIndex, setMetricIndex] = useState(0);

    const chart = useMemo(() => {
        const data = reports.slice(0, 12).reverse();
        if (data.length < 2) {
            return null;
        }

        const selectedMetric = METRICS[metricIndex] ?? METRICS[0];
        const points: TrendPoint[] = data.map((report) => ({
            id: `${report.year}-${String(report.month).padStart(2, "0")}`,
            label: formatReportMonth(report.month, "short"),
            year: report.year,
            value: selectedMetric.getValue(report),
        }));

        const xScale = scalePoint<string>()
            .domain(points.map((point) => point.id))
            .range([MARGINS.left, WIDTH - MARGINS.right]);

        const yScale = scaleLinear()
            .domain([0, Math.max(max(points, (point) => point.value) ?? 0, 1)])
            .nice(4)
            .range([HEIGHT - MARGINS.bottom, MARGINS.top]);

        const linePath =
            line<TrendPoint>()
                .x((point) => xScale(point.id) ?? MARGINS.left)
                .y((point) => yScale(point.value))(points) ?? "";

        const areaPath =
            area<TrendPoint>()
                .x((point) => xScale(point.id) ?? MARGINS.left)
                .y0(yScale(0))
                .y1((point) => yScale(point.value))(points) ?? "";

        return {
            points,
            ticks: yScale.ticks(5),
            xScale,
            yScale,
            linePath,
            areaPath,
        };
    }, [metricIndex, reports]);

    if (!chart) return null;

    return (
        <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
                <strong>Trends</strong>
                <Form.Select
                    size="sm"
                    value={String(metricIndex)}
                    onChange={(e) => setMetricIndex(Number(e.target.value))}
                    style={{ width: "auto" }}
                >
                    {METRICS.map(({ label }, index) => (
                        <option key={label} value={index}>
                            {label}
                        </option>
                    ))}
                </Form.Select>
            </Card.Header>
            <Card.Body className="p-3">
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    width="100%"
                    aria-label="Trend chart"
                >
                    {chart.ticks.map((tick) => {
                        const y = chart.yScale(tick);
                        return (
                            <g key={tick}>
                                <line
                                    x1={MARGINS.left}
                                    y1={y}
                                    x2={WIDTH - MARGINS.right}
                                    y2={y}
                                    stroke={GRID_COLOR}
                                    strokeWidth="1"
                                />
                                <text
                                    x={MARGINS.left - 6}
                                    y={y + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    fill={LABEL_COLOR}
                                >
                                    {tick}
                                </text>
                            </g>
                        );
                    })}

                    <path
                        d={chart.areaPath}
                        fill={LINE_COLOR}
                        fillOpacity="0.08"
                    />
                    <path
                        d={chart.linePath}
                        fill="none"
                        stroke={LINE_COLOR}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    {chart.points.map((point) => {
                        const x = chart.xScale(point.id) ?? MARGINS.left;
                        const y = chart.yScale(point.value);

                        return (
                            <g key={point.id}>
                                <title>{`${point.label} ${point.year}: ${point.value}`}</title>
                                <circle
                                    cx={x}
                                    cy={y}
                                    r={5}
                                    fill={LINE_COLOR}
                                    stroke="white"
                                    strokeWidth="2"
                                />
                                <text
                                    x={x}
                                    y={HEIGHT - 6}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill={LABEL_COLOR}
                                >
                                    {point.label}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </Card.Body>
        </Card>
    );
};

export default TrendChart;
