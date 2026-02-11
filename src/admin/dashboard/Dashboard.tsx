import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, Spinner, Alert, Button, Row, Col } from "react-bootstrap";
import { People, PersonBadge, Person, Folder2 } from "react-bootstrap-icons";
import type { Icon } from "react-bootstrap-icons";
import { STATUS_CONFIG } from "../shared/types";
import { BACKEND_URL } from "../../config";

/**
 * Calculate percentage with one decimal place
 */
const calculatePercentage = (value: number, total: number): string => {
    if (total === 0) return "0.0";
    return ((value / total) * 100).toFixed(1);
};

interface StatCardProps {
    icon: Icon;
    title: string;
    value: number;
    color: string;
    total?: number;
    showPercentage?: boolean;
    showBorder?: boolean;
}

/**
 * Reusable statistics card component
 */
const StatCard: React.FC<StatCardProps> = ({
    icon: Icon,
    title,
    value,
    color,
    total,
    showPercentage = false,
    showBorder = false,
}) => {
    return (
        <Card className={`h-100 ${showBorder ? `border-${color}` : ""}`}>
            <Card.Body>
                <div className="d-flex align-items-center mb-2">
                    <Icon size={32} className={`text-${color} me-3`} />
                    <div>
                        <Card.Title className="mb-0">{title}</Card.Title>
                    </div>
                </div>
                <div className={`display-4 fw-bold text-${color}`}>{value}</div>
                {showPercentage && total !== undefined && total > 0 && (
                    <small className="text-muted">
                        {calculatePercentage(value, total)}% of total
                    </small>
                )}
            </Card.Body>
        </Card>
    );
};

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
            success: number;
            failure: number;
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
            const response = await axios.get(
                BACKEND_URL + "/api/admin/dashboard",
                {
                    withCredentials: true,
                }
            );
            setStats(response.data);
        } catch (err: any) {
            setError(
                err.response?.data?.error ||
                    "Failed to load dashboard statistics"
            );
            console.error("Error fetching dashboard stats:", err);
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
                    <StatCard
                        icon={People}
                        title="Total Users"
                        value={stats.users.total}
                        color="primary"
                    />
                </Col>
                <Col md={4} className="mb-3">
                    <StatCard
                        icon={PersonBadge}
                        title="Admin Users"
                        value={stats.users.admin}
                        color="danger"
                        total={stats.users.total}
                        showPercentage={true}
                    />
                </Col>
                <Col md={4} className="mb-3">
                    <StatCard
                        icon={Person}
                        title="Regular Users"
                        value={stats.users.regular}
                        color="success"
                        total={stats.users.total}
                        showPercentage={true}
                    />
                </Col>
            </Row>

            {/* Pipeline Run Statistics */}
            <Row>
                <Col md={12}>
                    <h4 className="mb-3">Pipeline Run Statistics</h4>
                </Col>
                <Col md={3} className="mb-3">
                    <StatCard
                        icon={Folder2}
                        title="Total Runs"
                        value={stats.pipeline_runs.total}
                        color="secondary"
                    />
                </Col>
                {Object.entries(stats.pipeline_runs.by_status).map(
                    ([status, count]) => {
                        const Icon =
                            STATUS_CONFIG.icons[
                                status as keyof typeof STATUS_CONFIG.icons
                            ];
                        const color =
                            STATUS_CONFIG.colors[
                                status as keyof typeof STATUS_CONFIG.colors
                            ];
                        const label =
                            STATUS_CONFIG.labels[
                                status as keyof typeof STATUS_CONFIG.labels
                            ];

                        return (
                            <Col md={3} key={status} className="mb-3">
                                <StatCard
                                    icon={Icon}
                                    title={label}
                                    value={count}
                                    color={color}
                                    total={stats.pipeline_runs.total}
                                    showPercentage={true}
                                    showBorder={true}
                                />
                            </Col>
                        );
                    }
                )}
            </Row>
        </div>
    );
};

export default Dashboard;
