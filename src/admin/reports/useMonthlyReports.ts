import { useCallback, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../../config";

export interface MonthlyReport {
    id: string;
    year: number;
    month: number;
    generated_at: string;
    generated_by: "scheduled" | "manual";
    users: {
        new_registrations: number;
        active: number;
        delta_new_registrations: number | null;
        delta_active: number | null;
    };
    runs: {
        total: number;
        by_status: Record<
            "pending" | "started" | "success" | "failure",
            number
        >;
        by_pipeline: Record<
            "scrinshot" | "seqfish" | "merfish" | "oligoseq",
            number
        >;
        anonymous: number;
        authenticated: number;
        success_rate: number | null;
        failure_rate: number | null;
        delta_total: number | null;
        delta_success_rate: number | null;
    };
    conversions: {
        anon_to_registered: number;
        conversion_rate: number | null;
        delta_anon_to_registered: number | null;
        delta_conversion_rate: number | null;
    };
    feedback: {
        total: number;
        delta_total: number | null;
    };
}

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
        async (
            months: Array<{ year: number; month: number }>
        ): Promise<boolean> => {
            setIsGenerating(true);
            setError(null);
            try {
                await Promise.all(
                    months.map(({ year, month }) =>
                        axios.post(
                            BACKEND_URL + "/api/admin/reports/generate",
                            { year, month },
                            {
                                withCredentials: true,
                                headers: { "Content-Type": "application/json" },
                            }
                        )
                    )
                );
                return true;
            } catch (err) {
                setError(axiosMsg(err, "Failed to trigger report generation"));
                return false;
            } finally {
                setIsGenerating(false);
            }
        },
        []
    );

    const deleteReport = useCallback(async (reportId: string) => {
        setDeletingId(reportId);
        try {
            await axios.delete(BACKEND_URL + `/api/admin/reports/${reportId}`, {
                withCredentials: true,
            });
            setReports((prev) => prev.filter((r) => r.id !== reportId));
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
