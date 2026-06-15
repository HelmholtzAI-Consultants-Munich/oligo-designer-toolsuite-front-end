import React, { useEffect, useState } from "react";
import axios from "axios";
import { Table, Spinner, Alert, Button, Badge } from "react-bootstrap";
import { ArrowClockwise } from "react-bootstrap-icons";
import { BACKEND_URL } from "../../config";
import { formatAdminDateTime } from "../shared/date";
import Page from "../../components/ui/Page";
import { Vertical } from "../../components/ui/Alignment";
import { getErrorMessage } from "../../utils/errorUtil";
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
    const [feedbackEntries, setFeedbackEntries] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchFeedbackEntries();
    }, []);

    const fetchFeedbackEntries = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axios.get(
                BACKEND_URL + "/api/admin/feedback",
                {
                    withCredentials: true,
                }
            );
            setFeedbackEntries(response.data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load feedback entries"));
            console.error("Error fetching feedback entries:", err);
        } finally {
            setIsLoading(false);
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
            return <span>{runId}</span>;
        }

        const path = feedback.metadata?.path;
        if (typeof path === "string" && path.trim()) {
            return <span className="text-muted">{path}</span>;
        }

        return <span className="text-muted">-</span>;
    };

    if (isLoading) {
        return (
            <Page title="Feedback">
                <Vertical align="center" className="p-5">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </Vertical>
            </Page>
        );
    }

    if (error) {
        return (
            <Page title="Feedback">
                <Alert variant="danger">
                    <Alert.Heading>Error loading feedback</Alert.Heading>
                    <p>{error}</p>
                    <Button variant="primary" onClick={fetchFeedbackEntries}>
                        Retry
                    </Button>
                </Alert>
            </Page>
        );
    }

    return (
        <Page
            title="Feedback"
            actions={[
                {
                    type: "button",
                    label: "Refresh",
                    icon: ArrowClockwise,
                    variant: "outline-primary",
                    onClick: fetchFeedbackEntries,
                },
            ]}
        >
            {feedbackEntries.length === 0 ? (
                <Alert variant="info">No feedback entries found.</Alert>
            ) : (
                // TODO: Show ODT Cloud version in this table once version metadata is available in feedback entries.
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
                        {feedbackEntries.map((fb) => (
                            <tr key={fb.id}>
                                <td>
                                    {formatAdminDateTime(
                                        fb.created_at,
                                        fb.created_at || "N/A"
                                    )}
                                </td>
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
        </Page>
    );
};

export default FeedbackList;
