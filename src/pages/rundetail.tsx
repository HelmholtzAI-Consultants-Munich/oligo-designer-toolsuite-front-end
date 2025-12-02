import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import YAML from "js-yaml";
import Select from "react-select";
import type { SingleValue } from "react-select";
import { useAuth } from "../modules/auth";
import Navbar from "../modules/nav";
import * as XLSX from "xlsx";
import OligoAlignment from "../components/visualization/OligoAlignment";


interface RunFile {
    name: string;
    type: "log" | "config";
    size: number;
}

export interface Oligo {
    oligo_id: string;
    [key: string]: any;
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

const RunDetail = () => {
    const { runId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [files, setFiles] = useState<RunFile[]>([]);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);
    const [pipeline, setPipeline] = useState<string>("");
    const [oligoIndex, setOligoIndex] = useState(0);

    const [parsedYamlData, setParsedYamlData] = useState<any>(null);
    const [selectedGene, setSelectedGene] = useState<string>("");
    const [selectedOligoset, setSelectedOligoset] = useState<string>("");
    const [geneOptions, setGeneOptions] = useState<GeneOption[]>([]);
    const [tableColumns] = useState<string[]>([
        "oligo_id",
        "chromosome",
        "start",
        "end",
        "source",
        "species",
        "length",
        "Tm_arm1",
        "Tm_arm2",
    ]);
    const closeFileView = () => {
        setViewingFilename(null);
    };
    const [parsedYamlFilename, setParsedYamlFilename] = useState<string | null>(
        null
    );
    // --- Polling/log state variables ---
    const [hasYamlFile, setHasYamlFile] = useState(false);
    const [hasLogFile, setHasLogFile] = useState(false);
    const [logFilename, setLogFilename] = useState<string | null>(null);
    const [logContent, setLogContent] = useState<string | null>(null);
    const [polling, setPolling] = useState(true);
    const fetchAndParsePadlockFile = useCallback(
        (filename: string) => {
            axios
                .get(
                    `http://localhost:5000/api/runs/${runId}/files/${filename}`,
                    {
                        withCredentials: true,
                        responseType: "text",
                    }
                )
                .then((response) => {
                    try {
                        const parsed = YAML.load(response.data) as Record<
                            string,
                            any
                        >;
                        setParsedYamlData(parsed);
                        setParsedYamlFilename(filename);

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
                        setParsedYamlFilename(null);
                    }
                })
                .catch((error) =>
                    console.error("Error fetching padlock file content:", error)
                );
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
                    `http://localhost:5000/api/runs/${runId}/files`,
                    {
                        withCredentials: true,
                    }
                );
                setFiles(response.data);

                const runResponse = await axios.get(
                    `http://localhost:5000/api/runs/${runId}`, {
                        withCredentials: true,
                    }
                );
                setPipeline(runResponse.data.pipeline || "");

                // YAML check
                const yamlFile = response.data.find(
                    (f: RunFile) =>
                        f.name.endsWith(".yml") || f.name.endsWith(".yaml")
                );
                setHasYamlFile(!!yamlFile);

                // Log check
                const firstLog = response.data.find(
                    (f: RunFile) => f.type === "log"
                );
                setHasLogFile(!!firstLog);
                setLogFilename(firstLog?.name || null);

                // If YAML present, stop polling!
                if (yamlFile) {
                    setPolling(false);
                    if (interval) clearInterval(interval);
                    // Fetch and parse YAML as before
                    fetchAndParsePadlockFile(yamlFile.name);
                } else if (firstLog) {
                    // If log file is present, get its content
                    const logResp = await axios.get(
                        `http://localhost:5000/api/runs/${runId}/files/${firstLog.name}`,
                        { withCredentials: true, responseType: "text" }
                    );
                    setLogContent(logResp.data);
                }
            } catch (e) {
                console.error(e);
            }
        };

        if (polling) {
            interval = setInterval(poll, 1000);
            poll(); // initial
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [runId, polling, fetchAndParsePadlockFile]);

    const handleDelete = async () => {
        if (
            window.confirm(
                "Are you sure you want to delete this run? This action cannot be undone."
            )
        ) {
            try {
                await axios.delete(`http://localhost:5000/api/runs/${runId}`, {
                    withCredentials: true,
                });
                navigate("/runs");
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

    // Download CSV for all genes and oligosets
    const handleDownloadAllCSV = () => {
        if (!parsedYamlData) return;

        // Gather all oligos
        const allOligos: { gene: string; oligoset: string; oligo: Oligo }[] =
            [];
        Object.keys(parsedYamlData).forEach((gene) => {
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
                    allOligos.push({ gene, oligoset, oligo });
                });
            });
        });

        const allColumns = getAllOligoColumns(
            allOligos.map((item) => item.oligo)
        );
        const headers = ["Gene", "Oligoset", ...allColumns]
            .map((col) => `"${col.replace(/_/g, " ")}"`)
            .join(",");

        const allRows: string[] = [];
        allOligos.forEach((item) => {
            const rowData = [
                item.gene,
                item.oligoset,
                ...allColumns.map((col) => formatValue(item.oligo[col])),
            ];
            const row = rowData
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
            allRows.push(row);
        });

        const csvContent = `${headers}\n${allRows.join("\n")}`;

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `all_genes_oligos.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Download CSV for selected gene (all oligosets)
    const handleDownloadGeneCSV = () => {
        if (!selectedGene || !parsedYamlData) return;

        // Gather all oligos for the selected gene
        const geneOligos: { oligoset: string; oligo: Oligo }[] = [];
        const oligosets = getOligosetsForGene(selectedGene);
        oligosets.forEach((oligoset) => {
            const oligosetData = parsedYamlData[selectedGene][oligoset];
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
        const headers = ["Gene", "Oligoset", ...allColumns]
            .map((col) => `"${col.replace(/_/g, " ")}"`)
            .join(",");

        const geneRows: string[] = [];
        geneOligos.forEach((item) => {
            const rowData = [
                selectedGene,
                item.oligoset,
                ...allColumns.map((col) => formatValue(item.oligo[col])),
            ];
            const row = rowData
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
            geneRows.push(row);
        });

        const csvContent = `${headers}\n${geneRows.join("\n")}`;

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedGene}_all_oligosets.csv`;
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

            const geneData: any[] = [];
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
                .replace(/[\\\/\?\*\[\]]/g, "_")
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

    const formatValueForExcel = (value: any): any => {
        // Handle deeply nested arrays
        const flatten = (arr: any[]): any[] => {
            return arr.reduce(
                (acc, val) =>
                    Array.isArray(val)
                        ? acc.concat(flatten(val))
                        : acc.concat(val),
                []
            );
        };

        if (Array.isArray(value)) {
            return flatten(value).join(", ");
        }
        if (typeof value === "object" && value !== null) {
            return JSON.stringify(value);
        }
        return value; // Return raw value for Excel (no string conversion)
    };

    const viewFileContent = (filename: string, shouldParseYaml = true) => {
        if (viewingFilename === filename) {
            closeFileView();
            return;
        }

        axios
            .get(`http://localhost:5000/api/runs/${runId}/files/${filename}`, {
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
                        const parsed = YAML.load(response.data) as Record<
                            string,
                            any
                        >;
                        setParsedYamlData(parsed);
                        setParsedYamlFilename(filename);

                        const genes = Object.keys(parsed || {});
                        setGeneOptions(
                            genes.map((gene) => ({
                                value: gene,
                                label: gene,
                            }))
                        );

                        const firstGene = genes[0] || "";
                        // @ts-ignore
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
                        setParsedYamlFilename(null);
                    }
                }
            })
            .catch((error) =>
                console.error("Error fetching file content:", error)
            );
    };

    const downloadFile = (filename: string) => {
        window.open(
            `http://localhost:5000/api/runs/${runId}/files/${filename}`,
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

    const formatValue = (value: any): string => {
        // Handle deeply nested arrays
        const flatten = (arr: any[]): any[] => {
            return arr.reduce(
                (acc, val) =>
                    Array.isArray(val)
                        ? acc.concat(flatten(val))
                        : acc.concat(val),
                []
            );
        };

        if (Array.isArray(value)) {
            return flatten(value).join(", ");
        }
        if (typeof value === "object" && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    };

    return (
        <div>
            <Navbar />
            <div className="container mt-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <Link to="/runs" className="btn btn-outline-secondary">
                        ← Back to Runs
                    </Link>
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
                {!hasYamlFile && (
                    <>
                        {!hasLogFile && (
                            <div className="alert alert-info">
                                Waiting for log file...{" "}
                                <span className="spinner-border spinner-border-sm ms-2" />
                            </div>
                        )}
                        {hasLogFile && logContent && (
                            <div className="mt-4">
                                <h4>Live Log</h4>
                                <pre
                                    className="bg-light p-3 rounded mb-4"
                                    style={{
                                        maxHeight: "500px",
                                        overflow: "auto",
                                    }}
                                >
                                    {logContent}
                                </pre>
                            </div>
                        )}
                    </>
                )}

                {/* YAML/table logic remains unchanged below */}
                {parsedYamlData &&
                    parsedYamlFilename === "padlock_probes.yml.yml" && (
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
                                                    option.value ===
                                                    selectedGene
                                            )}
                                            onChange={(
                                                newValue: SingleValue<GeneOption>
                                            ) => {
                                                setSelectedGene(
                                                    newValue?.value || ""
                                                );
                                                setSelectedOligoset(
                                                    "Oligoset 1"
                                                );
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
                                                        setOligoIndex(0);
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
                                            <h5>
                                                Oligos in {selectedOligoset}
                                            </h5>
                                            <div>
                                                <span className="form-text me-2">
                                                    Showing{" "}
                                                    {
                                                        getOligosForOligoset()
                                                            .length
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
                                            <label className="form-label" htmlFor="oligoSelect">
                                                Select Oligo
                                            </label>
                                            <select id="oligoSelect" className="form-select" value={oligoIndex} onChange={(e) => setOligoIndex(parseInt(e.target.value))}>
                                                {getOligosForOligoset().map((_, index) => 
                                                    <option key={index} value={index}>Oligo {index + 1}</option>
                                                )}
                                            </select>
                                            <OligoAlignment
                                                oligos={getOligosForOligoset()}
                                                pipeline={pipeline}
                                                oligoIndex={oligoIndex}
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
                                                                key={
                                                                    oligo.oligo_id
                                                                }
                                                            >
                                                                {tableColumns.map(
                                                                    (
                                                                        column
                                                                    ) => (
                                                                        <td
                                                                            key={`${oligo.oligo_id}-${column}`}
                                                                            className={"text-nowrap " + (index === oligoIndex ? "table-primary" : "")}
                                                                            onClick={() => setOligoIndex(index)}
                                                                        >
                                                                            {formatValue(
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
