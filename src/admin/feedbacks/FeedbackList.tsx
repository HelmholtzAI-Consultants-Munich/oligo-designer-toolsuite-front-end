import React, { useEffect, useState } from "react";
import axios from "axios";
import { Table, Spinner, Alert, Button, Badge } from "react-bootstrap";
import { BACKEND_URL } from "../../config";

interface FeedbackUser {
    id: string;
    email: string;
}

interface Feedback {
    id: string;
    message: string;
    created_at?: string;
    user_id?: string | null;
    user?: FeedbackUser | null;
    metadata?: Record<string, unknown>;
}

const FeedbackList: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axios.get(
                BACKEND_URL + "/api/admin/feedbacks",
                {
                    withCredentials: true,
                }
            );
            setFeedbacks(response.data);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(
                    err.response?.data?.error ||
                        "Failed to load feedback entries"
                );
            } else {
                setError("Failed to load feedback entries");
            }
            console.error("Error fetching feedback entries:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDateTime = (value?: string) => {
        if (!value) return "N/A";
        try {
            const date = new Date(value);
            const day = date.getDate().toString().padStart(2, "0");
            const month = (date.getMonth() + 1).toString().padStart(2, "0");
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, "0");
            const minutes = date.getMinutes().toString().padStart(2, "0");
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch {
            return value;
        }
    };

    const getUserDisplay = (feedback: Feedback) => {
        if (feedback.user_id) {
            return <span className="font-monospace">{feedback.user_id}</span>;
        }
        return <Badge bg="secondary">Unknown</Badge>;
    };

    const getSourceDisplay = (feedback: Feedback) => {
        const runId = feedback.metadata?.run_id;
        if (typeof runId === "string" && runId.trim()) {
            return <span className="font-monospace">{runId}</span>;
        }

        const path = feedback.metadata?.path;
        if (typeof path === "string" && path.trim()) {
            return <span className="text-muted">{path}</span>;
        }

        return <span className="text-muted">-</span>;
    };

    if (isLoading) {
        return (
            <div className="d-flex justify-content-center p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="danger">
                <Alert.Heading>Error loading feedbacks</Alert.Heading>
                <p>{error}</p>
                <Button variant="primary" onClick={fetchFeedbacks}>
                    Retry
                </Button>
            </Alert>
        );
    }

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Feedbacks</h2>
                <Button variant="outline-primary" onClick={fetchFeedbacks}>
                    Refresh
                </Button>
            </div>

            {feedbacks.length === 0 ? (
                <Alert variant="info">No feedback entries found.</Alert>
            ) : (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th style={{ width: "200px" }}>Created At</th>
                            <th style={{ width: "220px" }}>User</th>
                            <th style={{ width: "220px" }}>Run ID / Page</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        {feedbacks.map((fb) => (
                            <tr key={fb.id}>
                                <td>{formatDateTime(fb.created_at)}</td>
                                <td>{getUserDisplay(fb)}</td>
                                <td>{getSourceDisplay(fb)}</td>
                                <td style={{ whiteSpace: "pre-wrap" }}>
                                    {fb.message}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </div>
    );
};

export default FeedbackList;
