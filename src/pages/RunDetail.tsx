import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import axios from "axios";
import YAML from "js-yaml";
import type {
    GenomicRegions,
    ProbeDetails,
    Probesets,
    ProbeDetailsValue,
    RunState,
    ProbesetScores,
} from "../types";
import { ReactFlowProvider } from "@xyflow/react";
import ComponentDefinition from "../components/visualization/oligoComponents.json";
import ResultVisualization from "../components/visualization/ResultVisualization";
import { BACKEND_URL } from "../config";
import { Alert, Form, Table } from "react-bootstrap";
import Page from "../components/ui/Page";
import { useRuns } from "../hooks/useRuns";
import {
    visualizationDisplayNames,
    type VisualizationType,
} from "../components/ui/utils";
import Divider from "../components/ui/Divider";
import { Horizontal, Vertical } from "../components/ui/Alignment";
import {
    BoxArrowUp,
    Download,
    FileEarmark,
    FileEarmarkSpreadsheet,
    GearFill,
    Trash,
} from "react-bootstrap-icons";
import { showToast } from "../utils/toastUtil";
import RunStatus from "../components/ui/RunStatus";
import { confirmWithModal } from "../utils/modalUtil";
import type { Action, FileDownloadAction } from "../components/ui/Header";
import RunStatusDetails from "../components/ui/RunStatusDetails";
import RunError from "../components/ui/RunError";
import {
    useNavigateWithRunConfig,
    downloadConfig,
} from "../utils/runConfigHelper";
import RunMetrics from "../components/RunMetrics";
import RunDetailFileAction from "./RunDetailFileAction";
import { PIPELINE_CONFIG, type PipelineConfig } from "../pipelineConfig/config";
import PipelineVisualization from "../components/pipelineVisualization/PipelineVisualization";

interface LocationState {
    fromAdmin?: boolean;
}
/**
 *
 * @returns A React functional component that renders the details of a specific run, including its status, results, and available actions.
 */
const RunDetail = () => {
    const { runId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { runs, updateRuns } = useRuns();
    const prevStatus = useRef<RunState | null>(null);

    const [selectedGene, setSelectedGene] = useState<string>("");
    const [selectedOligoset, setSelectedOligoset] = useState<string>("");
    const [selectedOligo, setSelectedOligo] = useState<string | null>(null);
    const [selectedVisualization, setSelectedVisualization] =
        useState<VisualizationType>("alignment");
    const [genomicRegions, setGenomicRegions] = useState<{
        [key: string]: GenomicRegions;
    } | null>(null);
    const [probes, setProbes] = useState<
        | {
              [key: string]: Probesets;
          }
        | null
        | undefined
    >(undefined); // undefined = not loaded yet, null = no probes available or error loading
    const [scores, setScores] = useState<{
        [key: string]: ProbesetScores;
    } | null>(null);

    const run = useMemo(() => runs.find((r) => r._id === runId), [runs, runId]);

    const tableColumns = ComponentDefinition[
        run?.pipeline as keyof typeof ComponentDefinition
    ]?.columns as string[];

    /**
     * Fetches the genomic regions file for a given run ID and updates the state with the parsed data.
     */
    const fetchGenomicRegionsFile = useCallback(
        (id: string) => {
            if (run?.status === "success" && prevStatus.current !== "success") {
                axios
                    .get(
                        BACKEND_URL +
                            `/api/runs/${id}/files/genomic_regions.yaml`,
                        { withCredentials: true, responseType: "text" }
                    )
                    .then((response) => {
                        const regionsYaml = YAML.load(response.data) as {
                            regions: {
                                [gene: string]: GenomicRegions;
                            };
                            probes: {
                                [gene: string]: Probesets;
                            };
                            scores: {
                                [gene: string]: ProbesetScores;
                            };
                        };

                        const genes = Object.keys(regionsYaml.probes || {});
                        const firstGene = genes[0] || "";
                        const firstOligoset =
                            Object.keys(
                                regionsYaml.probes?.[firstGene] || {}
                            )[0] || "";

                        setGenomicRegions(regionsYaml.regions);
                        setProbes(regionsYaml.probes);
                        setScores(regionsYaml.scores);
                        setSelectedGene(firstGene);
                        setSelectedOligoset(firstOligoset);
                    })
                    .catch((error) => {
                        console.error(
                            "Error fetching genomic regions file:",
                            error
                        );
                        setGenomicRegions(null);
                        setProbes(undefined);
                        return null;
                    });
            }

            prevStatus.current = run?.status || null;
        },
        [prevStatus, run?.status]
    );

    useEffect(() => {
        if (run) {
            fetchGenomicRegionsFile(run._id);
        }
    }, [runs, run, fetchGenomicRegionsFile]); // runs on every poll event

    const handleDelete = useCallback(async () => {
        if (!run) return;

        confirmWithModal({
            title: "Confirm Deletion",
            content:
                "Are you sure you want to delete this run? This action cannot be undone.",
            primaryAction: {
                label: "Delete",
                variant: "danger",
                callback: async () => {
                    try {
                        await axios.delete(
                            BACKEND_URL + `/api/runs/${run._id}`,
                            {
                                withCredentials: true,
                            }
                        );
                        updateRuns();
                        // Navigate back to admin panel if we came from there, otherwise go to runs page
                        const fromAdmin = (location.state as LocationState)
                            ?.fromAdmin;
                        navigate(fromAdmin ? "/admin/pipelines" : "/runs");
                    } catch (error) {
                        console.error("Error deleting run:", error);
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
    }, [run, navigate, location.state, updateRuns]);

    /**
     * Formats a given value for Excel export, handling deeply nested arrays and objects.
     * @param value The value to format, which can be a string, number, array, or object.
     * @returns A string or number suitable for Excel export.
     */
    const formatValueForExcel = useCallback(
        (value: ProbeDetailsValue): string | number => {
            // Handle deeply nested arrays
            const flatten = (
                arr: ProbeDetailsValue[],
                acc: (string | number)[] = []
            ): (string | number)[] => {
                let result: (string | number)[] = [...acc];
                for (const val of arr) {
                    if (Array.isArray(val)) {
                        result = flatten(val, result);
                    } else if (val !== null && typeof val !== "object") {
                        result = result.concat(val);
                    } else {
                        result = result.concat(JSON.stringify(val));
                    }
                }
                return result;
            };

            if (Array.isArray(value)) {
                return flatten(value).join(", ");
            }
            if (typeof value === "object" && value !== null) {
                return JSON.stringify(value);
            }
            return value; // Return raw value for Excel
        },
        []
    );

    const formatValue = useCallback(
        (value: ProbeDetailsValue): string => {
            return String(formatValueForExcel(value));
        },
        [formatValueForExcel]
    );

    const handleUseSettings = useNavigateWithRunConfig(run, navigate);

    const handleExport = useCallback(async () => {
        await downloadConfig(run);
    }, [run]);

    const fromAdmin = (location.state as LocationState)?.fromAdmin;

    const fileActions = useMemo(() => {
        if (!run) return;

        const baseFileUrl = BACKEND_URL + `/api/runs/${run._id}/files/`;

        const fileDownloads =
            PIPELINE_CONFIG[run.pipeline as keyof PipelineConfig].fileDownloads;

        if (!fileDownloads) return;

        return {
            type: "fileDownload",
            label: "Download Files",
            icon: Download,
            fileDownloads: [
                {
                    label: "Oligo Table Excel",
                    icon: FileEarmarkSpreadsheet,
                    fileName: fileDownloads.excelFile,
                    url: baseFileUrl + fileDownloads.excelFile,
                },
                {
                    label: "Oligo Table Tsv",
                    icon: FileEarmarkSpreadsheet,
                    fileName: fileDownloads.probesTable,
                    url: baseFileUrl + fileDownloads.probesTable,
                },
                {
                    label: "Oligo Probes Order",
                    icon: FileEarmark,
                    fileName: fileDownloads.probesOrder,
                    url: baseFileUrl + fileDownloads.probesOrder,
                },
                {
                    label: "Oligo Probes",
                    icon: FileEarmark,
                    fileName: fileDownloads.probes,
                    url: baseFileUrl + fileDownloads.probes,
                },
            ],
        } as FileDownloadAction;
    }, [run]);

    const actions = useMemo(() => {
        if (!run) return undefined;

        const deleteAction = {
            type: "button",
            label: "Delete Run",
            variant: "outline-danger",
            icon: Trash,
            onClick: handleDelete,
        };

        const useSettingsAction = {
            type: "button",
            label: "Use Settings",
            variant: "outline-border",
            icon: GearFill,
            onClick: handleUseSettings,
        };

        const exportSettingsAction = {
            type: "button",
            label: "Export Settings",
            icon: BoxArrowUp,
            variant: "outline-border",
            onClick: handleExport,
        };

        const basicActions = [
            useSettingsAction,
            exportSettingsAction,
            deleteAction,
        ];

        if (probes) {
            if (!fileActions) return basicActions;

            return [
                useSettingsAction,
                exportSettingsAction,
                fileActions,
                deleteAction,
            ];
        } else {
            return basicActions;
        }
    }, [
        run,
        probes,
        handleDelete,
        handleUseSettings,
        fileActions,
        handleExport,
    ]);

    return (
        <Page
            title={`Run Result - ${run ? run.run_name : "Unknown Pipeline Run"}`}
            actions={actions as Action[] | undefined}
            backTo={{
                label: fromAdmin ? "Admin Panel" : "All Runs",
                href: fromAdmin ? "/admin/pipelines" : "/runs",
            }}
        >
            <ReactFlowProvider>
                <PipelineVisualization runId={runId} />
            </ReactFlowProvider>
            {!run && (
                <Alert variant="danger">
                    Run not found. It may have been deleted.
                </Alert>
            )}

            {/* Polling/waiting for YAML/log */}
            {(run?.status == "pending" || run?.status == "started") && (
                <Vertical align="center" className="my-5" gap="lg">
                    <RunStatus status={run.status} size={100} />
                    <RunStatusDetails run={run} />
                </Vertical>
            )}

            {run &&
                ["failure", "empty_result", "timeout"].includes(run.status) && (
                    <RunError run={run} />
                )}

            {/* YAML/table logic remains unchanged below */}
            {run?.status === "success" && (
                <>
                    {probes === undefined && (
                        <Vertical align="center" className="my-5" gap="lg">
                            <RunStatus status="pending" size={100} />
                            <h3 className="mt-3">Processing results...</h3>
                        </Vertical>
                    )}

                    {probes === null && (
                        <>
                            <Alert variant="danger">
                                Results file not found or could not be parsed.
                            </Alert>
                        </>
                    )}

                    {probes && (
                        <>
                            <Vertical
                                className="visual-container"
                                align="stretch"
                                gap="lg"
                            >
                                <h2>Oligo Visualization</h2>
                                <Horizontal gap="md">
                                    <Form.Group controlId="geneSelect">
                                        <Form.Label>Select Gene</Form.Label>
                                        {/* TODO: make this searchable again */}
                                        <Form.Select
                                            value={selectedGene}
                                            onChange={(e) => {
                                                setSelectedGene(e.target.value);
                                                setSelectedOligoset(
                                                    "Oligoset 1"
                                                );
                                                setSelectedOligo(null);
                                            }}
                                        >
                                            {Object.keys(probes).map((gene) => (
                                                <option key={gene} value={gene}>
                                                    {gene}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>

                                    <Form.Group controlId="oligosetSelect">
                                        <Form.Label>Select Oligoset</Form.Label>
                                        <Form.Select
                                            value={selectedOligoset}
                                            onChange={(e) => {
                                                setSelectedOligoset(
                                                    e.target.value
                                                );
                                                setSelectedOligo(null);
                                            }}
                                        >
                                            {Object.keys(
                                                probes[selectedGene]
                                            ).map((oligoset) => (
                                                <option
                                                    key={oligoset}
                                                    value={oligoset}
                                                >
                                                    {oligoset}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>

                                    <Form.Group controlId="visualizationSelect">
                                        <Form.Label>
                                            Select Visualization
                                        </Form.Label>
                                        <Form.Select
                                            value={selectedVisualization}
                                            onChange={(e) => {
                                                setSelectedVisualization(
                                                    e.target
                                                        .value as VisualizationType
                                                );
                                            }}
                                        >
                                            {Object.keys(
                                                visualizationDisplayNames
                                            ).map((visualization) => (
                                                <option
                                                    key={visualization}
                                                    value={visualization}
                                                >
                                                    {
                                                        visualizationDisplayNames[
                                                            visualization as VisualizationType
                                                        ]
                                                    }
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Horizontal>

                                <ResultVisualization
                                    probes={
                                        probes[selectedGene][selectedOligoset]
                                    }
                                    selectedOligo={selectedOligo}
                                    setSelectedOligo={setSelectedOligo}
                                    genomicRegions={
                                        genomicRegions
                                            ? genomicRegions[selectedGene]
                                            : null
                                    }
                                    selectedVisualization={
                                        selectedVisualization
                                    }
                                />

                                <Vertical.Item className="mt-3">
                                    <h3>{selectedOligoset}</h3>
                                    <p className="mb-0">
                                        Average Score:{" "}
                                        {scores?.[selectedGene][
                                            selectedOligoset
                                        ]?.average || "N/A"}{" "}
                                        | Worst Score:{" "}
                                        {scores?.[selectedGene][
                                            selectedOligoset
                                        ]?.worst || "N/A"}
                                    </p>
                                </Vertical.Item>

                                <Table responsive bordered hover>
                                    <thead className="table-light">
                                        <tr>
                                            {tableColumns.map((column) => (
                                                <th
                                                    key={column}
                                                    className="text-nowrap"
                                                >
                                                    {column.replace(/_/g, " ")}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {probes[selectedGene][
                                            selectedOligoset
                                        ].map((oligo) => (
                                            <tr key={oligo.oligo_id}>
                                                {tableColumns.map((column) => (
                                                    <td
                                                        key={`${oligo.oligo_id}-${column}`}
                                                        className={
                                                            "text-nowrap " +
                                                            (oligo.oligo_id ===
                                                            selectedOligo
                                                                ? "table-active"
                                                                : "")
                                                        }
                                                        onClick={() =>
                                                            // select/deselect oligo on click
                                                            setSelectedOligo(
                                                                oligo.oligo_id ===
                                                                    selectedOligo
                                                                    ? null
                                                                    : oligo.oligo_id
                                                            )
                                                        }
                                                    >
                                                        {
                                                            column ===
                                                                "oligo_id" &&
                                                                oligo.oligo_id /* contains index for oligo with multiple locations */
                                                        }
                                                        {column ===
                                                            "location" &&
                                                            `chr${oligo.details.chromosome}:${oligo.start}-${oligo.end}`}
                                                        {column !==
                                                            "oligo_id" &&
                                                            column !==
                                                                "location" &&
                                                            formatValue(
                                                                oligo.details[
                                                                    column as keyof ProbeDetails
                                                                ]
                                                            )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>

                                    <tfoot>
                                        <tr>
                                            <td colSpan={tableColumns.length}>
                                                <strong>Source:</strong>{" "}
                                                {probes[selectedGene][
                                                    selectedOligoset
                                                ][0]?.details.source ?? "N/A"}
                                                <br />
                                                <strong>Species:</strong>{" "}
                                                {probes[selectedGene][
                                                    selectedOligoset
                                                ][0]?.details.species ?? "N/A"}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </Table>
                                <span className="text-muted">
                                    Click an oligo in the table to focus it in
                                    the visualization. Use the mouse wheel to
                                    zoom in for more details.
                                </span>
                            </Vertical>
                            <Divider />

                            <h2>File Downloads</h2>
                            {fileActions && (
                                <RunDetailFileAction
                                    actions={fileActions.fileDownloads}
                                />
                            )}
                        </>
                    )}
                </>
            )}

            {run && <RunMetrics metrics={run.metrics} />}
        </Page>
    );
};

export default RunDetail;
