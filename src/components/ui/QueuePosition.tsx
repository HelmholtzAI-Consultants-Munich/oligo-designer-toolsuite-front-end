import type { PipelineRun } from "../../types";

export default function QueuePosition({ run }: { run: PipelineRun }) {
    if (run.status !== "pending") {
        return null;
    }
    const [highPriorityAhead, lowPriorityAhead] = run.queue_position;
    return (
        <div>
            {highPriorityAhead > 0 && (
                <div>
                    {highPriorityAhead} logged in user
                    {highPriorityAhead > 1 ? "s" : ""} are ahead of you.
                </div>
            )}
            {lowPriorityAhead > 0 && (
                <div>
                    {lowPriorityAhead} user
                    {lowPriorityAhead > 1 ? "s" : ""} without an account are
                    ahead of you.
                    <br />
                    Logged in users have priority in the queue. Consider
                    creating an account to speed up your run!
                </div>
            )}
            {highPriorityAhead <= 0 && lowPriorityAhead <= 0 && (
                <div>Your run is next in line!</div>
            )}
        </div>
    );
}
