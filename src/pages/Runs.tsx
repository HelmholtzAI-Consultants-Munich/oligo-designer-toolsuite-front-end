import { useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import axios from "axios";
import { BACKEND_URL } from "../config";
import { Button, Table } from "react-bootstrap";
import Page from "../components/ui/Page";
import { useRuns } from "../hooks/useRuns";
import RunStatus from "../components/ui/RunStatus";
import { showToast } from "../utils/toastUtil";
import { Horizontal } from "../components/ui/Alignment";
import { confirmWithModal } from "../utils/modalUtil";
import { PIPELINE_CONFIG, type PipelineConfig } from "../pipelineConfig/config";

const Runs = () => {
    const { loading } = useAuth();
    const { runs, updateRuns } = useRuns();
    const navigate = useNavigate();

    // Add this handler function
    const handleDeleteRun = async (runId: string) => {
        confirmWithModal({
            title: "Confirm Deletion",
            content:
                "Are you sure you want to delete this run? This action cannot be undone.",
            primaryAction: {
                label: "Delete",
                variant: "danger",
                callback: async () => {
                    try {
                        await axios.delete(BACKEND_URL + `/api/runs/${runId}`, {
                            withCredentials: true,
                        });
                        updateRuns(); // Refresh the list of runs after deletion
                        navigate("/runs");
                    } catch (error) {
                        console.error("Error deleting run:", error);
                        navigate("/runs");
                        showToast({
                            title: "Failed to delete run",
                            content:
                                "An error occurred while trying to delete the run. Please try again later.",
                            type: "danger",
                        });
                    }
                },
            },
        });
    };

    if (loading) return <div>Loading...</div>;

    return (
        <Page title="Pipeline Runs">
            <Table responsive hover>
                <thead>
                    <tr>
                        <th></th>
                        <th>Pipeline</th>
                        <th>Started</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {runs.map((run) => (
                        <tr
                            key={run._id}
                            onClick={() => navigate(`/runs/${run._id}`)}
                            style={{
                                cursor: "pointer",
                                verticalAlign: "middle",
                            }}
                            className="hover:bg-gray-100"
                        >
                            <td>
                                <RunStatus status={run.status} />
                                {run.status === "failure" &&
                                    run.error_message && (
                                        <div className="text-danger small mt-1">
                                            {run.error_message}
                                        </div>
                                    )}
                            </td>
                            <td>
                                {PIPELINE_CONFIG[
                                    run.pipeline as keyof PipelineConfig
                                ].displayName || run.pipeline}
                            </td>
                            <td>
                                {new Date(run.timestamp).toLocaleString(
                                    "en-US",
                                    {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    }
                                )}
                            </td>
                            <td>
                                <Horizontal gap="md">
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => {}}
                                    >
                                        View
                                    </Button>
                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRun(run._id);
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </Horizontal>
                            </td>
                        </tr>
                    ))}
                    {runs.length === 0 && (
                        <tr>
                            <td
                                colSpan={4}
                                className="text-center py-4 text-muted"
                            >
                                No pipeline runs found. Start your first
                                analysis!
                            </td>
                        </tr>
                    )}
                </tbody>
            </Table>
        </Page>
    );
};

export default Runs;
