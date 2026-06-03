import { Card, Col, Row } from "react-bootstrap";
import type { RunMetrics as RunMetricsType } from "../types";
import { formatDuration } from "./ui/utils";

interface Props {
    metrics?: RunMetricsType;
}

function MetricItem({ label, value }: { label: string; value?: number }) {
    return (
        <Col xs={12} md={4}>
            <div className="border rounded px-3 py-2 h-100">
                <div className="text-muted small">{label}</div>
                <div className="fs-5 fw-semibold">
                    {typeof value === "number"
                        ? formatDuration(value)
                        : "Pending"}
                </div>
            </div>
        </Col>
    );
}

export default function RunMetrics({ metrics }: Props) {
    const hasMetrics =
        typeof metrics?.queue_wait_seconds === "number" ||
        typeof metrics?.execution_seconds === "number" ||
        typeof metrics?.total_seconds === "number";

    // Older runs and not-yet-started pending runs do not have metrics, so avoid a noisy empty panel.
    if (!hasMetrics) {
        return null;
    }

    return (
        <Card className="mb-4">
            <Card.Header>
                <strong>Run Metrics</strong>
            </Card.Header>
            <Card.Body>
                <Row className="g-3">
                    <MetricItem
                        label="Queue time"
                        value={metrics?.queue_wait_seconds}
                    />
                    <MetricItem
                        label="Execution time"
                        value={metrics?.execution_seconds}
                    />
                    <MetricItem
                        label="Total duration"
                        value={metrics?.total_seconds}
                    />
                </Row>
            </Card.Body>
        </Card>
    );
}
