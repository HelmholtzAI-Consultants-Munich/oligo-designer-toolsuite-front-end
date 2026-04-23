import React, { useEffect, useState } from "react";
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Form,
    Modal,
    ProgressBar,
    Row,
    Spinner,
    Table,
} from "react-bootstrap";
import { Eye, EyeSlash, Trash, Download } from "react-bootstrap-icons";
import { STATUS_CONFIG } from "../shared/types";
import { formatAdminDateTime } from "../shared/date";
import DeltaBadge from "./DeltaBadge";
import TrendChart from "./TrendChart";
import { exportReportToCSV } from "./exportUtils";
import { useMonthlyReports } from "./useMonthlyReports";
import type { MonthlyReport } from "./useMonthlyReports";

type PipelineKey = keyof MonthlyReport["runs"]["by_pipeline"];

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
const PIPELINES: PipelineKey[] = [
    "scrinshot",
    "seqfish",
    "merfish",
    "oligoseq",
];
const STATUSES = ["success", "failure"] as const;
const REFRESH_MS = 2000,
    REFRESH_TRIES = 10;
const NOW = new Date();
const MAX_MONTH = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}`;

const SUMMARY_COLS = [
    {
        label: "Total Runs",
        val: (r: MonthlyReport) => r.runs.total,
        delta: (r: MonthlyReport) => r.runs.delta_total,
    },
    {
        label: "New Users",
        val: (r: MonthlyReport) => r.users.new_registrations,
        delta: (r: MonthlyReport) => r.users.delta_new_registrations,
    },
    {
        label: "Success Rate",
        val: (r: MonthlyReport) => fmtRate(r.runs.success_rate),
        delta: (r: MonthlyReport) => r.runs.delta_success_rate,
        isRate: true,
    },
    {
        label: "Conversion Rate",
        val: (r: MonthlyReport) => fmtRate(r.conversions.conversion_rate),
        delta: (r: MonthlyReport) => r.conversions.delta_conversion_rate,
        isRate: true,
    },
    {
        label: "Feedback",
        val: (r: MonthlyReport) => r.feedback.total,
        delta: (r: MonthlyReport) => r.feedback.delta_total,
    },
    {
        label: "Generated At",
        val: (r: MonthlyReport) =>
            formatAdminDateTime(r.generated_at ?? undefined),
    },
] as const;

const COL_COUNT = SUMMARY_COLS.length + 3; // expand + Period + summaries + Actions

function fmtRate(v: number | null) {
    return v != null ? `${(v * 100).toFixed(1)}%` : "N/A";
}
function monthsBetween(fy: number, fm: number, ty: number, tm: number) {
    const out: { year: number; month: number }[] = [];
    let y = fy,
        m = fm;
    while (y < ty || (y === ty && m <= tm)) {
        out.push({ year: y, month: m });
        if (++m > 12) {
            m = 1;
            y++;
        }
    }
    return out;
}
function delay(ms: number) {
    return new Promise<void>((r) => window.setTimeout(r, ms));
}

const ExpandedRow: React.FC<{ report: MonthlyReport; colSpan: number }> = ({
    report,
    colSpan,
}) => {
    const { runs, users, conversions } = report;
    const maxPipeline = Math.max(
        ...PIPELINES.map((p) => runs.by_pipeline[p]),
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
                                    const Icon = STATUS_CONFIG.icons[status];
                                    return (
                                        <div key={status} className="mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className="d-flex align-items-center gap-1">
                                                    <Icon
                                                        size={14}
                                                        className={`text-${STATUS_CONFIG.colors[status]}`}
                                                    />
                                                    <span className="small">
                                                        {
                                                            STATUS_CONFIG
                                                                .labels[status]
                                                        }
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
                                                now={
                                                    pct > 0
                                                        ? Math.max(pct, 2)
                                                        : 0
                                                }
                                                variant={
                                                    STATUS_CONFIG.colors[status]
                                                }
                                                style={{ height: "6px" }}
                                            />
                                        </div>
                                    );
                                })}
                                <hr className="my-2" />
                                {(["Authenticated", "Anonymous"] as const).map(
                                    (label) => (
                                        <div
                                            key={label}
                                            className="d-flex justify-content-between align-items-center mb-2"
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
                                        </div>
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
                                {PIPELINES.map((p) => {
                                    const count = runs.by_pipeline[p];
                                    const pct = (count / maxPipeline) * 100;
                                    const share =
                                        runs.total > 0
                                            ? (
                                                  (count / runs.total) *
                                                  100
                                              ).toFixed(0)
                                            : "0";
                                    return (
                                        <div key={p} className="mb-3">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className="small fw-medium">
                                                    {p[0].toUpperCase() +
                                                        p.slice(1)}
                                                </span>
                                                <span className="small">
                                                    <strong>{count}</strong>
                                                    <span className="text-muted ms-1">
                                                        ({share}%)
                                                    </span>
                                                </span>
                                            </div>
                                            <ProgressBar
                                                now={
                                                    pct > 0
                                                        ? Math.max(pct, 2)
                                                        : 0
                                                }
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
                                    Conversion Funnel
                                </p>
                                <div className="d-flex align-items-center justify-content-between mb-1">
                                    <span className="small text-muted">
                                        Anonymous sessions
                                    </span>
                                    <Badge bg="secondary" pill>
                                        {runs.anonymous}
                                    </Badge>
                                </div>
                                <div className="text-center text-muted small my-1">
                                    ↓
                                </div>
                                <div className="d-flex align-items-center justify-content-between mb-2">
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
                                </div>
                                <div className="rounded p-2 text-center bg-light">
                                    <div className="small text-muted">
                                        Conversion Rate
                                    </div>
                                    <div className="fs-5 fw-bold">
                                        {fmtRate(conversions.conversion_rate)}
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

const MonthlyReports: React.FC = () => {
    const {
        reports,
        isLoading,
        error,
        isGenerating,
        deletingId,
        fetchReports,
        triggerGenerate,
        deleteReport,
    } = useMonthlyReports();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [showModal, setShowModal] = useState(false);
    const [fromValue, setFromValue] = useState("");
    const [toValue, setToValue] = useState("");
    const [rangeError, setRangeError] = useState<string | null>(null);

    useEffect(() => {
        void fetchReports();
    }, [fetchReports]);

    const toggleRow = (id: string) =>
        setExpanded((prev) => {
            const s = new Set(prev);
            if (s.has(id)) s.delete(id);
            else s.add(id);
            return s;
        });

    const waitForReports = async (ids: string[]) => {
        for (let i = 0; i < REFRESH_TRIES; i++) {
            const next = await fetchReports({ showLoading: false });
            if (ids.every((id) => next.some((r) => r.id === id))) return;
            if (i < REFRESH_TRIES - 1) await delay(REFRESH_MS);
        }
    };

    const handleGenerate = async () => {
        setRangeError(null);
        if (!fromValue || !toValue) {
            setRangeError("Please select both From and To months.");
            return;
        }
        const [fy, fm] = fromValue.split("-").map(Number);
        const [ty, tm] = toValue.split("-").map(Number);
        if (fy > ty || (fy === ty && fm > tm)) {
            setRangeError('"From" must not be after "To".');
            return;
        }
        if (toValue > MAX_MONTH) {
            setRangeError("Cannot generate reports for future months.");
            return;
        }
        const months = monthsBetween(fy, fm, ty, tm);
        if (!(await triggerGenerate(months))) return;
        setShowModal(false);
        setFromValue("");
        setToValue("");
        await waitForReports(
            months.map(
                ({ year, month }) => `${year}-${String(month).padStart(2, "0")}`
            )
        );
    };

    const rangeCount = (() => {
        if (!fromValue || !toValue) return 0;
        const [fy, fm] = fromValue.split("-").map(Number);
        const [ty, tm] = toValue.split("-").map(Number);
        return fy > ty || (fy === ty && fm > tm)
            ? 0
            : monthsBetween(fy, fm, ty, tm).length;
    })();

    if (isLoading)
        return (
            <div className="d-flex justify-content-center p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );

    if (error)
        return (
            <Alert variant="danger">
                <Alert.Heading>Error loading monthly reports</Alert.Heading>
                <p>{error}</p>
                <Button variant="primary" onClick={() => void fetchReports()}>
                    Retry
                </Button>
            </Alert>
        );

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Monthly Reports</h2>
                <div className="d-flex gap-2">
                    <Button
                        variant="outline-primary"
                        onClick={() => void fetchReports()}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => setShowModal(true)}
                    >
                        Generate Reports
                    </Button>
                </div>
            </div>

            <TrendChart reports={reports} />

            {reports.length === 0 ? (
                <Alert variant="info">
                    No monthly reports found. Use "Generate Reports" to create
                    reports for past months.
                </Alert>
            ) : (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th style={{ width: 50 }} />
                            <th>Period</th>
                            {SUMMARY_COLS.map((c) => (
                                <th key={c.label}>{c.label}</th>
                            ))}
                            <th style={{ width: 120 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((report) => (
                            <React.Fragment key={report.id}>
                                <tr>
                                    <td>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="p-0"
                                            style={{ color: "inherit" }}
                                            onClick={() => toggleRow(report.id)}
                                        >
                                            {expanded.has(report.id) ? (
                                                <EyeSlash size={16} />
                                            ) : (
                                                <Eye size={16} />
                                            )}
                                        </Button>
                                    </td>
                                    <td>
                                        <strong>
                                            {MONTH_NAMES[report.month - 1]}{" "}
                                            {report.year}
                                        </strong>
                                    </td>
                                    {SUMMARY_COLS.map((c) => (
                                        <td key={c.label}>
                                            {c.val(report)}
                                            {"delta" in c && c.delta && (
                                                <DeltaBadge
                                                    delta={c.delta(report)}
                                                    isRate={
                                                        "isRate" in c &&
                                                        c.isRate
                                                    }
                                                />
                                            )}
                                        </td>
                                    ))}
                                    <td>
                                        <div className="d-flex gap-1">
                                            <Button
                                                variant="outline-secondary"
                                                size="sm"
                                                onClick={() =>
                                                    exportReportToCSV(report)
                                                }
                                                title="Export CSV"
                                            >
                                                <Download size={14} />
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                disabled={
                                                    deletingId === report.id
                                                }
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            `Delete report for ${MONTH_NAMES[report.month - 1]} ${report.year}?`
                                                        )
                                                    )
                                                        deleteReport(report.id);
                                                }}
                                                title="Delete report"
                                            >
                                                {deletingId === report.id ? (
                                                    <Spinner
                                                        animation="border"
                                                        size="sm"
                                                    />
                                                ) : (
                                                    <Trash size={14} />
                                                )}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                                {expanded.has(report.id) && (
                                    <ExpandedRow
                                        report={report}
                                        colSpan={COL_COUNT}
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </Table>
            )}

            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Generate Reports</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {rangeError && <Alert variant="danger">{rangeError}</Alert>}
                    <Row className="mb-3">
                        <Col>
                            <Form.Label>From month</Form.Label>
                            <Form.Control
                                type="month"
                                value={fromValue}
                                max={MAX_MONTH}
                                onChange={(e) => setFromValue(e.target.value)}
                            />
                        </Col>
                        <Col>
                            <Form.Label>To month</Form.Label>
                            <Form.Control
                                type="month"
                                value={toValue}
                                max={MAX_MONTH}
                                onChange={(e) => setToValue(e.target.value)}
                            />
                        </Col>
                    </Row>
                    {rangeCount > 0 && (
                        <p className="text-muted mb-0">
                            This will generate {rangeCount} report
                            {rangeCount > 1 ? "s" : ""}.
                        </p>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        variant="secondary"
                        onClick={() => setShowModal(false)}
                        disabled={isGenerating}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => void handleGenerate()}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <Spinner
                                    animation="border"
                                    size="sm"
                                    className="me-1"
                                />
                                Generating…
                            </>
                        ) : (
                            "Generate"
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default MonthlyReports;
