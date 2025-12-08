import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Spinner, Alert, Button, Row, Col } from 'react-bootstrap';
import { People, PersonBadge, Person, Folder2, Clock, CheckCircle, XCircle, PlayCircle } from 'react-bootstrap-icons';

interface DashboardStats {
    users: {
        total: number;
        admin: number;
        regular: number;
    };
    pipeline_runs: {
        total: number;
        by_status: {
            pending: number;
            started: number;
            completed: number;
            error: number;
        };
    };
}

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axios.get('http://localhost:5000/api/admin/dashboard', {
                withCredentials: true,
            });
            setStats(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load dashboard statistics');
            console.error('Error fetching dashboard stats:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="d-flex justify-content-center align-items-center p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container-fluid p-4">
                <Alert variant="danger">
                    <Alert.Heading>Error loading dashboard</Alert.Heading>
                    <p>{error}</p>
                    <Button variant="primary" onClick={fetchStats}>
                        Retry
                    </Button>
                </Alert>
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    const statusIcons = {
        pending: Clock,
        started: PlayCircle,
        completed: CheckCircle,
        error: XCircle,
    };

    const statusColors = {
        pending: 'warning',
        started: 'info',
        completed: 'success',
        error: 'danger',
    };

    const statusLabels = {
        pending: 'Pending',
        started: 'Started',
        completed: 'Completed',
        error: 'Error',
    };

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Dashboard</h2>
                <Button variant="outline-primary" onClick={fetchStats}>
                    Refresh
                </Button>
            </div>

            {/* User Statistics */}
            <Row className="mb-4">
                <Col md={12}>
                    <h4 className="mb-3">User Statistics</h4>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="h-100">
                        <Card.Body>
                            <div className="d-flex align-items-center mb-2">
                                <People size={32} className="text-primary me-3" />
                                <div>
                                    <Card.Title className="mb-0">Total Users</Card.Title>
                                </div>
                            </div>
                            <div className="display-4 fw-bold text-primary">
                                {stats.users.total}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="h-100">
                        <Card.Body>
                            <div className="d-flex align-items-center mb-2">
                                <PersonBadge size={32} className="text-danger me-3" />
                                <div>
                                    <Card.Title className="mb-0">Admin Users</Card.Title>
                                </div>
                            </div>
                            <div className="display-4 fw-bold text-danger">
                                {stats.users.admin}
                            </div>
                            {stats.users.total > 0 && (
                                <small className="text-muted">
                                    {((stats.users.admin / stats.users.total) * 100).toFixed(1)}% of total
                                </small>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="h-100">
                        <Card.Body>
                            <div className="d-flex align-items-center mb-2">
                                <Person size={32} className="text-success me-3" />
                                <div>
                                    <Card.Title className="mb-0">Regular Users</Card.Title>
                                </div>
                            </div>
                            <div className="display-4 fw-bold text-success">
                                {stats.users.regular}
                            </div>
                            {stats.users.total > 0 && (
                                <small className="text-muted">
                                    {((stats.users.regular / stats.users.total) * 100).toFixed(1)}% of total
                                </small>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Pipeline Run Statistics */}
            <Row>
                <Col md={12}>
                    <h4 className="mb-3">Pipeline Run Statistics</h4>
                </Col>
                <Col md={3} className="mb-3">
                    <Card className="h-100">
                        <Card.Body>
                            <div className="d-flex align-items-center mb-2">
                                <Folder2 size={32} className="text-secondary me-3" />
                                <div>
                                    <Card.Title className="mb-0">Total Runs</Card.Title>
                                </div>
                            </div>
                            <div className="display-4 fw-bold text-secondary">
                                {stats.pipeline_runs.total}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                {Object.entries(stats.pipeline_runs.by_status).map(([status, count]) => {
                    const Icon = statusIcons[status as keyof typeof statusIcons];
                    const color = statusColors[status as keyof typeof statusColors];
                    const label = statusLabels[status as keyof typeof statusLabels];
                    
                    return (
                        <Col md={3} key={status} className="mb-3">
                            <Card className={`h-100 border-${color}`}>
                                <Card.Body>
                                    <div className="d-flex align-items-center mb-2">
                                        <Icon size={32} className={`text-${color} me-3`} />
                                        <div>
                                            <Card.Title className="mb-0">{label}</Card.Title>
                                        </div>
                                    </div>
                                    <div className={`display-4 fw-bold text-${color}`}>
                                        {count}
                                    </div>
                                    {stats.pipeline_runs.total > 0 && (
                                        <small className="text-muted">
                                            {((count / stats.pipeline_runs.total) * 100).toFixed(1)}% of total
                                        </small>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </div>
    );
};

export default Dashboard;

