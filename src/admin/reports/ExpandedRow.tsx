import React from "react";
import { Badge, Card, Col, ProgressBar, Row } from "react-bootstrap";
import { runStatusDisplay } from "../../components/ui/utils";
import { REPORT_PIPELINES } from "./display";
import { formatPercentage } from "./formatters";
import DeltaBadge from "./DeltaBadge";
import type { MonthlyReport } from "./types";
import { getPipelineDisplayName } from "../../pipelineConfig/utils";
import { Horizontal } from "../../components/ui/Alignment";
const STATUSES = ["success", "failure"] as const;

const ExpandedRow: React.FC<{ report: MonthlyReport; colSpan: number }> = ({
    report,
    colSpan,
}) => {
    const { runs, users, conversions } = report;
    const maxPipeline = Math.max(
        ...REPORT_PIPELINES.map((pipeline) => runs.by_pipeline[pipeline]),
        1
    );

    return (
        <tr className="table-active">
            <td colSpan={colSpan} className="p-3">
                <Row className="g-3">
                    <Col md={4}>
                        <Card className="h-100 shadow-sm">
                            <Card.Header className="fw-semibold bg-white">
                                Runs by Status
                            </Card.Header>
                            <Card.Body>
                                {STATUSES.map((status) => {
                                    const count = runs.by_status[status];
                                    const pct =
                                        runs.total > 0
                                            ? (count / runs.total) * 100
                                            : 0;
                                    const statusInfo = runStatusDisplay[status];
                                    return (
                                        <div key={status} className="mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className="d-flex align-items-center gap-1">
                                                    <statusInfo.icon
                                                        size={14}
                                                        color={`var(--bs-${statusInfo.variant})`}
                                                    />
                                                    <span className="small">
                                                        {statusInfo.title}
                                                    </span>
                                                </span>
                                                <span className="small">
                                                    <strong>{count}</strong>
                                                    <span className="text-muted ms-1">
                                                        ({pct.toFixed(0)}%)
                                                    </span>
                                                </span>
                                            </div>
                                            <ProgressBar
                                                now={pct}
                                                variant={statusInfo.variant}
                                                style={{ height: "6px" }}
                                            />
                                        </div>
                                    );
                                })}
                                <hr className="my-2" />
                                {(["Authenticated", "Anonymous"] as const).map(
                                    (label) => (
                                        <Horizontal
                                            key={label}
                                            justify="space-between"
                                            align="center"
                                            className="mb-2"
                                        >
                                            <span className="small text-muted">
                                                {label}
                                            </span>
                                            <Badge
                                                bg={
                                                    label === "Authenticated"
                                                        ? "primary"
                                                        : "secondary"
                                                }
                                                pill
                                            >
                                                {
                                                    runs[
                                                        label.toLowerCase() as
                                                            | "authenticated"
                                                            | "anonymous"
                                                    ]
                                                }
                                            </Badge>
                                        </Horizontal>
                                    )
                                )}
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col md={4}>
                        <Card className="h-100 shadow-sm">
                            <Card.Header className="fw-semibold bg-white">
                                Runs by Pipeline
                            </Card.Header>
                            <Card.Body>
                                {REPORT_PIPELINES.map((pipeline) => {
                                    const count = runs.by_pipeline[pipeline];
                                    const pct = (count / maxPipeline) * 100;
                                    const share =
                                        runs.total > 0
                                            ? (
                                                  (count / runs.total) *
                                                  100
                                              ).toFixed(0)
                                            : "0";
                                    return (
                                        <div key={pipeline} className="mb-3">
                                            <Horizontal
                                                justify="space-between"
                                                align="center"
                                                className="mb-1"
                                            >
                                                <span className="small fw-medium">
                                                    {getPipelineDisplayName(
                                                        pipeline
                                                    )}
                                                </span>
                                                <span className="small">
                                                    <strong>{count}</strong>
                                                    <span className="text-muted ms-1">
                                                        ({share}%)
                                                    </span>
                                                </span>
                                            </Horizontal>
                                            <ProgressBar
                                                now={pct}
                                                variant="info"
                                                style={{ height: "6px" }}
                                            />
                                        </div>
                                    );
                                })}
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col md={4}>
                        <Card className="h-100 shadow-sm">
                            <Card.Header className="fw-semibold bg-white">
                                Users &amp; Conversions
                            </Card.Header>
                            <Card.Body>
                                <Row className="g-2 mb-3">
                                    {(
                                        [
                                            {
                                                label: "Active Users",
                                                value: users.active,
                                                delta: users.delta_active,
                                            },
                                            {
                                                label: "New Users",
                                                value: users.new_registrations,
                                                delta: users.delta_new_registrations,
                                            },
                                        ] as const
                                    ).map(({ label, value, delta }) => (
                                        <Col xs={6} key={label}>
                                            <Card className="text-center border-0 bg-light">
                                                <Card.Body className="py-2 px-1">
                                                    <div className="fs-4 fw-bold">
                                                        {value}
                                                    </div>
                                                    <div className="small text-muted">
                                                        {label}
                                                    </div>
                                                    <DeltaBadge delta={delta} />
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                                <p className="small fw-semibold text-uppercase text-muted mb-2">
                                    Anon-to-user conversion
                                </p>
                                <Horizontal
                                    align="center"
                                    justify="space-between"
                                    className="mb-1"
                                >
                                    <span className="small text-muted">
                                        Anonymous sessions
                                    </span>
                                    <Badge bg="secondary" pill>
                                        {runs.anonymous}
                                    </Badge>
                                </Horizontal>
                                <div className="text-center text-muted small my-1">
                                    ↓
                                </div>
                                <Horizontal
                                    align="center"
                                    justify="space-between"
                                    className="mb-2"
                                >
                                    <span className="small text-muted">
                                        Registered from anon
                                    </span>
                                    <span>
                                        <Badge bg="primary" pill>
                                            {conversions.anon_to_registered}
                                        </Badge>
                                        <DeltaBadge
                                            delta={
                                                conversions.delta_anon_to_registered
                                            }
                                        />
                                    </span>
                                </Horizontal>
                                <div className="rounded p-2 text-center bg-light">
                                    <div className="small text-muted">
                                        Conversion Rate
                                    </div>
                                    <div className="fs-5 fw-bold">
                                        {formatPercentage(
                                            conversions.conversion_rate
                                        )}
                                    </div>
                                    <DeltaBadge
                                        delta={
                                            conversions.delta_conversion_rate
                                        }
                                        isRate
                                    />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </td>
        </tr>
    );
};

export default ExpandedRow;
