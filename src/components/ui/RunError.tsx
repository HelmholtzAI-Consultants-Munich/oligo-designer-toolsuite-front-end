import { Alert } from "react-bootstrap";
import type { PipelineRun } from "../../types";
import { runStatusDisplay } from "./utils";
import { Link } from "react-router";

export default function RunError({ run }: { run: PipelineRun }) {
    const statusInfo = runStatusDisplay[run.status];
    const Icon = statusInfo.icon;

    return (
        <Alert
            variant={statusInfo.variant}
            className="mx-auto mt-5"
            style={{ width: "30rem", maxWidth: "100%" }}
        >
            <Alert.Heading className="text-center fs-3 mb-4 mt-2">
                <Icon /> {statusInfo.title}
            </Alert.Heading>
            {run.error_message}
            <hr />
            <p className="small text-muted mb-0">
                To contact us about this issue, use the "Feedback" button (when
                logged in) or find our contact information{" "}
                <Link to="/contact" className="text-decoration-underline">
                    here
                </Link>
                .
            </p>
        </Alert>
    );
}
