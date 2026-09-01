import type { NodeProps } from "@xyflow/react";
import { Position, Handle } from "@xyflow/react";
import type { ErrorNodeType } from "./types";

import { Alert } from "react-bootstrap";
import { runStatusDisplay } from "../ui/utils";
import { Link } from "react-router";

const ErrorNode = ({ data }: NodeProps<ErrorNodeType>) => {
    // TODO: runstatusdisplay löschen und umändern
    const statusInfo = runStatusDisplay[data.type];
    const Icon = statusInfo.icon;
    return (
        <div className="pipeline-step-node error-node-wrapper">
            <Alert
                variant={statusInfo.variant}
                className="mx-auto mt-5 shadow sm border-0"
                style={{
                    width: "30rem",
                    maxWidth: "400px",
                    borderRadius: "0.9rem",
                }}
            >
                <Alert.Heading className="text-center fs-3 mb-4 mt-2">
                    <Icon /> {statusInfo.title}
                </Alert.Heading>
                {data.data}
                <hr />
                <p className="small text-muted mb-0">
                    To contact us about this issue, use the "Feedback" button
                    (when logged in) or find our contact information{" "}
                    <Link to="/contact" className="text-decoration-underline">
                        here
                    </Link>
                    .
                </p>
            </Alert>
            <Handle type="target" position={Position.Left} />
        </div>
    );
};

export default ErrorNode;
