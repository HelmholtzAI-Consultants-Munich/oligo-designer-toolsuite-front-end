import type { PipelineRun } from "../../types";
import { runStatusDisplay } from "./utils";
import ErrorAlert from "./ErrorAlert";

export default function RunError({ run }: { run: PipelineRun }) {
    const statusInfo = runStatusDisplay[run.status];

    return (
        <ErrorAlert
            variant={statusInfo.variant}
            icon={statusInfo.icon}
            title={statusInfo.title}
        >
            {run.error_message}
        </ErrorAlert>
    );
}
