import { Check2, XLg } from "react-bootstrap-icons";
import type { RunState } from "../../types";
import Pulse from "./Pulse";

export default function RunStatus({
    status,
    size,
}: {
    status: RunState;
    size?: number;
}) {
    if (status === "success") {
        return (
            <Check2
                color="var(--bs-secondary)"
                size={size || 25}
                title="Success"
            />
        );
    }
    if (status === "failure") {
        return (
            <XLg color="var(--bs-danger)" size={size || 25} title="Failure" />
        );
    }
    if (status === "started") {
        return (
            <Pulse
                color="var(--bs-secondary)"
                size={size || 25}
                title="Started"
            />
        );
    }
    if (status === "pending") {
        return (
            <Pulse
                color="var(--bs-secondary)"
                size={size || 25}
                paused
                title="Pending"
            />
        );
    }
}
