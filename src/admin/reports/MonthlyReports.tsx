import React, { useEffect, useState } from "react";
import {
    Alert,
    Button,
    Col,
    Form,
    Modal,
    Row,
    Spinner,
    Table,
} from "react-bootstrap";
import {
    ArrowClockwise,
    Eye,
    EyeSlash,
    Trash,
    Download,
    PlusCircle,
} from "react-bootstrap-icons";
import Page from "../../components/ui/Page";
import { Horizontal, Vertical } from "../../components/ui/Alignment";
import { closeModal, confirmWithModal, showModal } from "../../utils/modalUtil";
import { showToast } from "../../utils/toastUtil";
import { formatAdminDateTime } from "../shared/date";
import { formatReportMonth } from "./display";
import { formatPercentage } from "./formatters";
import DeltaBadge from "./DeltaBadge";
import ExpandedRow from "./ExpandedRow";
import TrendChart from "./TrendChart";
import { exportReportToCSV } from "./exportUtils";
import { useMonthlyReports } from "./useMonthlyReports";
import type { MonthlyReport, ReportPeriod } from "./types";
const REFRESH_MS = 2000,
    REFRESH_TRIES = 10;
const LAST_COMPLETED_MONTH = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    0
);
const MAX_MONTH = `${LAST_COMPLETED_MONTH.getFullYear()}-${String(LAST_COMPLETED_MONTH.getMonth() + 1).padStart(2, "0")}`;

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
        val: (r: MonthlyReport) => formatPercentage(r.runs.success_rate),
        delta: (r: MonthlyReport) => r.runs.delta_success_rate,
        isRate: true,
    },
    {
        label: "Conversion Rate",
        val: (r: MonthlyReport) =>
            formatPercentage(r.conversions.conversion_rate),
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
        val: (r: MonthlyReport) => formatAdminDateTime(r.generated_at),
    },
] as const;

const COL_COUNT = SUMMARY_COLS.length + 3; // expand + Period + summaries + Actions

function monthsBetween(
    fromYear: number,
    fromMonth: number,
    toYear: number,
    toMonth: number
): ReportPeriod[] {
    const out: ReportPeriod[] = [];
    let year = fromYear,
        month = fromMonth;
    while (year < toYear || (year === toYear && month <= toMonth)) {
        out.push({ year, month });
        if (++month > 12) {
            month = 1;
            year++;
        }
    }
    return out;
}
function delay(ms: number) {
    return new Promise<void>((r) => window.setTimeout(r, ms));
}

function GenerateReportsModalContent({
    maxMonth,
    onGenerate,
}: {
    maxMonth: string;
    onGenerate: (months: ReportPeriod[]) => Promise<boolean>;
}) {
    const [fromValue, setFromValue] = useState("");
    const [toValue, setToValue] = useState("");
    const [rangeError, setRangeError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const rangeCount = (() => {
        if (!fromValue || !toValue) return 0;
        const [fromYear, fromMonth] = fromValue.split("-").map(Number);
        const [toYear, toMonth] = toValue.split("-").map(Number);
        return fromYear > toYear || (fromYear === toYear && fromMonth > toMonth)
            ? 0
            : monthsBetween(fromYear, fromMonth, toYear, toMonth).length;
    })();

    const handleGenerate = async () => {
        setRangeError(null);
        if (!fromValue || !toValue) {
            setRangeError("Please select both From and To months.");
            return;
        }
        const [fromYear, fromMonth] = fromValue.split("-").map(Number);
        const [toYear, toMonth] = toValue.split("-").map(Number);
        if (fromYear > toYear || (fromYear === toYear && fromMonth > toMonth)) {
            setRangeError('"From" must not be after "To".');
            return;
        }
        if (toValue > maxMonth) {
            setRangeError(
                "Cannot generate reports for the current or future month."
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const didGenerate = await onGenerate(
                monthsBetween(fromYear, fromMonth, toYear, toMonth)
            );
            if (didGenerate) closeModal();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
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
                            max={maxMonth}
                            onChange={(e) => setFromValue(e.target.value)}
                        />
                    </Col>
                    <Col>
                        <Form.Label>To month</Form.Label>
                        <Form.Control
                            type="month"
                            value={toValue}
                            max={maxMonth}
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
                    onClick={closeModal}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={() => void handleGenerate()}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <>
                            <Spinner
                                animation="border"
                                size="sm"
                                className="me-1"
                            />
                            Generating...
                        </>
                    ) : (
                        "Generate"
                    )}
                </Button>
            </Modal.Footer>
        </>
    );
}

const MonthlyReports: React.FC = () => {
    const {
        reports,
        isLoading,
        error,
        deletingId,
        fetchReports,
        triggerGenerate,
        deleteReport,
    } = useMonthlyReports();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

    const waitForReports = async (
        reportsToRefresh: Array<{ id: string; previousGeneratedAt?: string }>
    ) => {
        for (let i = 0; i < REFRESH_TRIES; i++) {
            const next = await fetchReports({ showLoading: false });
            const nextById = new Map(next.map((report) => [report.id, report]));
            if (
                reportsToRefresh.every(({ id, previousGeneratedAt }) => {
                    const report = nextById.get(id);
                    if (!report) return false;
                    return previousGeneratedAt == null
                        ? true
                        : report.generated_at !== previousGeneratedAt;
                })
            ) {
                return;
            }
            if (i < REFRESH_TRIES - 1) await delay(REFRESH_MS);
        }
    };

    const handleGenerate = async (months: ReportPeriod[]) => {
        const previousGeneratedAtById = new Map(
            reports.map((report) => [report.id, report.generated_at])
        );
        const generatedReportIds = await triggerGenerate(months);
        if (!generatedReportIds) {
            showToast({
                type: "danger",
                title: "Generation failed",
                content: "Failed to trigger report generation.",
            });
            return false;
        }
        await waitForReports(
            generatedReportIds.map((id) => ({
                id,
                previousGeneratedAt: previousGeneratedAtById.get(id),
            }))
        );
        showToast({
            type: "success",
            title: "Reports generated",
            content: `Generated ${generatedReportIds.length} report${generatedReportIds.length === 1 ? "" : "s"}.`,
        });
        return true;
    };

    const showGenerateReportsModal = () => {
        showModal({
            rawContent: (
                <GenerateReportsModalContent
                    maxMonth={MAX_MONTH}
                    onGenerate={handleGenerate}
                />
            ),
            centered: true,
        });
    };

    if (isLoading)
        return (
            <Page title="Monthly Reports">
                <Vertical align="center" className="p-5">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </Vertical>
            </Page>
        );

    if (error)
        return (
            <Page title="Monthly Reports">
                <Alert variant="danger">
                    <Alert.Heading>Error loading monthly reports</Alert.Heading>
                    <p>{error}</p>
                    <Button
                        variant="primary"
                        onClick={() => void fetchReports()}
                    >
                        Retry
                    </Button>
                </Alert>
            </Page>
        );

    return (
        <Page
            title="Monthly Reports"
            actions={[
                {
                    type: "button",
                    label: "Refresh",
                    icon: ArrowClockwise,
                    variant: "outline-primary",
                    onClick: () => void fetchReports(),
                },
                {
                    type: "button",
                    label: "Generate Reports",
                    icon: PlusCircle,
                    variant: "primary",
                    onClick: showGenerateReportsModal,
                },
            ]}
        >
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
                                            {formatReportMonth(
                                                report.month,
                                                "long"
                                            )}{" "}
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
                                        <Horizontal gap="xs">
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
                                                onClick={() =>
                                                    confirmWithModal({
                                                        title: "Delete Report",
                                                        content: `Delete report for ${formatReportMonth(report.month, "long")} ${report.year}?`,
                                                        primaryAction: {
                                                            label: "Delete",
                                                            variant: "danger",
                                                            callback: () => {
                                                                void (async () => {
                                                                    const deleted =
                                                                        await deleteReport(
                                                                            report.id
                                                                        );
                                                                    showToast({
                                                                        type: deleted
                                                                            ? "success"
                                                                            : "danger",
                                                                        title: deleted
                                                                            ? "Report deleted"
                                                                            : "Delete failed",
                                                                        content:
                                                                            deleted
                                                                                ? `Deleted report for ${formatReportMonth(report.month, "long")} ${report.year}.`
                                                                                : "Failed to delete report.",
                                                                    });
                                                                })();
                                                            },
                                                        },
                                                    })
                                                }
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
                                        </Horizontal>
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
        </Page>
    );
};

export default MonthlyReports;
