import { useCallback, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../../config";
import {
    compareReportPeriods,
    formatReportId,
    getNextReportPeriod,
} from "./periods";
import type { MonthlyReport, ReportPeriod } from "./types";

const axiosMsg = (err: unknown, fallback: string) =>
    axios.isAxiosError(err) ? err.response?.data?.error || fallback : fallback;

export function useMonthlyReports() {
    const [reports, setReports] = useState<MonthlyReport[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchReports = useCallback(
        async ({ showLoading = true } = {}): Promise<MonthlyReport[]> => {
            if (showLoading) setIsLoading(true);
            setError(null);
            try {
                const { data } = await axios.get<MonthlyReport[]>(
                    BACKEND_URL + "/api/admin/reports",
                    { withCredentials: true }
                );
                setReports(data);
                return data;
            } catch (err) {
                setError(axiosMsg(err, "Failed to load monthly reports"));
                return [];
            } finally {
                if (showLoading) setIsLoading(false);
            }
        },
        []
    );

    const triggerGenerate = useCallback(
        async (months: ReportPeriod[]): Promise<string[] | null> => {
            setIsGenerating(true);
            setError(null);
            try {
                const orderedMonths = [...months].sort(compareReportPeriods);
                const lastMonth = orderedMonths.at(-1);
                const nextMonth =
                    lastMonth == null ? null : getNextReportPeriod(lastMonth);
                // Regenerating a month changes its stored values, which the next
                // month's report reads to compute its delta_* fields — so it must
                // be regenerated too.
                const shouldRefreshNextMonth =
                    nextMonth != null &&
                    reports.some(
                        (report) =>
                            report.year === nextMonth.year &&
                            report.month === nextMonth.month
                    );
                const monthsToGenerate =
                    nextMonth != null && shouldRefreshNextMonth
                        ? [...orderedMonths, nextMonth]
                        : orderedMonths;

                for (const { year, month } of monthsToGenerate) {
                    await axios.post(
                        BACKEND_URL + "/api/admin/reports/generate",
                        { year, month },
                        {
                            withCredentials: true,
                            headers: { "Content-Type": "application/json" },
                        }
                    );
                }

                return monthsToGenerate.map(formatReportId);
            } catch (err) {
                setError(axiosMsg(err, "Failed to trigger report generation"));
                return null;
            } finally {
                setIsGenerating(false);
            }
        },
        [reports]
    );

    const deleteReport = useCallback(async (reportId: string) => {
        setDeletingId(reportId);
        try {
            await axios.delete(BACKEND_URL + `/api/admin/reports/${reportId}`, {
                withCredentials: true,
            });
            setReports((prev) => prev.filter((r) => r.id !== reportId));
            return true;
        } catch (err) {
            if (axios.isAxiosError(err)) {
                const { status, data } = err.response ?? {};
                const msg = data?.error
                    ? `Error ${status}: ${data.error}`
                    : err.response
                      ? `HTTP ${status} — no error detail`
                      : `Network error: ${err.message}`;
                console.error(
                    "Delete report failed:",
                    status,
                    data,
                    err.message
                );
                setError(msg);
            } else {
                setError(`Unexpected error: ${String(err)}`);
            }
            return false;
        } finally {
            setDeletingId(null);
        }
    }, []);

    return {
        reports,
        isLoading,
        error,
        isGenerating,
        deletingId,
        fetchReports,
        triggerGenerate,
        deleteReport,
    };
}
