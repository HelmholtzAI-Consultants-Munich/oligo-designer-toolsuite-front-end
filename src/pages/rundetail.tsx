import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import YAML from "js-yaml";
import Select from "react-select";
import type { SingleValue } from "react-select";
import Navbar from "../components/ui/Topbar";
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
import { Alert, Button, Card, Col, Container, ListGroup, Row, Spinner } from "react-bootstrap";
import { List } from "react-bootstrap-icons";

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
    const [files, setFiles] = useState<RunFile[]>([]);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);
    const [pipeline, setPipeline] = useState<string>("");

    const [selectedGene, setSelectedGene] = useState<string>("");
    const [selectedOligoset, setSelectedOligoset] = useState<string>("");
    const [selectedOligo, setSelectedOligo] = useState<string>("");
    const [genomicRegions, setGenomicRegions] = useState<{
        [key: string]: GenomicRegions;
    } | null>(null);
    const [probes, setProbes] = useState<{
        [key: string]: Probesets;
    } | null>(null);

    const definition = ComponentDefinition[
        pipeline as keyof typeof ComponentDefinition
    ] as OligoComponentDefinition[] | undefined;
    const tableColumns = getColumnsFromDefinition(definition);

    const closeFileView = () => {
        setViewingFilename(null);
    };
    // --- Polling/log state variables ---
    const [runState, setRunState] = useState<RunState>("pending");
    const [polling, setPolling] = useState(true);
    const fetchAndParseRunFiles = useCallback(() => {
        axios
            .get(
                BACKEND_URL + `/api/runs/${runId}/files/genomic_regions.yaml`,
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
    }, [runId]);
    // Poll for files & log/YAML status
    useEffect(() => {
        if (!runId) return;
        let interval: NodeJS.Timeout;

        const poll = async () => {
            try {
                const response = await axios.get(
                    BACKEND_URL + `/api/runs/${runId}/state`,
                    {
                        withCredentials: true,
                    }
                );
                setRunState(response.data.state);

                // If finished, stop polling
                if (
                    response.data.state == "success" ||
                    response.data.state == "failure"
                ) {
                    setPolling(false);
                    if (interval) clearInterval(interval);
                    const response = await axios.get(
                        BACKEND_URL + `/api/runs/${runId}/files`,
                        {
                            withCredentials: true,
                        }
                    );
                    setFiles(response.data);

                    const runResponse = await axios.get(
                        BACKEND_URL + `/api/runs/${runId}`,
                        {
                            withCredentials: true,
                        }
                    );
                    setPipeline(runResponse.data.pipeline || "");

                    // genomic regions check
                    const regionsFile = response.data.find(
                        (f: RunFile) => f.name === "genomic_regions.yaml"
                    );

                    // If genomic regions file present, stop polling!
                    if (regionsFile) {
                        setPolling(false);
                        if (interval) clearInterval(interval);
                        // Fetch and parse YAML as before
                        fetchAndParseRunFiles();
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };

        if (polling) {
            interval = setInterval(poll, 2000);
            poll(); // initial
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [runId, polling, fetchAndParseRunFiles]);

    const handleDelete = async () => {
        if (
            window.confirm(
                "Are you sure you want to delete this run? This action cannot be undone."
            )
        ) {
            try {
                await axios.delete(BACKEND_URL + `/api/runs/${runId}`, {
                    withCredentials: true,
                });
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
            closeFileView();
            return;
        }

        axios
            .get(BACKEND_URL + `/api/runs/${runId}/files/${filename}`, {
                withCredentials: true,
                responseType: "text",
            })
            .then((response) => {
                setViewingFilename(filename);
                setFileContent(response.data);
            })
            .catch((error) =>
                console.error("Error fetching file content:", error)
            );
    };

    const downloadFile = (filename: string) => {
        window.open(
            BACKEND_URL + `/api/runs/${runId}/files/${filename}`,
            "_blank"
        );
    };

    return (
        <>
            <Navbar />
            <Container>
                <Row>
                    <Col>
                        <Button
                            variant="outline-secondary"
                            onClick={() => {
                                const fromAdmin = (
                                    location.state as LocationState
                                )?.fromAdmin;
                                navigate(
                                    fromAdmin ? "/admin/pipelines" : "/runs"
                                );
                            }}
                        >
                            ← Back to{" "}
                            {(location.state as LocationState)?.fromAdmin
                                ? "Admin Panel"
                                : "Runs"}
                        </Button>
                    </Col>
                    <Col xs="auto">
                        <Button variant="danger" onClick={handleDelete}>
                            Delete Run
                        </Button>
                    </Col>
                </Row>

                <h3>Run Files</h3>
                <ListGroup>
                    {files
                        .filter((file) =>
                            file.name.toLowerCase().includes("log")
                        )
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
                                            onClick={() =>
                                                downloadFile(file.name)
                                            }
                                        >
                                            Download
                                        </Button>
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                        ))}
                </ListGroup>

                {fileContent && viewingFilename && viewingFilename.endsWith(".txt") && (
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
                {(runState == "pending" || runState == "started") && (
                    <Alert variant="info">
                        Run is {runState == "pending" ? "pending" : "executing"}
                        ... {" "}
                        <Spinner size="sm" />
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
                                    <label className="form-label">
                                        Select Gene
                                    </label>
                                    <Select
                                        options={Object.keys(probes).map(
                                            (gene) => ({
                                                value: gene,
                                                label: gene,
                                            })
                                        )}
                                        value={
                                            Object.keys(probes)
                                                .map((gene) => ({
                                                    value: gene,
                                                    label: gene,
                                                }))
                                                .find(
                                                    (option) =>
                                                        option.value ===
                                                        selectedGene
                                                ) || null
                                        }
                                        onChange={(
                                            newValue: SingleValue<{
                                                value: string;
                                                label: string;
                                            }>
                                        ) => {
                                            setSelectedGene(
                                                newValue?.value || ""
                                            );
                                            setSelectedOligoset("Oligoset 1");
                                            setSelectedOligo(
                                                probes[newValue?.value || ""][
                                                    "Oligoset 1"
                                                ][0].oligo_id || ""
                                            );
                                        }}
                                        placeholder="Search or select gene..."
                                        isSearchable
                                        className="basic-single"
                                        classNamePrefix="select"
                                    />
                                </Col>

                                {selectedGene && (
                                    <div className="col-md-6">
                                        <label className="form-label">
                                            Select Oligoset
                                        </label>
                                        <select
                                            className="form-select"
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
                                                probes[selectedGene] || {}
                                            ).map((oligoset) => (
                                                <option
                                                    key={oligoset}
                                                    value={oligoset}
                                                >
                                                    {oligoset}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </Row>

                            {selectedOligoset && (
                                <div className="mt-3">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <h5>Oligos in {selectedOligoset}</h5>
                                        <div>
                                            <span className="form-text me-2">
                                                Showing{" "}
                                                {
                                                    probes[selectedGene][
                                                        selectedOligoset
                                                    ].length
                                                }{" "}
                                                oligos
                                            </span>
                                            <button
                                                onClick={handleDownloadCSV}
                                                className="btn btn-sm btn-primary"
                                            >
                                                Download Oligoset CSV
                                            </button>
                                        </div>
                                    </div>
                                    <div className="my-3">
                                        <ResultVisualization
                                            probes={
                                                probes[selectedGene][
                                                    selectedOligoset
                                                ] || []
                                            }
                                            selectedOligo={selectedOligo}
                                            setSelectedOligo={setSelectedOligo}
                                            genomicRegions={
                                                genomicRegions
                                                    ? genomicRegions[
                                                          selectedGene
                                                      ]
                                                    : null
                                            }
                                        />
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-bordered table-striped table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    {tableColumns.map(
                                                        (column) => (
                                                            <th
                                                                key={column}
                                                                className="text-nowrap"
                                                            >
                                                                {column.replace(
                                                                    /_/g,
                                                                    " "
                                                                )}
                                                            </th>
                                                        )
                                                    )}
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {probes[selectedGene][
                                                    selectedOligoset
                                                ].map(({ details: oligo }) => (
                                                    <tr key={oligo.oligo_id}>
                                                        {tableColumns.map(
                                                            (column) => (
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
                                                                    {column ===
                                                                    "location"
                                                                        ? `chr${oligo.chromosome}:${oligo.start}-${oligo.end}`
                                                                        : formatValue(
                                                                              oligo[
                                                                                  column as keyof ProbeDetails
                                                                              ]
                                                                          )}
                                                                </td>
                                                            )
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>

                                            <tfoot>
                                                <tr>
                                                    <td
                                                        colSpan={
                                                            tableColumns.length
                                                        }
                                                    >
                                                        <div className="mt-2">
                                                            <strong>
                                                                Source:
                                                            </strong>{" "}
                                                            {probes[
                                                                selectedGene
                                                            ][
                                                                selectedOligoset
                                                            ][0].details
                                                                .source ??
                                                                "N/A"}
                                                            <br />
                                                            <strong>
                                                                Species:
                                                            </strong>{" "}
                                                            {probes[
                                                                selectedGene
                                                            ][
                                                                selectedOligoset
                                                            ][0].details
                                                                .species ??
                                                                "N/A"}
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                )}
            </Container>
        </>
    );
};

export default RunDetail;
