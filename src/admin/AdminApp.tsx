import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { Spinner } from "react-bootstrap";
import Dashboard from "./dashboard/Dashboard";
import UserList from "./users/UserList";
import UserEdit from "./users/UserEdit";
import PipelineList from "./pipelines/PipelineList";
import FeedbackList from "./feedback/FeedbackList";
import MonthlyReports from "./reports/MonthlyReports";
import LegalDocuments from "./legal/LegalDocuments";
import { useAuth } from "../hooks/useAuth";
import { Vertical } from "../components/ui/Alignment";

const AdminApp: React.FC = () => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <Vertical align="center" justify="center" className="p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Vertical>
        );
    }

    if (!user) {
        return (
            <Navigate
                to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
                replace
            />
        );
    }

    if (user.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    return (
        <Routes>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<UserList />} />
            <Route path="users/:id/edit" element={<UserEdit />} />
            <Route path="pipelines" element={<PipelineList />} />
            <Route path="feedback" element={<FeedbackList />} />
            <Route path="reports" element={<MonthlyReports />} />
            <Route path="legal" element={<LegalDocuments />} />
        </Routes>
    );
};

export default AdminApp;
