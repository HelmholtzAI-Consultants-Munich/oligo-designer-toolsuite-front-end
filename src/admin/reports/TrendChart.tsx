import React, { useState } from "react";
import { Card, Form } from "react-bootstrap";
import type { MonthlyReport } from "./useMonthlyReports";

const MONTH_ABBR = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const METRICS: { value: string; label: string }[] = [
    { value: "runs.total", label: "Total Runs" },
    { value: "runs.success", label: "Successful Runs" },
    { value: "runs.failure", label: "Failed Runs" },
    { value: "pipeline.scrinshot", label: "Pipeline: Scrinshot" },
    { value: "pipeline.seqfish", label: "Pipeline: Seqfish" },
    { value: "pipeline.merfish", label: "Pipeline: Merfish" },
    { value: "pipeline.oligoseq", label: "Pipeline: Oligoseq" },
    { value: "users.new", label: "New Users" },
    { value: "users.active", label: "Active Users" },
    { value: "feedback.total", label: "Feedback" },
];

const GETTERS: Record<string, (r: MonthlyReport) => number> = {
    "runs.total": (r) => r.runs.total,
    "runs.success": (r) => r.runs.by_status.success,
    "runs.failure": (r) => r.runs.by_status.failure,
    "pipeline.scrinshot": (r) => r.runs.by_pipeline.scrinshot,
    "pipeline.seqfish": (r) => r.runs.by_pipeline.seqfish,
    "pipeline.merfish": (r) => r.runs.by_pipeline.merfish,
    "pipeline.oligoseq": (r) => r.runs.by_pipeline.oligoseq,
    "users.new": (r) => r.users.new_registrations,
    "users.active": (r) => r.users.active,
    "feedback.total": (r) => r.feedback.total,
};

const PL = 48,
    PR = 24,
    PT = 20,
    PB = 40,
    W = 800,
    H = 180;
const CW = W - PL - PR,
    CH = H - PT - PB;

const TrendChart: React.FC<{ reports: MonthlyReport[] }> = ({ reports }) => {
    const [metric, setMetric] = useState("runs.total");
    if (reports.length < 2) return null;

    const data = reports.slice(0, 12).reverse();
    const get = GETTERS[metric] ?? (() => 0);
    const values = data.map(get);
    const maxVal = Math.max(...values, 1);
    const xStep = CW / Math.max(data.length - 1, 1);

    const pts = data.map((r, i) => ({
        x: PL + i * xStep,
        y: PT + CH - (values[i] / maxVal) * CH,
        v: values[i],
        m: MONTH_ABBR[r.month - 1],
        yr: r.year,
    }));
    const line = pts.map((p) => `${p.x},${p.y}`).join(" ");

    return (
        <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
                <strong>Trends</strong>
                <Form.Select
                    size="sm"
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                    style={{ width: "auto" }}
                >
                    {METRICS.map(({ value, label }) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </Form.Select>
            </Card.Header>
            <Card.Body className="p-3">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    width="100%"
                    aria-label="Trend chart"
                >
                    {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                        const y = PT + CH * (1 - f);
                        return (
                            <g key={f}>
                                <line
                                    x1={PL}
                                    y1={y}
                                    x2={PL + CW}
                                    y2={y}
                                    stroke="#dee2e6"
                                    strokeWidth="1"
                                />
                                <text
                                    x={PL - 6}
                                    y={y + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    fill="#6c757d"
                                >
                                    {Math.round(maxVal * f)}
                                </text>
                            </g>
                        );
                    })}
                    <polyline
                        points={line}
                        fill="none"
                        stroke="#0d6efd"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    <polyline
                        points={`${pts[0].x},${PT + CH} ${line} ${pts[pts.length - 1].x},${PT + CH}`}
                        fill="#0d6efd"
                        fillOpacity="0.08"
                        stroke="none"
                    />
                    {pts.map((p, i) => (
                        <g key={i}>
                            <title>{`${p.m} ${p.yr}: ${p.v}`}</title>
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={5}
                                fill="#0d6efd"
                                stroke="white"
                                strokeWidth="2"
                            />
                            <text
                                x={p.x}
                                y={H - 6}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#6c757d"
                            >
                                {p.m}
                            </text>
                        </g>
                    ))}
                </svg>
            </Card.Body>
        </Card>
    );
};

export default TrendChart;
