import { Alert } from "react-bootstrap";
import { Link } from "react-router";

export function RunIdAlert({
    runId,
    idCopySuccess,
}: {
    runId: string;
    idCopySuccess: boolean;
}) {
    return (
        <div>
            <Alert variant="info">
                A pipeline run has been initiated with run ID:{" "}
                <Link to={`/runs/${runId}`}>{runId}</Link>.
                {idCopySuccess
                    ? " The run ID has been copied to your clipboard."
                    : ""}
            </Alert>
        </div>
    );
}
