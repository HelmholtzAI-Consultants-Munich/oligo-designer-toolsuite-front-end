import type { ReportPeriod } from "./types";

export function compareReportPeriods(a: ReportPeriod, b: ReportPeriod) {
    if (a.year !== b.year) {
        return a.year - b.year;
    }
    return a.month - b.month;
}

export function formatReportId({ year, month }: ReportPeriod) {
    return `${year}-${String(month).padStart(2, "0")}`;
}

export function getNextReportPeriod({
    year,
    month,
}: ReportPeriod): ReportPeriod {
    if (month === 12) {
        return { year: year + 1, month: 1 };
    }

    return { year, month: month + 1 };
}

export function monthsBetween(
    fromYear: number,
    fromMonth: number,
    toYear: number,
    toMonth: number
): ReportPeriod[] {
    const out: ReportPeriod[] = [];
    let year = fromYear;
    let month = fromMonth;

    while (year < toYear || (year === toYear && month <= toMonth)) {
        out.push({ year, month });
        if (++month > 12) {
            month = 1;
            year++;
        }
    }

    return out;
}
