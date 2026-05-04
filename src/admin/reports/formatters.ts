export const formatPercentage = (value: number | null) =>
    value != null ? `${(value * 100).toFixed(1)}%` : "N/A";

export const formatPercentagePoints = (value: number | null) =>
    value != null ? `${(value * 100).toFixed(1)}pp` : "N/A";
