// pipelines.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../modules/auth";
import Navbar from "../modules/nav";
import axios from "axios";

interface PipelineRun {
    id: string;
    name: string;
    status: 'running' | 'completed' | 'failed';
    start_time: string;
    end_time?: string;
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
                            <div className="list-group">
                                {runs.map(run => (
                                    <div key={run.id} className="list-group-item">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h5>{run.name}</h5>
                                                <small className="text-muted">
                                                    Started: {new Date(run.start_time).toLocaleString()}
                                                </small>
                                            </div>
                                            <div>
                                                <span className={`badge 
                                                    ${run.status === 'completed' ? 'bg-success' :
                                                    run.status === 'failed' ? 'bg-danger' : 'bg-primary'}`}>
                                                    {run.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {runs.length === 0 && !isLoading && (
                                    <div className="text-center mt-4">
                                        No pipeline runs found. Run your first pipeline!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Runs;