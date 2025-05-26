import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import YAML from 'js-yaml';
import Select, { SingleValue } from 'react-select';
import { useAuth } from '../modules/auth';
import Navbar from "../modules/nav";

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
    const closeFileView = () => {
        setViewingFilename(null);
    };
    const [parsedYamlFilename, setParsedYamlFilename] = useState<string | null>(null);

    useEffect(() => {

            axios.get(`http://localhost:5000/api/runs/${runId}/files`, {
                withCredentials: true
            })
                .then(response => setFiles(response.data))
                .catch(error => console.error('Error fetching files:', error));

    }, []);

    // Auto-view padlock_probes.yml.yml if present and not already viewing
    useEffect(() => {
        if (user && runId) {
            axios.get(`http://localhost:5000/api/runs/${runId}/files`, {
                withCredentials: true
            })
                .then(response => {
                    setFiles(response.data);
                    const padlockFile = response.data.find((f: RunFile) => f.name === 'padlock_probes.yml.yml');
                    if (padlockFile) {
                        viewFileContent(padlockFile.name);
                    }
                })
                .catch(error => console.error('Error fetching files:', error));
        }
    }, [user, runId]);

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

        // Process headers and rows
        const headers = tableColumns.map(col => `"${col.replace(/_/g, ' ')}"`).join(',');
        const rows = oligos.map(oligo => {
            return tableColumns.map(col => {
                const value = formatValue(oligo[col]);
                // Handle commas and quotes in values
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',');
        }).join('\n');

        // Create CSV content
        const csvContent = `${headers}\n${rows}`;

        // Trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${selectedGene}_${selectedOligoset}_oligos.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const viewFileContent = (filename: string) => {
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

                if (filename.endsWith('.yml') || filename.endsWith('.yaml')) {
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
                        // @ts-ignore
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
            .filter(([key]) => /^Oligo \d+$/.test(key)) // Strict match for "Oligo X"
            .map(([, value]) => value)
            .filter(oligo => typeof oligo === 'object' && oligo !== null) as Oligo[];
    };

    const formatValue = (value: any): string => {
        // Handle deeply nested arrays
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
                {files.map(file => (
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

            {fileContent && viewingFilename && (
                <div className="mt-4">
                    {fileContent && viewingFilename && viewingFilename.endsWith('.txt') && (
                        <div className="mt-4">
                            <h4>Viewing: {viewingFilename}</h4>

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
                        <h4 className="card-title">Gene Analysis</h4>
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
                                            Download CSV
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