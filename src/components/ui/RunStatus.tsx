import { Check2, XLg } from "react-bootstrap-icons";
import type { RunState } from "../../types";
import Pulse from "./Pulse";

export default function RunStatus({ status }: { status: RunState }) {
    if (status === "success") {
        return <Check2 color="var(--bs-secondary)" size={25} />;
    }
    if (status === "failure") {
        return <XLg color="var(--bs-danger)" size={25} />;
    }
    if (status === "started") {
        return <Pulse color="var(--bs-secondary)" size={25} />;
    }
    if (status === "pending") {
        return <Pulse color="var(--bs-secondary)" size={25} paused />;
    }
}