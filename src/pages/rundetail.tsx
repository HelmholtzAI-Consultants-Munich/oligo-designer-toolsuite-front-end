import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import YAML from "js-yaml";
import Select from "react-select";
import type { SingleValue } from "react-select";
import { useAuth } from "../modules/useAuth";
import Navbar from "../modules/nav";
import * as XLSX from "xlsx";
import type { GenomicRegions, Oligo, OligoValue, RunState } from "../types";
import ComponentDefinition from "../components/visualization/oligoComponents.json";
import ResultVisualization from "../components/visualization/ResultVisualization";
import { BACKEND_URL } from "../config";
import FeedbackButton from "../components/feedback/FeedbackButton";

interface RunFile {
    name: string;
    type: "log" | "config";
    size: number;
}

// Helper to extract all unique columns from an array of oligos
function getAllOligoColumns(oligos: Oligo[]): string[] {
    const columns = new Set<string>();
    oligos.forEach((o) => Object.keys(o).forEach((k) => columns.add(k)));
    return Array.from(columns);
}

interface GeneOption {
    value: string;
    label: string;
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

/** Parsed YAML structure: gene -> oligoset -> "Oligo N" -> oligo data */
type ParsedYamlData = Record<
    string,
    Record<string, Record<string, OligoValue>>
>;

const RunDetail = () => {
    const { runId } = useParams();
    useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [files, setFiles] = useState<RunFile[]>([]);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);
    const [pipeline, setPipeline] = useState<string>("");
    const [selectedOligo, setSelectedOligo] = useState(0);

    const [parsedYamlData, setParsedYamlData] = useState<ParsedYamlData | null>(
        null
    );
    const [selectedGene, setSelectedGene] = useState<string>("");
    const [selectedOligoset, setSelectedOligoset] = useState<string>("");
    const [geneOptions, setGeneOptions] = useState<GeneOption[]>([]);
    const [genomicRegions, setGenomicRegions] = useState<{
        [key: string]: GenomicRegions;
    } | null>(null);

    const definition = ComponentDefinition[
        pipeline as keyof typeof ComponentDefinition
    ] as OligoComponentDefinition[] | undefined;
    const tableColumns = getColumnsFromDefinition(definition);

    const closeFileView = () => {
        setViewingFilename(null);
    };
    const [runState, setRunState] = useState<RunState>("pending");
    const [polling, setPolling] = useState(true);
    const fetchAndParseRunFiles = useCallback(
        (yamlFilename: string) => {
            axios
                .get(BACKEND_URL + `/api/runs/${runId}/files/${yamlFilename}`, {
                    withCredentials: true,
                    responseType: "text",
                })
                .then((response) => {
                    try {
                        const parsed = YAML.load(
                            response.data
                        ) as ParsedYamlData;
                        setParsedYamlData(parsed);

                        const genes = Object.keys(parsed || {});
                        setGeneOptions(
                            genes.map((gene) => ({
                                value: gene,
                                label: gene,
                            }))
                        );

                        const firstGene = genes[0] || "";
                        const firstOligoset = firstGene
                            ? Object.keys(parsed[firstGene] || {}).find((key) =>
                                  key.startsWith("Oligoset")
                              ) || ""
                            : "";

                        setSelectedGene(firstGene);
                        setSelectedOligoset(firstOligoset);
                    } catch (e) {
                        console.error("Error parsing YAML:", e);
                        setParsedYamlData(null);
                    }
                })
                .catch((error) =>
                    console.error("Error fetching padlock file content:", error)
                );

            axios
                .get(
                    BACKEND_URL +
                        `/api/runs/${runId}/files/genomic_regions.yaml`,
                    { withCredentials: true, responseType: "text" }
                )
                .then((response) => {
                    const regions = YAML.load(response.data) as {
                        [key: string]: GenomicRegions;
                    };
                    setGenomicRegions(regions);
                })
                .catch((error) => {
                    console.error(
                        "Error fetching genomic regions file:",
                        error
                    );
                    setGenomicRegions(null);
                    return null;
                });
        },
        [runId]
    );
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

                    const yamlFile = response.data.find(
                        (f: RunFile) =>
                            f.name.includes("probes.yml") ||
                            f.name.includes("probesets.yml")
                    );

                    if (yamlFile) {
                        setPolling(false);
                        if (interval) clearInterval(interval);
                        fetchAndParseRunFiles(yamlFile.name);
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
        const oligos = getOligosForOligoset();
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
                    ...allColumns.map((col) => formatValue(oligo[col])),
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
        if (!parsedYamlData) return;

        const workbook = XLSX.utils.book_new();

        // Iterate through all genes and create a sheet for each
        Object.keys(parsedYamlData).forEach((gene) => {
            // Gather all oligos for this gene
            const geneOligos: { oligoset: string; oligo: Oligo }[] = [];
            const oligosets = getOligosetsForGene(gene);
            oligosets.forEach((oligoset) => {
                const oligosetData = parsedYamlData[gene][oligoset];
                const oligos = Object.entries(oligosetData)
                    .filter(([key]) => /^Oligo \d+$/.test(key))
                    .map(([, value]) => value)
                    .filter(
                        (oligo) => typeof oligo === "object" && oligo !== null
                    ) as Oligo[];
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

            const geneData: (string | OligoValue)[][] = [];
            geneData.push(headers);
            geneOligos.forEach((item) => {
                const row = [
                    item.oligoset,
                    ...allColumns.map((col) =>
                        formatValueForExcel(item.oligo[col])
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

    const formatValueForExcel = (
        value: OligoValue
    ): string | number | boolean => {
        // Handle deeply nested arrays
        const flatten = (
            arr: OligoValue[],
            acc: (string | number | boolean)[] = []
        ): (string | number | boolean)[] => {
            let result: (string | number | boolean)[] = [...acc];
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
        return value ?? ""; // Return raw value for Excel (null -> empty string)
    };

    const viewFileContent = (filename: string, shouldParseYaml = true) => {
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

                // Only parse YAML if explicitly requested
                if (
                    shouldParseYaml &&
                    (filename.endsWith(".yml") || filename.endsWith(".yaml"))
                ) {
                    try {
                        const parsed = YAML.load(
                            response.data
                        ) as ParsedYamlData;
                        setParsedYamlData(parsed);

                        const genes = Object.keys(parsed || {});
                        setGeneOptions(
                            genes.map((gene) => ({
                                value: gene,
                                label: gene,
                            }))
                        );

                        const firstGene = genes[0] || "";
                        const firstOligoset = firstGene
                            ? Object.keys(parsed[firstGene] || {}).find((key) =>
                                  key.startsWith("Oligoset")
                              ) || ""
                            : "";

                        setSelectedGene(firstGene);
                        setSelectedOligoset(firstOligoset);
                    } catch (e) {
                        console.error("Error parsing YAML:", e);
                        setParsedYamlData(null);
                    }
                }
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

    const getOligosetsForGene = (gene: string): string[] => {
        if (!parsedYamlData || !parsedYamlData[gene]) return [];
        return Object.keys(parsedYamlData[gene]).filter((key) =>
            key.startsWith("Oligoset")
        );
    };

    const getOligosForOligoset = (): Oligo[] => {
        if (!selectedGene || !selectedOligoset || !parsedYamlData) return [];

        const oligoset = parsedYamlData[selectedGene][selectedOligoset];

        return Object.entries(oligoset)
            .filter(([key]) => /^Oligo \d+$/.test(key)) // Strict match for "Oligo X"
            .map(([, value]) => value)
            .filter(
                (oligo) => typeof oligo === "object" && oligo !== null
            ) as Oligo[];
    };

    const oligos = getOligosForOligoset();

    const formatValue = (value: OligoValue): string => {
        return String(formatValueForExcel(value));
    };

    return (
        <div>
            <Navbar />
            <div className="container mt-4">
                <FeedbackButton
                    floating
                    context={{ page: "run-detail", runId }}
                />
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <button
                        onClick={() => {
                            const fromAdmin = (location.state as LocationState)
                                ?.fromAdmin;
                            navigate(fromAdmin ? "/admin/pipelines" : "/runs");
                        }}
                        className="btn btn-outline-secondary"
                    >
                        ← Back to{" "}
                        {(location.state as LocationState)?.fromAdmin
                            ? "Admin Panel"
                            : "Runs"}
                    </button>
                    <button className="btn btn-danger" onClick={handleDelete}>
                        Delete Run
                    </button>
                </div>

                <h3>Run Files</h3>
                <div className="list-group mb-4">
                    {files
                        .filter((file) =>
                            file.name.toLowerCase().includes("log")
                        )
                        .map((file) => (
                            <div
                                key={file.name}
                                className="list-group-item d-flex justify-content-between align-items-center"
                            >
                                <div>
                                    {file.name}
                                    <span className="badge bg-secondary ms-2">
                                        {Math.round(file.size / 1024)} KB
                                    </span>
                                </div>
                                <div>
                                    {file.name.endsWith(".txt") && (
                                        <button
                                            className="btn btn-sm btn-outline-primary me-2"
                                            onClick={() =>
                                                viewFileContent(file.name)
                                            }
                                        >
                                            View
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-sm btn-outline-success"
                                        onClick={() => downloadFile(file.name)}
                                    >
                                        Download
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>

                {fileContent && viewingFilename && (
                    <div className="mt-4">
                        {fileContent &&
                            viewingFilename &&
                            viewingFilename.endsWith(".txt") && (
                                <div className="mt-4">
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
                                </div>
                            )}
                    </div>
                )}

                {/* Polling/waiting for YAML/log */}
                {(runState == "pending" || runState == "started") && (
                    <div className="alert alert-info">
                        Run is {runState == "pending" ? "pending" : "executing"}
                        ...
                        <span className="spinner-border spinner-border-sm ms-2" />
                    </div>
                )}

                {/* YAML/table logic remains unchanged below */}
                {parsedYamlData && (
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h4 className="card-title mb-0">
                                    Gene Analysis
                                </h4>
                                <div className="btn-group">
                                    <button
                                        onClick={handleDownloadExcel}
                                        className="btn btn-success"
                                        title="Download Excel file with each gene as a separate sheet"
                                    >
                                        Download All Genes Excel
                                    </button>
                                </div>
                            </div>

                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <label className="form-label">
                                        Select Gene
                                    </label>
                                    <Select
                                        options={geneOptions}
                                        value={geneOptions.find(
                                            (option) =>
                                                option.value === selectedGene
                                        )}
                                        onChange={(
                                            newValue: SingleValue<GeneOption>
                                        ) => {
                                            setSelectedGene(
                                                newValue?.value || ""
                                            );
                                            setSelectedOligoset("Oligoset 1");
                                        }}
                                        placeholder="Search or select gene..."
                                        isSearchable
                                        className="basic-single"
                                        classNamePrefix="select"
                                    />
                                </div>

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
                                                setSelectedOligo(0);
                                            }}
                                        >
                                            <option value="">
                                                Select an Oligoset
                                            </option>
                                            {getOligosetsForGene(
                                                selectedGene
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
                            </div>

                            {selectedOligoset && (
                                <div className="mt-3">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <h5>Oligos in {selectedOligoset}</h5>
                                        <div>
                                            <span className="form-text me-2">
                                                Showing{" "}
                                                {getOligosForOligoset().length}{" "}
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
                                            oligos={getOligosForOligoset()}
                                            pipeline={pipeline}
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
                                                {getOligosForOligoset().map(
                                                    (oligo, index) => (
                                                        <tr
                                                            key={oligo.oligo_id}
                                                        >
                                                            {tableColumns.map(
                                                                (column) => (
                                                                    <td
                                                                        key={`${oligo.oligo_id}-${column}`}
                                                                        className={
                                                                            "text-nowrap " +
                                                                            (index ===
                                                                            selectedOligo
                                                                                ? "table-primary"
                                                                                : "")
                                                                        }
                                                                        onClick={() =>
                                                                            setSelectedOligo(
                                                                                index
                                                                            )
                                                                        }
                                                                    >
                                                                        {column ===
                                                                        "location"
                                                                            ? `chr${oligo.chromosome}:${oligo.start}-${oligo.end}`
                                                                            : formatValue(
                                                                                  oligo[
                                                                                      column
                                                                                  ]
                                                                              )}
                                                                    </td>
                                                                )
                                                            )}
                                                        </tr>
                                                    )
                                                )}
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
                                                            {formatValue(
                                                                oligos[0]
                                                                    ?.source ??
                                                                    null
                                                            ) || "N/A"}
                                                            <br />
                                                            <strong>
                                                                Species:
                                                            </strong>{" "}
                                                            {formatValue(
                                                                oligos[0]
                                                                    ?.species ??
                                                                    null
                                                            ) || "N/A"}
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RunDetail;
