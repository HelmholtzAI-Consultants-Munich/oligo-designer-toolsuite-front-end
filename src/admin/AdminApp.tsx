import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { Spinner } from "react-bootstrap";
import Dashboard from "./dashboard/Dashboard";
import UserList from "./users/UserList";
import UserEdit from "./users/UserEdit";
import PipelineList from "./pipelines/PipelineList";
import FeedbackList from "./feedback/FeedbackList";
import MonthlyReports from "./reports/MonthlyReports";
import { useAuth } from "../hooks/useAuth";

const AdminApp: React.FC = () => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
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
        </Routes>
    );
};

export default AdminApp;
