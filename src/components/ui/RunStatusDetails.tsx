import { Alert } from "react-bootstrap";
import type { PipelineRun } from "../../types";
import { unwrapQueuePosition } from "../fastaGenerateForm/helpers";

export default function RunStatusDetails({ run }: { run: PipelineRun }) {
    if (run.status !== "pending") {
        return <h3 className="mt-3">Run {run.status}...</h3>;
    }
    const { runsAhead } = unwrapQueuePosition(run.queue_position);
    return (
        <Alert style={{ width: "30rem", maxWidth: "100%" }}>
            <Alert.Heading className="text-center fs-3 mb-4 mt-2">
                Run pending...
            </Alert.Heading>
            <p className="text-center">
                {runsAhead === 0
                    ? "Your run is next in line to be processed!"
                    : `There ${runsAhead === 1 ? "is" : "are"} ${runsAhead} run${runsAhead !== 1 ? "s" : ""} ahead of you.`}
            </p>
            {run.priority === "default" && (
                <>
                    <hr />
                    <p className="small text-muted mb-0">
                        Note: Logged in users have priority and may skip ahead
                        of you in the queue. Consider logging in to have your
                        runs processed faster.
                    </p>
                </>
            )}
        </Alert>
    );
}
