import { Alert } from "react-bootstrap";
import type { PipelineRun } from "../../types";
import { runStatusDisplay } from "./utils";

export default function RunError({ run }: { run: PipelineRun }) {
    const statusInfo = runStatusDisplay[run.status];
    const Icon = statusInfo.icon;

    return (
        <Alert variant={statusInfo.variant}>
            <Alert.Heading>
                <Icon /> {statusInfo.title}
            </Alert.Heading>
            {run.error_message}
        </Alert>
    );
}
