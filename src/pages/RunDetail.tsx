import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import axios from "axios";
import YAML from "js-yaml";
import * as XLSX from "xlsx";
import type {
    GenomicRegions,
    ProbeDetails,
    Probesets,
    ProbeDetailsValue,
    RunState,
} from "../types";
import ComponentDefinition from "../components/visualization/oligoComponents.json";
import ResultVisualization from "../components/visualization/ResultVisualization";
import { BACKEND_URL } from "../config";
import { Alert, Button, Form, ListGroup, Table } from "react-bootstrap";
import Page from "../components/ui/Page";
import { useRuns } from "../hooks/useRuns";
import {
    pipelineDisplayNames,
    visualizationDisplayNames,
    type VisualizationType,
} from "../components/ui/utils";
import Divider from "../components/ui/Divider";
import { Horizontal, Vertical } from "../components/ui/Alignment";
import { CardList, FileEarmarkSpreadsheet, Trash } from "react-bootstrap-icons";
import { showToast } from "../utils/toastUtil";
import RunStatus from "../components/ui/RunStatus";
import { confirmWithModal } from "../utils/modalUtil";
import type { Action } from "../components/ui/Header";

interface RunFile {
    name: string;
    type: "log" | "config";
    size: number;
}

// Helper to extract all unique columns from an array of oligos
function getAllOligoColumns(oligos: ProbeDetails[]): string[] {
    const columns = new Set<string>();
    oligos.forEach((o) => Object.keys(o).forEach((k) => columns.add(k)));
    return Array.from(columns);
}

type OligoComponentDefinition = {
    type: "columns";
    value: string[];
};

function getColumnsFromDefinition(
    definition: OligoComponentDefinition[] | undefined
): string[] {
    if (!definition) {
        return [];
    }

    const columnsEntry = definition.find((item) => item.type === "columns");

    if (!columnsEntry) {
        console.error("No target field found in component definition");
        return []; // fallback
    }

    return columnsEntry.value;
}

interface LocationState {
    fromAdmin?: boolean;
}

const RunDetail = () => {
    const { runId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { runs, updateRuns } = useRuns();
    const prevStatus = useRef<RunState | null>(null);
    const [files, setFiles] = useState<RunFile[]>([]);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);

    const [selectedGene, setSelectedGene] = useState<string>("");
    const [selectedOligoset, setSelectedOligoset] = useState<string>("");
    const [selectedOligo, setSelectedOligo] = useState<string>("");
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

    const run = useMemo(() => runs.find((r) => r._id === runId), [runs, runId]);

    const definition = ComponentDefinition[
        run?.pipeline as keyof typeof ComponentDefinition
    ] as OligoComponentDefinition[] | undefined;
    const tableColumns = getColumnsFromDefinition(definition);

    // --- Polling/log state variables ---
    const fetchAndParseRunFiles = useCallback(
        (id: string) => {
            if (prevStatus.current !== "success") {
                axios
                    .get(BACKEND_URL + `/api/runs/${id}/files`, {
                        withCredentials: true,
                    })
                    .then((response) => setFiles(response.data));
            }

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
                        };

                        const genes = Object.keys(regionsYaml.probes || {});
                        const firstGene = genes[0] || "";
                        const firstOligoset =
                            Object.keys(
                                regionsYaml.probes?.[firstGene] || {}
                            )[0] || "";
                        const firstOligo =
                            regionsYaml.probes?.[firstGene]?.[firstOligoset][0]
                                ?.oligo_id || "";

                        setGenomicRegions(regionsYaml.regions);
                        setProbes(regionsYaml.probes);
                        setSelectedGene(firstGene);
                        setSelectedOligoset(firstOligoset);
                        setSelectedOligo(firstOligo);
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
            fetchAndParseRunFiles(run._id);
        }
    }, [runs, run, fetchAndParseRunFiles]); // runs on every poll event

    const fetchFileContent = useCallback(
        (filename: string) => {
            axios
                .get(BACKEND_URL + `/api/runs/${runId}/files/${filename}`, {
                    withCredentials: true,
                    responseType: "text",
                })
                .then((response) => {
                    setFileContent(response.data);
                })
                .catch((error) =>
                    console.error("Error fetching file content:", error)
                );
        },
        [runId]
    );

    useEffect(() => {
        if (viewingFilename) {
            fetchFileContent(viewingFilename);
        }
    }, [runs, viewingFilename, fetchFileContent]); // runs on every poll event

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

    // Download CSV for current oligoset only
    const handleDownloadCSV = useCallback(() => {
        // TODO: include all output fields in details
        const oligos =
            probes?.[selectedGene]?.[selectedOligoset]?.map((p) => p.details) ||
            [];
        if (oligos.length === 0) return;

        const allColumns = getAllOligoColumns(oligos);
        // Updated headers with Gene and Oligoset
        const headers = ["Gene", "Oligoset", ...allColumns]
            .map((col) => `"${col.replace(/_/g, " ")}"`)
            .join(",");

        // Add Gene and Oligoset to each row
        const rows = oligos
            .map((oligo) => {
                const rowData = [
                    selectedGene,
                    selectedOligoset,
                    ...allColumns.map((col) =>
                        formatValue(oligo[col as keyof ProbeDetails])
                    ),
                ];

                return rowData
                    .map((value) => {
                        if (
                            typeof value === "string" &&
                            (value.includes(",") || value.includes('"'))
                        ) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    })
                    .join(",");
            })
            .join("\n");

        // Create CSV content
        const csvContent = `${headers}\n${rows}`;

        // Trigger download
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedGene}_${selectedOligoset}_oligos.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [probes, selectedGene, selectedOligoset, formatValue]);

    // Download Excel file with each gene as a separate sheet
    const handleDownloadExcel = useCallback(() => {
        if (!probes) return;

        const workbook = XLSX.utils.book_new();

        // Iterate through all genes and create a sheet for each
        Object.keys(probes).forEach((gene) => {
            // Gather all oligos for this gene
            const geneOligos: { oligoset: string; oligo: ProbeDetails }[] = [];
            const oligosets = Object.keys(probes[gene] || {});

            oligosets.forEach((oligoset) => {
                const oligos =
                    probes[gene][oligoset].map((p) => p.details) || [];
                oligos.forEach((oligo) => {
                    geneOligos.push({ oligoset, oligo });
                });
            });

            const allColumns = getAllOligoColumns(
                geneOligos.map((item) => item.oligo)
            );
            const headers = [
                "Oligoset",
                ...allColumns.map((col) => col.replace(/_/g, " ")),
            ];

            const geneData: (string | number)[][] = [];
            geneData.push(headers);
            geneOligos.forEach((item) => {
                const row = [
                    item.oligoset,
                    ...allColumns.map((col) =>
                        formatValueForExcel(
                            item.oligo[col as keyof ProbeDetails]
                        )
                    ),
                ];
                geneData.push(row);
            });

            // Create worksheet for this gene
            const worksheet = XLSX.utils.aoa_to_sheet(geneData);

            // Sanitize sheet name (Excel has restrictions on sheet names)
            const sanitizedGeneName = gene
                .replace(/[\]\\/?*[\]]/g, "_")
                .substring(0, 31);

            XLSX.utils.book_append_sheet(
                workbook,
                worksheet,
                sanitizedGeneName
            );
        });

        // Write file
        XLSX.writeFile(workbook, "all_genes_oligos.xlsx");
    }, [probes, formatValueForExcel]);

    const viewFileContent = (filename: string) => {
        if (viewingFilename === filename) {
            setViewingFilename(null);
            setFileContent(null);
        } else {
            setViewingFilename(filename);
            setFileContent("Loading...");
        }
    };

    const downloadFile = (filename: string) => {
        window.open(
            BACKEND_URL + `/api/runs/${runId}/files/${filename}`,
            "_blank"
        );
    };

    const fromAdmin = (location.state as LocationState)?.fromAdmin;

    const actions = useMemo(() => {
        if (!run) return undefined;

        const deleteAction = {
            type: "button",
            label: "Delete Run",
            variant: "outline-danger",
            icon: Trash,
            onClick: handleDelete,
        };

        const downloadExcelAction = {
            type: "button",
            label: "All Genes Excel",
            variant: "outline-primary",
            icon: FileEarmarkSpreadsheet,
            onClick: handleDownloadExcel,
        };

        const downloadCSVAction = {
            type: "button",
            label: "Oligoset CSV",
            variant: "outline-primary",
            icon: CardList,
            onClick: handleDownloadCSV,
        };

        if (probes) {
            return [deleteAction, downloadExcelAction, downloadCSVAction];
        } else {
            return [deleteAction];
        }
    }, [run, probes, handleDelete, handleDownloadCSV, handleDownloadExcel]);

    return (
        <Page
            title={`Run Result - ${run ? pipelineDisplayNames[run?.pipeline] : "Unknown Pipeline"}`}
            actions={actions as Action[] | undefined}
            backTo={{
                label: fromAdmin ? "Admin Panel" : "All Runs",
                href: fromAdmin ? "/admin/pipelines" : "/runs",
            }}
        >
            {!run && (
                <Alert variant="danger">
                    Run not found. It may have been deleted.
                </Alert>
            )}

            {/* Polling/waiting for YAML/log */}
            {(run?.status == "pending" || run?.status == "started") && (
                <Vertical align="center" className="my-5" gap="lg">
                    <RunStatus status={run.status} size={100} />
                    <h3 className="mt-3">Run {run.status}...</h3>
                </Vertical>
            )}

            {run?.status === "failure" && (
                <Alert variant="danger">
                    Run failed. Please check the logs for more details.
                </Alert>
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
                                Please check the logs for more details.
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
                                                setSelectedOligo(
                                                    probes[
                                                        e.target.value || ""
                                                    ]["Oligoset 1"][0]
                                                        .oligo_id || ""
                                                );
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
                                                setSelectedOligo(
                                                    probes[selectedGene][
                                                        e.target.value
                                                    ]?.[0].oligo_id || ""
                                                );
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
                                        ].map(({ details: oligo }) => (
                                            <tr key={oligo.oligo_id}>
                                                {tableColumns.map((column) => (
                                                    <td
                                                        key={`${oligo.oligo_id}-${column}`}
                                                        className={
                                                            "text-nowrap " +
                                                            (oligo.oligo_id ===
                                                            selectedOligo
                                                                ? "table-primary"
                                                                : "")
                                                        }
                                                        onClick={() =>
                                                            setSelectedOligo(
                                                                oligo.oligo_id
                                                            )
                                                        }
                                                    >
                                                        {column === "location"
                                                            ? `chr${oligo.chromosome}:${oligo.start}-${oligo.end}`
                                                            : formatValue(
                                                                  oligo[
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
                                    the visualization.
                                </span>
                            </Vertical>
                            <Divider />

                            <h2>File Downloads</h2>

                            <Horizontal gap="md">
                                <Button
                                    variant="outline-primary"
                                    onClick={handleDownloadCSV}
                                >
                                    <FileEarmarkSpreadsheet /> All Genes Excel
                                </Button>
                                <Button
                                    variant="outline-primary"
                                    onClick={handleDownloadCSV}
                                >
                                    <CardList /> Oligoset CSV
                                </Button>
                            </Horizontal>
                        </>
                    )}
                </>
            )}

            {run &&
                files.filter((file) => file.name.toLowerCase().includes("log"))
                    .length > 0 && (
                    <>
                        <Divider />

                        <h2>Run Logs</h2>

                        <ListGroup>
                            {files
                                .filter((file) =>
                                    file.name.toLowerCase().includes("log")
                                )
                                .map((file) => (
                                    <ListGroup.Item key={file.name}>
                                        <Horizontal
                                            gap="md"
                                            align="center"
                                            wrap
                                        >
                                            {file.name}
                                            <Horizontal.Item grow>
                                                <span className="badge bg-secondary">
                                                    {Math.round(
                                                        file.size / 1024
                                                    )}{" "}
                                                    KB
                                                </span>
                                            </Horizontal.Item>
                                            {file.name.endsWith(".txt") && (
                                                <Button
                                                    variant="outline-secondary"
                                                    size="sm"
                                                    onClick={() =>
                                                        viewFileContent(
                                                            file.name
                                                        )
                                                    }
                                                >
                                                    {viewingFilename ===
                                                    file.name
                                                        ? "Hide"
                                                        : "View"}
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() =>
                                                    downloadFile(file.name)
                                                }
                                            >
                                                Download
                                            </Button>
                                        </Horizontal>
                                        {fileContent &&
                                            viewingFilename === file.name && (
                                                <pre
                                                    className="bg-light p-3 rounded mt-2"
                                                    style={{
                                                        maxHeight: "500px",
                                                        whiteSpace: "pre-wrap",
                                                    }}
                                                >
                                                    {fileContent}
                                                </pre>
                                            )}
                                    </ListGroup.Item>
                                ))}
                        </ListGroup>
                    </>
                )}
        </Page>
    );
};

export default RunDetail;
