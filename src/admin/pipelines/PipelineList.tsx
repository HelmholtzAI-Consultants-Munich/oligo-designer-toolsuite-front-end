import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Table, Badge, Spinner, Alert, Button, Card, Form } from 'react-bootstrap';
import { Eye, EyeSlash, Trash, Pencil } from 'react-bootstrap-icons';

interface PipelineRun {
    id: string;
    pipeline: string;
    status: string;
    timestamp: string;
    created_at?: string;
    output_path: string;
    user_id?: string;
    user?: {
        id: string;
        email: string;
    };
    session_id?: string;
    transferred_from_anon?: boolean;
}

const PipelineList: React.FC = () => {
    const navigate = useNavigate();
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [editingStatus, setEditingStatus] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        fetchPipelineRuns();
    }, []);

    const fetchPipelineRuns = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axios.get('http://localhost:5000/api/admin/pipelines', {
                withCredentials: true,
            });
            setRuns(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load pipeline runs');
            console.error('Error fetching pipeline runs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleRow = (runId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(runId)) {
            newExpanded.delete(runId);
        } else {
            newExpanded.add(runId);
        }
        setExpandedRows(newExpanded);
    };

    const handleStatusChange = async (runId: string, newStatus: string) => {
        try {
            const response = await axios.put(
                `http://localhost:5000/api/admin/pipelines/${runId}`,
                { status: newStatus },
                { withCredentials: true }
            );
            
            // Update the run in the local state
            setRuns(runs.map(run => 
                run.id === runId ? response.data : run
            ));
            
            // Remove from editing state
            const newEditing = { ...editingStatus };
            delete newEditing[runId];
            setEditingStatus(newEditing);
        } catch (err: any) {
            alert(`Failed to update status: ${err.response?.data?.error || err.message}`);
            console.error('Error updating status:', err);
        }
    };

    const handleDelete = async (runId: string, pipelineName: string) => {
        if (window.confirm(`Are you sure you want to delete pipeline run "${pipelineName}"? This will also delete all associated output files.`)) {
            try {
                await axios.delete(`http://localhost:5000/api/admin/pipelines/${runId}`, {
                    withCredentials: true,
                });
                // Remove from local state
                setRuns(runs.filter(run => run.id !== runId));
                // Remove from expanded rows if it was expanded
                const newExpanded = new Set(expandedRows);
                newExpanded.delete(runId);
                setExpandedRows(newExpanded);
            } catch (err: any) {
                alert(`Failed to delete pipeline run: ${err.response?.data?.error || err.message}`);
                console.error('Error deleting pipeline run:', err);
            }
        }
    };

    const startEditingStatus = (runId: string, currentStatus: string) => {
        setEditingStatus({ ...editingStatus, [runId]: currentStatus });
    };

    const cancelEditingStatus = (runId: string) => {
        const newEditing = { ...editingStatus };
        delete newEditing[runId];
        setEditingStatus(newEditing);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch {
            return 'N/A';
        }
    };

    const formatTimestamp = (timestamp?: string) => {
        if (!timestamp) return 'N/A';
        try {
            // Handle timestamp format like "2024-01-15_14-30-45"
            const formatted = timestamp.replace('_', ' ').replace(/-/g, '/');
            return formatted;
        } catch {
            return timestamp;
        }
    };

    const getStatusBadge = (status: string) => {
        const statusLower = status.toLowerCase();
        if (statusLower === 'completed' || statusLower === 'success') {
            return <Badge bg="success">{status}</Badge>;
        } else if (statusLower === 'failed' || statusLower === 'error') {
            return <Badge bg="danger">{status}</Badge>;
        } else if (statusLower === 'pending' || statusLower === 'queued') {
            return <Badge bg="warning">{status}</Badge>;
        } else if (statusLower === 'started' || statusLower === 'running' || statusLower === 'in_progress') {
            return <Badge bg="info">{status}</Badge>;
        }
        return <Badge bg="secondary">{status}</Badge>;
    };

    const getUserDisplay = (run: PipelineRun) => {
        if (run.user) {
            // User exists - show email with transfer indicator if applicable
            return (
                <div>
                    <div>{run.user.email}</div>
                    {run.transferred_from_anon && (
                        <Badge bg="info" className="mt-1" title="This run was originally created anonymously and transferred to this user account">
                            Transferred from Anonymous
                        </Badge>
                    )}
                </div>
            );
        } else if (run.user_id) {
            // User ID exists but user lookup failed (maybe user was deleted)
            return (
                <div>
                    <Badge bg="warning">User Not Found</Badge>
                    <small className="text-muted d-block mt-1">ID: {run.user_id.substring(0, 8)}...</small>
                    {run.transferred_from_anon && (
                        <Badge bg="info" className="mt-1">Transferred from Anonymous</Badge>
                    )}
                </div>
            );
        } else if (run.session_id) {
            return <Badge bg="secondary">Anonymous Session</Badge>;
        }
        return <span className="text-muted">N/A</span>;
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
                <Alert.Heading>Error loading pipeline runs</Alert.Heading>
                <p>{error}</p>
                <Button variant="primary" onClick={fetchPipelineRuns}>
                    Retry
                </Button>
            </Alert>
        );
    }

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Pipeline Management</h2>
                <Button variant="outline-primary" onClick={fetchPipelineRuns}>
                    Refresh
                </Button>
            </div>

            {runs.length === 0 ? (
                <Alert variant="info">No pipeline runs found.</Alert>
            ) : (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th style={{ width: '50px' }}></th>
                            <th>Pipeline</th>
                            <th>Status</th>
                            <th>Run By</th>
                            <th>Created</th>
                            <th style={{ width: '150px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {runs.map((run) => (
                            <React.Fragment key={run.id}>
                                <tr
                                    onClick={() => navigate(`/runs/${run.id}`, { state: { fromAdmin: true } })}
                                    style={{ cursor: 'pointer' }}
                                    className="hover:bg-gray-100 transition-colors"
                                >
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="p-0"
                                            onClick={() => toggleRow(run.id)}
                                            style={{ color: 'inherit' }}
                                        >
                                            {expandedRows.has(run.id) ? (
                                                <EyeSlash size={16} />
                                            ) : (
                                                <Eye size={16} />
                                            )}
                                        </Button>
                                    </td>
                                    <td>
                                        <strong>{run.pipeline || 'Unknown'}</strong>
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        {editingStatus[run.id] !== undefined ? (
                                            <div className="d-flex align-items-center gap-2">
                                                <Form.Select
                                                    size="sm"
                                                    value={editingStatus[run.id]}
                                                    onChange={(e) => setEditingStatus({ ...editingStatus, [run.id]: e.target.value })}
                                                    style={{ width: 'auto', minWidth: '120px' }}
                                                >
                                                    <option value="pending">Pending</option>
                                                    <option value="started">Started</option>
                                                    <option value="completed">Completed</option>
                                                    <option value="error">Error</option>
                                                </Form.Select>
                                                <Button
                                                    variant="success"
                                                    size="sm"
                                                    onClick={() => handleStatusChange(run.id, editingStatus[run.id])}
                                                >
                                                    ✓
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => cancelEditingStatus(run.id)}
                                                >
                                                    ✕
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="d-flex align-items-center gap-2">
                                                {getStatusBadge(run.status)}
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="p-0"
                                                    onClick={() => startEditingStatus(run.id, run.status)}
                                                    title="Edit status"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                    <td>{getUserDisplay(run)}</td>
                                    <td>{formatDate(run.created_at)}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleDelete(run.id, run.pipeline)}
                                            title="Delete pipeline run"
                                        >
                                            <Trash size={14} />
                                        </Button>
                                    </td>
                                </tr>
                                {expandedRows.has(run.id) && (
                                    <tr>
                                        <td colSpan={6}>
                                            <Card className="m-2">
                                                <Card.Body>
                                                    <h6 className="mb-3">Additional Information</h6>
                                                    <div className="row">
                                                        <div className="col-md-6">
                                                            <p><strong>Run ID:</strong> <code>{run.id}</code></p>
                                                            <p><strong>Pipeline:</strong> {run.pipeline || 'Unknown'}</p>
                                                            <p><strong>Status:</strong> {getStatusBadge(run.status)}</p>
                                                            {run.user_id && (
                                                                <p><strong>User ID:</strong> <code>{run.user_id}</code></p>
                                                            )}
                                                            {run.session_id && (
                                                                <p><strong>Session ID:</strong> <code>{run.session_id}</code></p>
                                                            )}
                                                        </div>
                                                        <div className="col-md-6">
                                                            <p><strong>Output Path:</strong></p>
                                                            <code className="d-block text-break mb-2">{run.output_path || 'N/A'}</code>
                                                            <p><strong>Created At:</strong> {formatDate(run.created_at)}</p>
                                                            {run.timestamp && (
                                                                <p><strong>Timestamp:</strong> {formatTimestamp(run.timestamp)}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </Table>
            )}
        </div>
    );
};

export default PipelineList;

