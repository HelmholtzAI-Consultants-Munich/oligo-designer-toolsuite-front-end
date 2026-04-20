import { useEffect, useRef, useState } from "react";
import { RunsContext } from "../hooks/useRuns";
import type { PipelineRun } from "../types";
import { BACKEND_URL } from "../config";

export default function RunsProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const pollingInterval = 5000; // Poll every 5 seconds
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [loading, setLoading] = useState(true);

    const pollRuns = () => {
        const url = `${BACKEND_URL}/api/runs`;
        fetch(url, {
            method: "GET",
            credentials: "include",
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(response.statusText);
                }
                return response.json();
            })
            .then((data: PipelineRun[]) => {
                setRuns(
                    data.sort(
                        (a, b) =>
                            new Date(b.timestamp).getTime() -
                            new Date(a.timestamp).getTime()
                    )
                );
            })
            .catch((error) => {
                console.error("Error fetching recent runs:", error);
            })
            .finally(() => {
                setLoading(false);
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
    }, []);

    return (
        <RunsContext
            value={{
                runs,
                loading,
                updateRuns: pollRuns,
            }}
        >
            {children}
        </RunsContext>
    );
}
