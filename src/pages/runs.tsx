// Updated React component (src/pages/Runs.tsx)
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../modules/useAuth";
import Navbar from "../modules/nav";
import axios from "axios";
import type { RunState } from "../types";
import { BACKEND_URL } from "../config";
import FeedbackButton from "../components/feedback/FeedbackButton";

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
            return new Date(
                `${year}-${month}-${day}T${hour}:${minute}:${second}`
            ).toLocaleString();
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

    const statusBadge = (status: string) => {
        const statusMap: { [key: string]: string } = {
            started: "primary",
            success: "success",
            failure: "danger",
            pending: "secondary",
        };
        return `badge bg-${statusMap[status] || "secondary"}`;
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <Navbar />
            <FeedbackButton floating context={{ page: "runs-list" }} />
            <div className="container mt-5">
                <h2 className="mb-4">Pipeline Runs</h2>
                <div className="row mb-4">
                    <div className="col-md-6">
                        <div className="input-group">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter RunID"
                                id="runIdInput"
                            />
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    const runId = (
                                        document.getElementById(
                                            "runIdInput"
                                        ) as HTMLInputElement
                                    ).value;
                                    if (runId) {
                                        navigate(`/runs/${runId}`);
                                    } else {
                                        alert("Please enter a RunID");
                                    }
                                }}
                            >
                                Go to Run
                            </button>
                        </div>
                    </div>
                </div>
                <div>
                    {isLoading ? (
                        <div className="text-center">
                            Loading pipeline runs...
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle">
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
                                            onClick={() =>
                                                navigate(`/runs/${run._id}`)
                                            }
                                            style={{ cursor: "pointer" }}
                                            className="hover:bg-gray-100 transition-colors"
                                        >
                                            <td>{run.pipeline}</td>
                                            <td>
                                                <span
                                                    className={statusBadge(
                                                        run.status
                                                    )}
                                                >
                                                    {run.status}
                                                </span>
                                                {run.status === "failure" &&
                                                    run.error_message && (
                                                        <div
                                                            className="text-danger small mt-1"
                                                            title={
                                                                run.error_message
                                                            }
                                                        >
                                                            {run.error_message}
                                                        </div>
                                                    )}
                                            </td>
                                            <td>
                                                {formatTimestamp(run.timestamp)}
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() =>
                                                        handleDeleteRun(run._id)
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {runs.length === 0 && !isLoading && (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="text-center py-4"
                                            >
                                                No pipeline runs found. Start
                                                your first analysis!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Runs;
