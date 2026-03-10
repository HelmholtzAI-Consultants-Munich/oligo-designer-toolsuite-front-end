import { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "../../config";
import type { PipelineRun } from "../../types";
import { Link } from "react-router";

export default function RecentRuns() {
    const pollingInterval = 5000; // Poll every 5 seconds
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    
    const pollRuns = () => {
        const url = `${BACKEND_URL}/api/pipelines`;
        fetch(url, {
            method: "GET",
            credentials: "include",
        })
        .then((response) => response.json())
        .then((data: PipelineRun[]) => {
            setRuns(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 3)); // Keep only the 3 most recent runs
        })
        .catch((error) => {
            console.error("Error fetching recent runs:", error);
        });
    };

    useEffect(() => {
        pollRuns(); // Initial poll on component mount

        pollingRef.current = setInterval(pollRuns, pollingInterval);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [])

    return (
        <>
            {runs.map(run => (
                <div key={run._id} className="recent-run">
                    <h4>{run.pipeline}</h4>
                    <p>Status: {run.status}</p>
                    <p>Timestamp: {new Date(run.timestamp).toLocaleString()}</p>
                </div>
            ))}
            <Link to="/runs">
                View All Runs
            </Link>
        </>
    );
}
