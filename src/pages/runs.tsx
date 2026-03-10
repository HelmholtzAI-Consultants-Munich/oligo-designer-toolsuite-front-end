import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../modules/useAuth";
import axios from "axios";
import type { RunState } from "../types";
import { BACKEND_URL } from "../config";
import {
    Badge,
    Button,
    Table,
} from "react-bootstrap";
import Page from "../components/ui/Page";

interface PipelineRun {
    _id: string;
    pipeline: string;
    status: RunState;
    timestamp: string;
    output_path: string;
    user_id: string;
    error_message?: string;
}

const Runs = () => {
    const { loading } = useAuth();
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    console.log(BACKEND_URL + "/api/pipelines");

    // Update the imports

    useEffect(() => {
        axios
            .get(BACKEND_URL + "/api/pipelines", {
                withCredentials: true,
            })
            .then((response) => {
                setRuns(response.data);
                setIsLoading(false);
            })
            .catch((error) => {
                console.error("Error fetching pipelines:", error);
                setIsLoading(false);
            });
    }, []);

    const formatTimestamp = (timestamp: string) => {
        try {
            const [date, time] = timestamp.split(" ");
            const [year, month, day] = date.split("-");
            const [hour, minute, second] = time.split("-");
            return (
                new Date(
                    `${year}-${month}-${day}T${hour}:${minute}:${second}`
                ).toLocaleString()
            );
        } catch {
            return timestamp;
        }
    };
    // Add this handler function
    const handleDeleteRun = async (runId: string) => {
        if (
            window.confirm(
                "Are you sure you want to delete this run? This action cannot be undone."
            )
        ) {
            try {
                await axios.delete(BACKEND_URL + `/api/runs/${runId}`, {
                    withCredentials: true,
                });
                setRuns((prev) => prev.filter((r) => r._id !== runId));
                navigate("/runs");
            } catch (error) {
                console.error("Error deleting run:", error);
                navigate("/runs");
                alert("Failed to delete run");
            }
        }
    };

    const goToRun = (runId: string) => {
        if (runId) {
            navigate(`/runs/${runId}`);
        } else {
            alert("Please enter a RunID");
        }
    };

    const statusToBadge = {
        started: "primary",
        success: "success",
        failure: "danger",
        pending: "secondary",
    };

    if (loading) return <div>Loading...</div>;

    return (
        <Page
            title="Pipeline Runs"
            actions={[
                {
                    type: "search",
                    label: "Go to Run",
                    placeholder: "Enter RunID",
                    onSearch: (query: string) => goToRun(query),
                },
            ]}
        >
            <>
                {isLoading ? (
                    <div className="text-center">Loading pipeline runs...</div>
                ) : (
                    <Table responsive hover>
                        <thead>
                            <tr>
                                <th>Pipeline</th>
                                <th>Status</th>
                                <th>Started</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((run) => (
                                <tr
                                    key={run._id}
                                    onClick={() => navigate(`/runs/${run._id}`)}
                                    style={{ cursor: "pointer" }}
                                    className="hover:bg-gray-100"
                                >
                                    <td>{run.pipeline}</td>
                                    <td>
                                        <Badge
                                            bg={
                                                statusToBadge[run.status] ||
                                                "secondary"
                                            }
                                        >
                                            {run.status}
                                        </Badge>
                                        {run.status === "failure" &&
                                            run.error_message && (
                                                <div className="text-danger small mt-1">
                                                    {run.error_message}
                                                </div>
                                            )}
                                    </td>
                                    <td>{formatTimestamp(run.timestamp)}</td>
                                    <td>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteRun(run._id);
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {runs.length === 0 && !isLoading && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="text-center py-4"
                                    >
                                        No pipeline runs found. Start your first
                                        analysis!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                )}
            </>
        </Page>
    );
};

export default Runs;
