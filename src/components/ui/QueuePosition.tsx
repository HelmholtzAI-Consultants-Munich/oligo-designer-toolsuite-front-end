import { Alert } from "react-bootstrap";
import type { PipelineRun } from "../../types";

export default function QueuePosition({ run }: { run: PipelineRun }) {
    if (run.status !== "pending") {
        return null;
    }
    const [highPriorityAhead, lowPriorityAhead] = run.queue_position;
    const runsAhead = highPriorityAhead + lowPriorityAhead;
    return (
        <Alert>
            <Alert.Heading className="text-center fs-3 mb-4 mt-2">
                Run pending...
            </Alert.Heading>
            <p>
                {runsAhead === 0
                    ? "Your run is next in line to be processed!"
                    : `There ${runsAhead === 1 ? "is" : "are"} ${runsAhead} run${runsAhead !== 1 ? "s" : ""} ahead of you.`}
            </p>
            {run.priority === "default" && (
                <>
                    <hr />
                    <p>
                        Note: Logged in users have priority. Consider logging in
                        to move up the queue!
                    </p>
                </>
            )}
        </Alert>
    );
}
