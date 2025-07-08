import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import YAML from 'js-yaml';
import Select, { SingleValue } from 'react-select';
import { useAuth } from '../modules/auth';
import Navbar from "../modules/nav";
import * as XLSX from 'xlsx';

interface RunFile {
    name: string;
    type: 'log' | 'config';
    size: number;
}

interface Oligo {
    oligo_id: string;
    [key: string]: any;
}

interface GeneOption {
    value: string;
    label: string;
}

const RunDetail = () => {
    const { runId } = useParams();
    const { user } = useAuth();
    const [hasLogFile, setHasLogFile] = useState<boolean>(false);
    const navigate = useNavigate();
    const [files, setFiles] = useState<RunFile[]>([]);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [viewingFilename, setViewingFilename] = useState<string | null>(null);

    const [parsedYamlData, setParsedYamlData] = useState<any>(null);
    const [selectedGene, setSelectedGene] = useState<string>('');
    const [selectedOligoset, setSelectedOligoset] = useState<string>('');
    const [geneOptions, setGeneOptions] = useState<GeneOption[]>([]);
    const [tableColumns] = useState<string[]>([
        'oligo_id',
        'chromosome',
        'start',
        'end',
        'source',
        'species',
        'length',
        'Tm_arm1',
        'Tm_arm2'
    ]);
    const [parsedYamlFilename, setParsedYamlFilename] = useState<string | null>(null);

    // --- POLLING LOGIC ---
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isLogFile = (filename: string) =>
        filename.toLowerCase().endsWith('.log') || filename.toLowerCase().includes('log');

    // --- POLLING EFFECT: fetch log file every 5s if open ---
    useEffect(() => {
         if (!hasLogFile) {
    const pollLogFile = () => {
      axios.get(`http://localhost:5000/api/runs/${runId}/files`, { withCredentials: true })
        .then(response => {
          // Find log file in response
          const logFile = response.data.find(
            (f: RunFile) => f.type === 'log' || f.name.toLowerCase().endsWith('.log')
          );
          const fnaFile = response.data.find(
  (f: RunFile) =>
    f.name.toLowerCase().endsWith('.fna') ||
    f.name.toLowerCase().endsWith('.fasta')
);

    if (fnaFile) {
      // Stop viewing the log file and show table (i.e. parsedYamlData or other)
      closeFileView(); // <-- This closes the log view and clears interval
      setFiles(response.data); // Still update file list
      setHasLogFile(false);    // Optionally reset if you want to allow re-polling
    } else if (logFile) {
      setHasLogFile(true);
      setFiles(response.data);
      viewFileContent(logFile.name, false);
    }
        })
        .catch(() => { /* handle error if needed */ });
    };
    pollLogFile(); // Initial poll
    const interval = setInterval(pollLogFile, 1000);
    return () => clearInterval(interval);
  }
        if (viewingFilename && isLogFile(viewingFilename)) {
            const fetchLog = () => {
                axios.get(`http://localhost:5000/api/runs/${runId}/files/${viewingFilename}`, {
                    withCredentials: true,
                    responseType: 'text'
                })
                .then(response => setFileContent(response.data))
                .catch(error => console.error('Error polling log file:', error));
            };
            fetchLog();
            pollingIntervalRef.current = setInterval(fetchLog, 1000);
            return () => {
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            };
        }
        // Cleanup interval if not viewing log file
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, [viewingFilename, runId,hasLogFile]);
    // ----------------------

    const closeFileView = () => {
        setViewingFilename(null);
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }
    };

    const fetchAndParsePadlockFile = useCallback((filename: string) => {
        axios.get(`http://localhost:5000/api/runs/${runId}/files/${filename}`, {
            withCredentials: true,
            responseType: 'text'
        })
        .then(response => {
            try {
                const parsed = YAML.load(response.data) as Record<string, any>;
                setParsedYamlData(parsed);
                setParsedYamlFilename(filename);

                const genes = Object.keys(parsed || {});
                setGeneOptions(genes.map(gene => ({
                    value: gene,
                    label: gene
                })));

                const firstGene = genes[0] || '';
                const firstOligoset = firstGene
                    ? Object.keys(parsed[firstGene] || {}).find(key => key.startsWith('Oligoset')) || ''
                    : '';

                setSelectedGene(firstGene);
                setSelectedOligoset(firstOligoset);
            } catch (e) {
                console.error('Error parsing YAML:', e);
                setParsedYamlData(null);
                setParsedYamlFilename(null);
            }
        })
        .catch(error => console.error('Error fetching padlock file content:', error));
    }, [runId]);

    useEffect(() => {
        if (runId) {
            axios.get(`http://localhost:5000/api/runs/${runId}/files`, {
                withCredentials: true
            })
            .then(response => {
                setFiles(response.data);

                const yamlFile = response.data.find((f: RunFile) =>
                    f.name.endsWith('.yml') || f.name.endsWith('.yaml')
                );

                if (yamlFile) {
                    fetchAndParsePadlockFile(yamlFile.name);
                } else {
                    const firstLogFile = response.data.find((f: RunFile) => f.type === 'log');
                    if (firstLogFile) {
                        viewFileContent(firstLogFile.name, false);
                    }
                }
            })
            .catch(error => console.error('Error fetching files:', error));
        }
    }, [runId, fetchAndParsePadlockFile]);

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this run? This action cannot be undone.')) {
            try {
                await axios.delete(`http://localhost:5000/api/runs/${runId}`, {
                    withCredentials: true
                });
                navigate('/runs');
            } catch (error) {
                console.error('Error deleting run:', error);
                alert('Failed to delete run');
            }
        }
    };

    const handleDownloadCSV = () => {
        const oligos = getOligosForOligoset();
        if (oligos.length === 0) return;

        const headers = ['Gene', 'Oligoset', ...tableColumns]
            .map(col => `"${col.replace(/_/g, ' ')}"`)
            .join(',');

        const rows = oligos.map(oligo => {
            const rowData = [
                selectedGene,
                selectedOligoset,
                ...tableColumns.map(col => formatValue(oligo[col]))
            ];

            return rowData.map(value => {
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        }).join('\n');

        const csvContent = `${headers}\n${rows}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedGene}_${selectedOligoset}_oligos.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAllCSV = () => {
        if (!parsedYamlData) return;

        const headers = ['Gene', 'Oligoset', ...tableColumns]
            .map(col => `"${col.replace(/_/g, ' ')}"`)
            .join(',');

        const allRows: string[] = [];
        Object.keys(parsedYamlData).forEach(gene => {
            const oligosets = getOligosetsForGene(gene);
            oligosets.forEach(oligoset => {
                const oligosetData = parsedYamlData[gene][oligoset];
                const oligos = Object.entries(oligosetData)
                    .filter(([key]) => /^Oligo \d+$/.test(key))
                    .map(([, value]) => value)
                    .filter(oligo => typeof oligo === 'object' && oligo !== null) as Oligo[];

                oligos.forEach(oligo => {
                    const rowData = [
                        gene,
                        oligoset,
                        ...tableColumns.map(col => formatValue(oligo[col]))
                    ];

                    const row = rowData.map(value => {
                        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                            return `"${value.replace(/"/g, '""')}"`;
                        }
                        return value;
                    }).join(',');

                    allRows.push(row);
                });
            });
        });

        const csvContent = `${headers}\n${allRows.join('\n')}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `all_genes_oligos.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadGeneCSV = () => {
        if (!selectedGene || !parsedYamlData) return;

        const headers = ['Gene', 'Oligoset', ...tableColumns]
            .map(col => `"${col.replace(/_/g, ' ')}"`)
            .join(',');

        const geneRows: string[] = [];
        const oligosets = getOligosetsForGene(selectedGene);

        oligosets.forEach(oligoset => {
            const oligosetData = parsedYamlData[selectedGene][oligoset];
            const oligos = Object.entries(oligosetData)
                .filter(([key]) => /^Oligo \d+$/.test(key))
                .map(([, value]) => value)
                .filter(oligo => typeof oligo === 'object' && oligo !== null) as Oligo[];

            oligos.forEach(oligo => {
                const rowData = [
                    selectedGene,
                    oligoset,
                    ...tableColumns.map(col => formatValue(oligo[col]))
                ];

                const row = rowData.map(value => {
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',');

                geneRows.push(row);
            });
        });

        const csvContent = `${headers}\n${geneRows.join('\n')}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedGene}_all_oligosets.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadExcel = () => {
        if (!parsedYamlData) return;

        const workbook = XLSX.utils.book_new();
        const headers = ['Oligoset', ...tableColumns.map(col => col.replace(/_/g, ' '))];

        Object.keys(parsedYamlData).forEach(gene => {
            const geneData: any[] = [];
            geneData.push(headers);

            const oligosets = getOligosetsForGene(gene);
            oligosets.forEach(oligoset => {
                const oligosetData = parsedYamlData[gene][oligoset];
                const oligos = Object.entries(oligosetData)
                    .filter(([key]) => /^Oligo \d+$/.test(key))
                    .map(([, value]) => value)
                    .filter(oligo => typeof oligo === 'object' && oligo !== null) as Oligo[];

                oligos.forEach(oligo => {
                    const row = [
                        oligoset,
                        ...tableColumns.map(col => formatValueForExcel(oligo[col]))
                    ];
                    geneData.push(row);
                });
            });

            const worksheet = XLSX.utils.aoa_to_sheet(geneData);
            const sanitizedGeneName = gene.replace(/[\\\/\?\*\[\]]/g, '_').substring(0, 31);
            XLSX.utils.book_append_sheet(workbook, worksheet, sanitizedGeneName);
        });

        XLSX.writeFile(workbook, 'all_genes_oligos.xlsx');
    };

    const formatValueForExcel = (value: any): any => {
        const flatten = (arr: any[]): any[] => {
            return arr.reduce((acc, val) =>
                Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val),
                []);
        };

        if (Array.isArray(value)) {
            return flatten(value).join(', ');
        }
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return value;
    };

    const viewFileContent = (filename: string, shouldParseYaml = true) => {
        if (viewingFilename === filename) {
            closeFileView();
            return;
        }

        axios.get(`http://localhost:5000/api/runs/${runId}/files/${filename}`, {
            withCredentials: true,
            responseType: 'text'
        })
        .then(response => {
            setViewingFilename(filename);
            setFileContent(response.data);

            if (shouldParseYaml && (filename.endsWith('.yml') || filename.endsWith('.yaml')) ){
                try {
                    const parsed = YAML.load(response.data) as Record<string, any>;
                    setParsedYamlData(parsed);
                    setParsedYamlFilename(filename);

                    const genes = Object.keys(parsed || {});
                    setGeneOptions(genes.map(gene => ({
                        value: gene,
                        label: gene
                    })));

                    const firstGene = genes[0] || '';
                    const firstOligoset = firstGene
                        ? Object.keys(parsed[firstGene] || {}).find(key => key.startsWith('Oligoset')) || ''
                        : '';

                    setSelectedGene(firstGene);
                    setSelectedOligoset(firstOligoset);
                } catch (e) {
                    console.error('Error parsing YAML:', e);
                    setParsedYamlData(null);
                    setParsedYamlFilename(null);
                }
            }
        })
        .catch(error => console.error('Error fetching file content:', error));
    };

    const downloadFile = (filename: string) => {
        window.open(
            `http://localhost:5000/api/runs/${runId}/files/${filename}`,
            '_blank'
        );
    };

    const getOligosetsForGene = (gene: string): string[] => {
        if (!parsedYamlData || !parsedYamlData[gene]) return [];
        return Object.keys(parsedYamlData[gene]).filter(key => key.startsWith('Oligoset'));
    };

    const getOligosForOligoset = (): Oligo[] => {
        if (!selectedGene || !selectedOligoset || !parsedYamlData) return [];
        const oligoset = parsedYamlData[selectedGene][selectedOligoset];
        return Object.entries(oligoset)
            .filter(([key]) => /^Oligo \d+$/.test(key))
            .map(([, value]) => value)
            .filter(oligo => typeof oligo === 'object' && oligo !== null) as Oligo[];
    };

    const formatValue = (value: any): string => {
        const flatten = (arr: any[]): any[] => {
            return arr.reduce((acc, val) =>
                Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val),
                []);
        };

        if (Array.isArray(value)) {
            return flatten(value).join(', ');
        }
        if (typeof value === 'object' && value !== null) {
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
                    <button
                        className="btn btn-danger"
                        onClick={handleDelete}
                    >
                        Delete Run
                    </button>
                </div>

                <h3>Run Files</h3>
                <div className="list-group mb-4">
                    {files
                        .filter(file => file.name.toLowerCase().includes('log'))
                        .map(file => (
                            <div key={file.name} className="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    {file.name}
                                    <span className="badge bg-secondary ms-2">
                                        {Math.round(file.size / 1024)} KB
                                    </span>
                                </div>
                                <div>
                                    {file.name.endsWith('.txt') && (
                                        <button
                                            className="btn btn-sm btn-outline-primary me-2"
                                            onClick={() => viewFileContent(file.name)}
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
                {!hasLogFile && (
                <div className="alert alert-info">
                    Waiting for log file... <span className="spinner-border spinner-border-sm ms-2" />
                  </div>
                )}

                {fileContent && viewingFilename && (
                    <div className="mt-4">
                        {fileContent && viewingFilename && viewingFilename.endsWith('.txt') && (
                            <div className="mt-4">
                                <h4>Viewing: {viewingFilename}</h4>
                                <button className="btn btn-sm btn-secondary mb-3" onClick={closeFileView}>Close</button>
                                <pre className="bg-light p-3 rounded mb-4" style={{ maxHeight: '500px', overflow: 'auto' }}>
                                    {fileContent}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

                {parsedYamlData && parsedYamlFilename === 'padlock_probes.yml.yml' && (
                    <div className="card">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h4 className="card-title mb-0">Gene Analysis</h4>
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
                                    <label className="form-label">Select Gene</label>
                                    <Select
                                        options={geneOptions}
                                        value={geneOptions.find(option => option.value === selectedGene)}
                                        onChange={(newValue: SingleValue<GeneOption>) => {
                                            setSelectedGene(newValue?.value || '');
                                            setSelectedOligoset('Oligoset 1');
                                        }}
                                        placeholder="Search or select gene..."
                                        isSearchable
                                        className="basic-single"
                                        classNamePrefix="select"
                                    />
                                </div>

                                {selectedGene && (
                                    <div className="col-md-6">
                                        <label className="form-label">Select Oligoset</label>
                                        <select
                                            className="form-select"
                                            value={selectedOligoset}
                                            onChange={(e) => setSelectedOligoset(e.target.value)}
                                        >
                                            <option value="">Select an Oligoset</option>
                                            {getOligosetsForGene(selectedGene).map(oligoset => (
                                                <option key={oligoset} value={oligoset}>{oligoset}</option>
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
                                                Showing {getOligosForOligoset().length} oligos
                                            </span>
                                            <button
                                                onClick={handleDownloadCSV}
                                                className="btn btn-sm btn-primary"
                                            >
                                                Download Oligoset CSV
                                            </button>
                                        </div>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-bordered table-striped table-hover">
                                            <thead className="table-light">
                                                <tr>
                                                    {tableColumns.map(column => (
                                                        <th key={column} className="text-nowrap">
                                                            {column.replace(/_/g, ' ')}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getOligosForOligoset().map(oligo => (
                                                    <tr key={oligo.oligo_id}>
                                                        {tableColumns.map(column => (
                                                            <td key={`${oligo.oligo_id}-${column}`} className="text-nowrap">
                                                                {formatValue(oligo[column])}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
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