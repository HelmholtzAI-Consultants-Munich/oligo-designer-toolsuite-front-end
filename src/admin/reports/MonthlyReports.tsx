import React, { useEffect, useState } from "react";
import { Alert, Button, Spinner, Table } from "react-bootstrap";
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
import { confirmWithModal, showModal } from "../../utils/modalUtil";
import { showToast } from "../../utils/toastUtil";
import { formatAdminDateTime } from "../shared/date";
import { formatReportMonth } from "./display";
import { formatPercentage } from "./formatters";
import DeltaBadge from "./DeltaBadge";
import ExpandedRow from "./ExpandedRow";
import GenerateReportsModalContent from "./GenerateReportsModalContent";
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

function delay(ms: number) {
    return new Promise<void>((r) => window.setTimeout(r, ms));
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
