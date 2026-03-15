export function formatAdminDateTime(
    value?: string,
    invalidFallback = "N/A"
): string {
    if (!value) return "N/A";

    try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return invalidFallback;
        }

        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
        return invalidFallback;
    }
}
