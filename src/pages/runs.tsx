// Updated React component (src/pages/Runs.tsx)
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth";
import Navbar from "../modules/nav";
import axios from "axios";

interface PipelineRun {
    _id: string;
    pipeline: string;
    status: 'started' | 'completed' | 'failed' | 'unknown';
    timestamp: string;
    output_path: string;
    user_id: string;
}

const Runs = () => {
    const { user, loading } = useAuth();
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            axios.get('http://localhost:5000/api/pipelines', { withCredentials: true })
                .then(response => {
                    setRuns(response.data);
                    setIsLoading(false);
                })
                .catch(error => {
                    console.error('Error fetching pipelines:', error);
                    setIsLoading(false);
                });
        }
    }, [user]);

    const formatTimestamp = (timestamp: string) => {
        try {
            const [date, time] = timestamp.split(" ");
            const [year, month, day] = date.split("-");
            const [hour, minute, second] = time.split("-");
            return new Date(
                `${year}-${month}-${day}T${hour}:${minute}:${second}`
            ).toLocaleString();
        } catch (e) {
            return timestamp;
        }
    };

    const statusBadge = (status: string) => {
        const statusMap: { [key: string]: string } = {
            started: "primary",
            completed: "success",
            failed: "danger",
            unknown: "secondary"
        };
        return `badge bg-${statusMap[status] || 'secondary'}`;
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <Navbar />
            <div className="container mt-5">
                <h2 className="mb-4">Pipeline Runs</h2>
                {!user ? (
                    <div className="alert alert-warning text-center">
                        You need to <a href="/login" className="text-primary">Login</a> or{" "}
                        <a href="/register" className="text-primary">Register</a> to access pipelines.
                    </div>
                ) : (
                    <div>
                        {isLoading ? (
                            <div className="text-center">Loading pipeline runs...</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead>
                                    <tr>
                                        <th>Pipeline</th>
                                        <th>Status</th>
                                        <th>Started</th>
                                        <th>Output Path</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {runs.map(run => (
                                        <tr key={run._id}>
                                            <td>{run.pipeline}</td>
                                            <td>
                                                    <span className={statusBadge(run.status)}>
                                                        {run.status}
                                                    </span>
                                            </td>
                                            <td>{formatTimestamp(run.timestamp)}</td>
                                            <td>
                                                <small className="text-muted">
                                                    {run.output_path}
                                                </small>
                                            </td>
                                        </tr>
                                    ))}
                                    {runs.length === 0 && !isLoading && (
                                        <tr>
                                            <td colSpan={4} className="text-center py-4">
                                                No pipeline runs found. Start your first analysis!
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Runs;