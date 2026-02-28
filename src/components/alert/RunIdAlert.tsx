import { Alert } from "react-bootstrap";

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
                <a href={`/runs/${runId}`}>{runId}</a>.
                {idCopySuccess
                    ? " The run ID has been copied to your clipboard."
                    : ""}
            </Alert>
        </div>
    );
}
