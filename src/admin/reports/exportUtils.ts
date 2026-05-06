import type { MonthlyReport } from "./types";
import { formatPercentage, formatPercentagePoints } from "./formatters";

const num = (v: number | null) => (v != null ? String(v) : "N/A");

export function exportReportToCSV(report: MonthlyReport): void {
    const { runs, users, conversions, feedback } = report;
    const month = new Date(report.year, report.month - 1).toLocaleString(
        "en-US",
        { month: "long" }
    );
    const csv = [
        ["Metric", "Value", "Delta vs Previous Month"],
        ["Period", `${month} ${report.year}`, ""],
        ["Generated At", report.generated_at, ""],
        [],
        ["--- USERS ---"],
        [
            "New Registrations",
            String(users.new_registrations),
            num(users.delta_new_registrations),
        ],
        ["Active Users", String(users.active), num(users.delta_active)],
        [],
        ["--- RUNS ---"],
        ["Total Runs", String(runs.total), num(runs.delta_total)],
        ["Success", String(runs.by_status.success), ""],
        ["Failure", String(runs.by_status.failure), ""],
        ["Pending", String(runs.by_status.pending), ""],
        ["Started", String(runs.by_status.started), ""],
        [
            "Success Rate",
            formatPercentage(runs.success_rate),
            formatPercentagePoints(runs.delta_success_rate),
        ],
        ["Authenticated", String(runs.authenticated), ""],
        ["Anonymous", String(runs.anonymous), ""],
        ...Object.entries(runs.by_pipeline).map(([k, v]) => [k, String(v), ""]),
        [],
        ["--- CONVERSIONS ---"],
        [
            "Anon to Registered",
            String(conversions.anon_to_registered),
            num(conversions.delta_anon_to_registered),
        ],
        [
            "Conversion Rate",
            formatPercentage(conversions.conversion_rate),
            formatPercentagePoints(conversions.delta_conversion_rate),
        ],
        [],
        ["--- FEEDBACK ---"],
        ["Total Feedback", String(feedback.total), num(feedback.delta_total)],
    ]
        .map((r) => r.map((c) => `"${c ?? ""}"`).join(","))
        .join("\n");

    const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(
            new Blob([csv], { type: "text/csv;charset=utf-8;" })
        ),
        download: `monthly-report-${report.id}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
}
