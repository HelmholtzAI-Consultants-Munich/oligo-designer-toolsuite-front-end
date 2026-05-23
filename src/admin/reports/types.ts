import type { Pipeline } from "../../pipelineConfig/config";

export interface ReportPeriod {
    year: number;
    month: number;
}

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
        by_pipeline: Record<Pipeline["name"], number>;
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
