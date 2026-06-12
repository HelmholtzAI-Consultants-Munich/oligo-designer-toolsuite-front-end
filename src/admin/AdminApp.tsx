import React, { useEffect } from "react";
import {
    Routes,
    Route,
    Navigate,
    useLocation,
    useNavigate,
} from "react-router";
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
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            navigate(
                `/login?redirect=${encodeURIComponent(location.pathname)}`,
                { replace: true }
            );
        } else if (user.role !== "admin") {
            navigate("/", { replace: true });
        }
    }, [loading, location.pathname, navigate, user]);

    if (loading) {
        return (
            <Vertical align="center" justify="center" className="p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Vertical>
        );
    }

    if (!user || user.role !== "admin") return null;

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
