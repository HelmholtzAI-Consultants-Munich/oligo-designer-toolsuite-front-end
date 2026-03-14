import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
    Alert,
    Button,
    Card,
    Col,
    Form,
    ListGroup,
    Row,
    Spinner,
    Table,
} from "react-bootstrap";
import Page from "../components/ui/Page";
import { useRuns } from "../modules/useRuns";

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
    const [genomicRegions, setGenomicRegions] = useState<{
        [key: string]: GenomicRegions;
    } | null>(null);
    const [probes, setProbes] = useState<{
        [key: string]: Probesets;
    } | null>(null);

    const run = useMemo(() => runs.find((r) => r._id === runId), [runs, runId]);

    const definition = ComponentDefinition[
        run?.pipeline as keyof typeof ComponentDefinition
    ] as OligoComponentDefinition[] | undefined;
    const tableColumns = getColumnsFromDefinition(definition);

    // --- Polling/log state variables ---
    const fetchAndParseRunFiles = useCallback((id: string) => {
        if (prevStatus.current !== "success") {
            axios.get(
                BACKEND_URL + `/api/runs/${id}/files`,
                {
                    withCredentials: true,
                }
            ).then((response) => setFiles(response.data));
        }

        if (run?.status === "success" && prevStatus.current !== "success") {
            axios
                .get(
                    BACKEND_URL + `/api/runs/${id}/files/genomic_regions.yaml`,
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
                        Object.keys(regionsYaml.probes?.[firstGene] || {})[0] || "";
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
                    console.error("Error fetching genomic regions file:", error);
                    setGenomicRegions(null);
                    setProbes(null);
                    return null;
                });
        }

        prevStatus.current = run?.status || null;
    }, [prevStatus, run?.status]);

    useEffect(() => {
        if (run) {
            fetchAndParseRunFiles(run._id);
        }
    }, [runs, run, fetchAndParseRunFiles]); // runs on every poll event

    const fetchFileContent = useCallback((filename: string) => {
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
    }, [runId]);

    useEffect(() => {
        if (viewingFilename) {
            fetchFileContent(viewingFilename);
        }
    }, [runs, viewingFilename, fetchFileContent]); // runs on every poll event

    const handleDelete = async () => {
        if (!run) return;
        if (
            window.confirm(
                "Are you sure you want to delete this run? This action cannot be undone."
            )
        ) {
            try {
                await axios.delete(BACKEND_URL + `/api/runs/${run._id}`, {
                    withCredentials: true,
                });
                updateRuns();
                // Navigate back to admin panel if we came from there, otherwise go to runs page
                const fromAdmin = (location.state as LocationState)?.fromAdmin;
                navigate(fromAdmin ? "/admin/pipelines" : "/runs");
            } catch (error) {
                console.error("Error deleting run:", error);
                alert("Failed to delete run");
            }
        }
    };

    // Download CSV for current oligoset only
    const handleDownloadCSV = () => {
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
    };

    // Download Excel file with each gene as a separate sheet
    const handleDownloadExcel = () => {
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
    };

    const formatValueForExcel = (value: ProbeDetailsValue): string | number => {
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
    };

    const formatValue = (value: ProbeDetailsValue): string => {
        return String(formatValueForExcel(value));
    };

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

    return (
        <Page
            title={`Run Result - ${runId}`}
            actions={[
                {
                    type: "button",
                    label: "Delete Run",
                    variant: "danger",
                    onClick: handleDelete,
                },
            ]}
        >
            <Button
                variant="outline-secondary"
                onClick={() => {
                    const fromAdmin = (location.state as LocationState)
                        ?.fromAdmin;
                    navigate(fromAdmin ? "/admin/pipelines" : "/runs");
                }}
            >
                ← Back to{" "}
                {(location.state as LocationState)?.fromAdmin
                    ? "Admin Panel"
                    : "Runs"}
            </Button>

            <ListGroup>
                {files
                    .filter((file) => file.name.toLowerCase().includes("log"))
                    .map((file) => (
                        <ListGroup.Item key={file.name}>
                            <Row>
                                <Col>
                                    {file.name}
                                    <span className="badge bg-secondary ms-2">
                                        {Math.round(file.size / 1024)} KB
                                    </span>
                                </Col>
                                <Col xs="auto">
                                    {file.name.endsWith(".txt") && (
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={() =>
                                                viewFileContent(file.name)
                                            }
                                        >
                                            View
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline-success"
                                        size="sm"
                                        onClick={() => downloadFile(file.name)}
                                    >
                                        Download
                                    </Button>
                                </Col>
                            </Row>
                        </ListGroup.Item>
                    ))}
            </ListGroup>

            {fileContent &&
                viewingFilename &&
                viewingFilename.endsWith(".txt") && (
                    <>
                        <h4>Viewing: {viewingFilename}</h4>
                        <pre
                            className="bg-light p-3 rounded mb-4"
                            style={{
                                maxHeight: "500px",
                                overflow: "auto",
                            }}
                        >
                            {fileContent}
                        </pre>
                    </>
                )}

            {/* Polling/waiting for YAML/log */}
            {(run?.status == "pending" || run?.status == "started") && (
                <Alert variant="info">
                    Run is {run.status == "pending" ? "pending" : "executing"}
                    ... <Spinner size="sm" />
                </Alert>
            )}

            {/* YAML/table logic remains unchanged below */}
            {probes && (
                <Card>
                    <Card.Body>
                        <Card.Title className="d-flex">
                            <Col>Gene Analysis</Col>
                            <Col xs="auto">
                                <button
                                    onClick={handleDownloadExcel}
                                    className="btn btn-success"
                                    title="Download Excel file with each gene as a separate sheet"
                                >
                                    Download All Genes Excel
                                </button>
                            </Col>
                        </Card.Title>

                        <Row>
                            <Col md={6}>
                                <Form.Group controlId="geneSelect">
                                    <Form.Label>Select Gene</Form.Label>
                                    {/* TODO: make this searchable again */}
                                    <Form.Select
                                        value={selectedGene}
                                        onChange={(e) => {
                                            setSelectedGene(e.target.value);
                                            setSelectedOligoset("Oligoset 1");
                                            setSelectedOligo(
                                                probes[e.target.value || ""][
                                                    "Oligoset 1"
                                                ][0].oligo_id || ""
                                            );
                                        }}
                                    >
                                        <option value="">Select a gene</option>
                                        {Object.keys(probes).map((gene) => (
                                            <option key={gene} value={gene}>
                                                {gene}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>

                            {selectedGene && (
                                <Col md={6}>
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
                                            <option value="">
                                                Select an Oligoset
                                            </option>
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
                                </Col>
                            )}
                        </Row>

                        {selectedGene && selectedOligoset && (
                            <>
                                <Row>
                                    <Col>
                                        <h5>Oligos in {selectedOligoset}</h5>
                                    </Col>
                                    <Col xs="auto">
                                        <Form.Text>
                                            Showing{" "}
                                            {
                                                probes[selectedGene][
                                                    selectedOligoset
                                                ].length
                                            }{" "}
                                            oligos
                                        </Form.Text>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={handleDownloadCSV}
                                        >
                                            Download Oligoset CSV
                                        </Button>
                                    </Col>
                                </Row>

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
                                />

                                <Table responsive bordered striped hover>
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
                            </>
                        )}
                    </Card.Body>
                </Card>
            )}
        </Page>
    );
};

export default RunDetail;
