import React, { useEffect, useState } from "react";
import axios from "axios";
import {
    Table,
    Badge,
    Spinner,
    Alert,
    Button,
    Card,
    Form,
} from "react-bootstrap";
import { Eye, EyeSlash, Trash, Pencil } from "react-bootstrap-icons";
import { useBulkSelection } from "../shared/useBulkSelection";
import BulkActionToolbar from "../shared/BulkActionToolbar";
import { handleBulkOperationSuccess } from "../shared/bulkOperationHelpers";
import { formatAdminDateTime } from "../shared/date";
import RunIdLink from "../shared/RunIdLink";
import { STATUS_CONFIG } from "../shared/types";
import { BACKEND_URL } from "../../config";

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
        identifier?: string;
    };
    session_id?: string;
    transferred_from_anon?: boolean;
}

const PipelineList: React.FC = () => {
    const [runs, setRuns] = useState<PipelineRun[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [editingStatus, setEditingStatus] = useState<{
        [key: string]: string;
    }>({});
    const [isBulkOperationLoading, setIsBulkOperationLoading] = useState(false);

    // Use shared bulk selection hook
    const {
        selectedItems,
        handleSelectItem,
        handleSelectAll,
        clearSelection,
        isSelected,
        selectedCount,
    } = useBulkSelection();

    useEffect(() => {
        fetchPipelineRuns();
    }, []);

    const fetchPipelineRuns = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axios.get(
                BACKEND_URL + "/api/admin/pipelines",
                {
                    withCredentials: true,
                }
            );
            setRuns(response.data);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(
                    err.response?.data?.error || "Failed to load pipeline runs"
                );
            } else {
                setError("Failed to load pipeline runs");
            }
            console.error("Error fetching pipeline runs:", err);
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

    const cancelEditingStatus = (runId: string) => {
        const newEditing = { ...editingStatus };
        delete newEditing[runId];
        setEditingStatus(newEditing);
    };

    const startEditingStatus = (runId: string, currentStatus: string) => {
        setEditingStatus({ ...editingStatus, [runId]: currentStatus });
    };

    const handleStatusChange = async (runId: string, newStatus: string) => {
        try {
            const response = await axios.put(
                BACKEND_URL + `/api/admin/pipelines/${runId}`,
                { status: newStatus },
                { withCredentials: true }
            );

            // Update the run in the local state
            setRuns(
                runs.map((run) => (run.id === runId ? response.data : run))
            );

            // Remove from editing state
            cancelEditingStatus(runId);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                alert(
                    `Failed to update status: ${err.response?.data?.error || err.message}`
                );
            } else {
                alert("Failed to update status");
            }
            console.error("Error updating status:", err);
        }
    };

    const handleDelete = async (runId: string, pipelineName: string) => {
        if (
            window.confirm(
                `Are you sure you want to delete pipeline run "${pipelineName}"? This will also delete all associated output files.`
            )
        ) {
            try {
                await axios.delete(
                    BACKEND_URL + `/api/admin/pipelines/${runId}`,
                    {
                        withCredentials: true,
                    }
                );
                // Remove from local state
                setRuns(runs.filter((run) => run.id !== runId));
                // Remove from expanded rows if it was expanded
                const newExpanded = new Set(expandedRows);
                newExpanded.delete(runId);
                setExpandedRows(newExpanded);
                // Remove from selection if selected
                if (selectedItems.has(runId)) {
                    handleSelectItem(runId);
                }
            } catch (err: unknown) {
                if (axios.isAxiosError(err)) {
                    alert(
                        `Failed to delete pipeline run: ${err.response?.data?.error || err.message}`
                    );
                } else {
                    alert("Failed to delete pipeline run");
                }
                console.error("Error deleting pipeline run:", err);
            }
        }
    };

    const handleBulkDelete = async () => {
        const selectedArray = Array.from(selectedItems);
        if (selectedArray.length === 0) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete ${selectedArray.length} pipeline run(s)? This will also delete all associated output files.`
        );

        if (!confirmed) return;

        setIsBulkOperationLoading(true);
        try {
            const response = await axios.post(
                BACKEND_URL + "/api/admin/pipelines/bulk-delete",
                { run_ids: selectedArray },
                { withCredentials: true }
            );

            const result = response.data;
            let message =
                result.message ||
                `Successfully deleted ${result.deleted_count} pipeline run(s)`;

            if (result.failed && result.failed.length > 0) {
                message += `. ${result.failed.length} failed`;
            }

            // Remove deleted runs from expanded rows
            const newExpanded = new Set(expandedRows);
            selectedArray.forEach((runId) => newExpanded.delete(runId));
            setExpandedRows(newExpanded);

            handleBulkOperationSuccess(
                message,
                clearSelection,
                fetchPipelineRuns
            );
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                alert(
                    `Failed to delete pipeline runs: ${err.response?.data?.error || err.message}`
                );
            } else {
                alert("Failed to delete pipeline runs");
            }
        } finally {
            setIsBulkOperationLoading(false);
        }
    };

    const handleBulkStatusUpdate = async (newStatus: string) => {
        const selectedArray = Array.from(selectedItems);
        if (selectedArray.length === 0) return;

        const statusLabel =
            newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
        const confirmed = window.confirm(
            `Are you sure you want to update status of ${selectedArray.length} run(s) to ${statusLabel}?`
        );

        if (!confirmed) return;

        setIsBulkOperationLoading(true);
        try {
            const response = await axios.post(
                BACKEND_URL + "/api/admin/pipelines/bulk-update-status",
                { run_ids: selectedArray, status: newStatus },
                { withCredentials: true }
            );

            const result = response.data;
            const message =
                result.message ||
                `Successfully updated status of ${result.updated_count} pipeline run(s) to ${newStatus}`;

            handleBulkOperationSuccess(
                message,
                clearSelection,
                fetchPipelineRuns
            );
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                alert(
                    `Failed to update status: ${err.response?.data?.error || err.message}`
                );
            } else {
                alert("Failed to update status");
            }
        } finally {
            setIsBulkOperationLoading(false);
        }
    };

    const formatTimestamp = (timestamp?: string) => {
        if (!timestamp) return "N/A";
        try {
            // Handle timestamp format like "2024-01-15_14-30-45"
            const formatted = timestamp.replace("_", " ").replace(/-/g, "/");
            return formatted;
        } catch {
            return timestamp;
        }
    };

    const getStatusBadge = (status: string) => {
        const color =
            STATUS_CONFIG.colors[status as keyof typeof STATUS_CONFIG.colors];
        return <Badge bg={color}>{status}</Badge>;
    };

    const getUserDisplay = (run: PipelineRun) => {
        if (run.user) {
            // User exists - show identifier with transfer indicator if applicable
            return (
                <div>
                    <div>{run.user.identifier || "Unknown"}</div>
                    {run.transferred_from_anon && (
                        <Badge
                            bg="info"
                            className="mt-1"
                            title="This run was originally created anonymously and transferred to this user account"
                        >
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
                    <small className="text-muted d-block mt-1">
                        ID: {run.user_id.substring(0, 8)}...
                    </small>
                    {run.transferred_from_anon && (
                        <Badge bg="info" className="mt-1">
                            Transferred from Anonymous
                        </Badge>
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

    const allRunIds = runs.map((run) => run.id);
    const allSelected =
        allRunIds.length > 0 && allRunIds.every((id) => selectedItems.has(id));

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Pipeline Management</h2>
                <Button variant="outline-primary" onClick={fetchPipelineRuns}>
                    Refresh
                </Button>
            </div>

            {/* Bulk Action Toolbar */}
            <BulkActionToolbar
                selectedCount={selectedCount}
                itemName="runs"
                onClearSelection={clearSelection}
                actions={
                    <>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={handleBulkDelete}
                            disabled={
                                isBulkOperationLoading || selectedCount === 0
                            }
                        >
                            Delete Selected
                        </Button>
                        <Form.Select
                            size="sm"
                            style={{ width: "auto", display: "inline-block" }}
                            onChange={(e) => {
                                const status = e.target.value;
                                if (status) {
                                    handleBulkStatusUpdate(status);
                                    e.target.value = ""; // Reset dropdown
                                }
                            }}
                            disabled={
                                isBulkOperationLoading || selectedCount === 0
                            }
                            defaultValue=""
                        >
                            <option value="">Update Status...</option>
                            <option value="pending">Pending</option>
                            <option value="started">Started</option>
                            <option value="success">Success</option>
                            <option value="failure">Failure</option>
                        </Form.Select>
                    </>
                }
            />

            {runs.length === 0 ? (
                <Alert variant="info">No pipeline runs found.</Alert>
            ) : (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th style={{ width: "50px" }}>
                                <Form.Check
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => handleSelectAll(allRunIds)}
                                    title="Select all"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </th>
                            <th style={{ width: "50px" }}></th>
                            <th style={{ width: "220px" }}>Run ID</th>
                            <th>Pipeline</th>
                            <th>Status</th>
                            <th>Run By</th>
                            <th>Created</th>
                            <th style={{ width: "150px" }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {runs.map((run) => (
                            <React.Fragment key={run.id}>
                                <tr>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <Form.Check
                                            type="checkbox"
                                            checked={isSelected(run.id)}
                                            onChange={() =>
                                                handleSelectItem(run.id)
                                            }
                                        />
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="p-0"
                                            onClick={() => toggleRow(run.id)}
                                            style={{ color: "inherit" }}
                                        >
                                            {expandedRows.has(run.id) ? (
                                                <EyeSlash size={16} />
                                            ) : (
                                                <Eye size={16} />
                                            )}
                                        </Button>
                                    </td>
                                    <td>
                                        <RunIdLink runId={run.id} />
                                    </td>
                                    <td>
                                        <strong>
                                            {run.pipeline || "Unknown"}
                                        </strong>
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        {editingStatus[run.id] !== undefined ? (
                                            <div className="d-flex align-items-center gap-2">
                                                <Form.Select
                                                    size="sm"
                                                    value={
                                                        editingStatus[run.id]
                                                    }
                                                    onChange={(e) =>
                                                        setEditingStatus({
                                                            ...editingStatus,
                                                            [run.id]:
                                                                e.target.value,
                                                        })
                                                    }
                                                    style={{
                                                        width: "auto",
                                                        minWidth: "120px",
                                                    }}
                                                >
                                                    <option value="pending">
                                                        Pending
                                                    </option>
                                                    <option value="started">
                                                        Started
                                                    </option>
                                                    <option value="success">
                                                        Success
                                                    </option>
                                                    <option value="failure">
                                                        Failure
                                                    </option>
                                                </Form.Select>
                                                <Button
                                                    variant="success"
                                                    size="sm"
                                                    onClick={() =>
                                                        handleStatusChange(
                                                            run.id,
                                                            editingStatus[
                                                                run.id
                                                            ]
                                                        )
                                                    }
                                                >
                                                    ✓
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() =>
                                                        cancelEditingStatus(
                                                            run.id
                                                        )
                                                    }
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
                                                    onClick={() =>
                                                        startEditingStatus(
                                                            run.id,
                                                            run.status
                                                        )
                                                    }
                                                    title="Edit status"
                                                >
                                                    <Pencil size={14} />
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                    <td>{getUserDisplay(run)}</td>
                                    <td>
                                        {formatAdminDateTime(run.created_at)}
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() =>
                                                handleDelete(
                                                    run.id,
                                                    run.pipeline
                                                )
                                            }
                                            title="Delete pipeline run"
                                        >
                                            <Trash size={14} />
                                        </Button>
                                    </td>
                                </tr>
                                {expandedRows.has(run.id) && (
                                    <tr>
                                        <td colSpan={8}>
                                            <Card className="m-2">
                                                <Card.Body>
                                                    <h6 className="mb-3">
                                                        Additional Information
                                                    </h6>
                                                    <div className="row">
                                                        <div className="col-md-6">
                                                            <p>
                                                                <strong>
                                                                    Run ID:
                                                                </strong>{" "}
                                                                <code>
                                                                    {run.id}
                                                                </code>
                                                            </p>
                                                            <p>
                                                                <strong>
                                                                    Pipeline:
                                                                </strong>{" "}
                                                                {run.pipeline ||
                                                                    "Unknown"}
                                                            </p>
                                                            <p>
                                                                <strong>
                                                                    Status:
                                                                </strong>{" "}
                                                                {getStatusBadge(
                                                                    run.status
                                                                )}
                                                            </p>
                                                            {run.user_id && (
                                                                <p>
                                                                    <strong>
                                                                        User ID:
                                                                    </strong>{" "}
                                                                    <code>
                                                                        {
                                                                            run.user_id
                                                                        }
                                                                    </code>
                                                                </p>
                                                            )}
                                                            {run.session_id && (
                                                                <p>
                                                                    <strong>
                                                                        Session
                                                                        ID:
                                                                    </strong>{" "}
                                                                    <code>
                                                                        {
                                                                            run.session_id
                                                                        }
                                                                    </code>
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="col-md-6">
                                                            <p>
                                                                <strong>
                                                                    Output Path:
                                                                </strong>
                                                            </p>
                                                            <code className="d-block text-break mb-2">
                                                                {run.output_path ||
                                                                    "N/A"}
                                                            </code>
                                                            <p>
                                                                <strong>
                                                                    Created At:
                                                                </strong>{" "}
                                                                {formatAdminDateTime(
                                                                    run.created_at
                                                                )}
                                                            </p>
                                                            {run.timestamp && (
                                                                <p>
                                                                    <strong>
                                                                        Timestamp:
                                                                    </strong>{" "}
                                                                    {formatTimestamp(
                                                                        run.timestamp
                                                                    )}
                                                                </p>
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
