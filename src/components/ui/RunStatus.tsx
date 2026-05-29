import type { RunState } from "../../types";
import { runStatusDisplay } from "./utils";

export default function RunStatus({
    status,
    size,
}: {
    status: RunState;
    size?: number;
}) {
    const statusInfo = runStatusDisplay[status];
    const Icon = statusInfo.icon;

    return (
        <Icon
            color={`var(--bs-${statusInfo.variant})`}
            size={size || 25}
            title={statusInfo.title}
        />
    );
}
