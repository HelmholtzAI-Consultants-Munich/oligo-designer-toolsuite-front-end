// src/pages/RunDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../modules/auth';

interface RunFile {
    name: string;
    type: 'log' | 'config';
    size: number;
}

const RunDetail = () => {
    const { runId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [files, setFiles] = useState<RunFile[]>([]);
    const [logContent, setLogContent] = useState<string | null>(null);

    useEffect(() => {
        if (user && runId) {
            axios.get(`http://localhost:5000/api/runs/${runId}/files`, {
                withCredentials: true
            })
                .then(response => setFiles(response.data))
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

    const viewLog = (filename: string) => {
        axios.get(`http://localhost:5000/api/runs/${runId}/files/${filename}`, {
            withCredentials: true,
            responseType: 'text'
        })
            .then(response => setLogContent(response.data))
            .catch(error => console.error('Error fetching log:', error));
    };

    const downloadFile = (filename: string) => {
        window.open(
            `http://localhost:5000/api/runs/${runId}/files/${filename}`,
            '_blank'
        );
    };

    return (
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
            <div className="list-group">
                {files.map(file => (
                    <div key={file.name} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            {file.name}
                            <span className="badge bg-secondary ms-2">
                                {Math.round(file.size / 1024)} KB
                            </span>
                        </div>
                        <div>
                            {file.type === 'log' && (
                                <button
                                    className="btn btn-sm btn-outline-primary me-2"
                                    onClick={() => viewLog(file.name)}
                                >
                                    View Log
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

            {logContent && (
                <div className="mt-4">
                    <h4>Log Content</h4>
                    <pre className="bg-light p-3 rounded" style={{maxHeight: '500px', overflow: 'auto'}}>
                        {logContent}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default RunDetail;