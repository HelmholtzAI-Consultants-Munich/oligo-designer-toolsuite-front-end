import React from "react";
import { Routes, Route, Navigate } from "react-router";
import AdminLayout from "./AdminLayout";
import Dashboard from "./dashboard/Dashboard";
import UserList from "./users/UserList";
import UserEdit from "./users/UserEdit";
import PipelineList from "./pipelines/PipelineList";
import FeedbackList from "./feedback/FeedbackList";

const AdminApp: React.FC = () => {
    return (
        <AdminLayout>
            <Routes>
                <Route
                    index
                    element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="users" element={<UserList />} />
                <Route path="users/:id/edit" element={<UserEdit />} />
                <Route path="pipelines" element={<PipelineList />} />
                <Route path="feedback" element={<FeedbackList />} />
            </Routes>
        </AdminLayout>
    );
};

export default AdminApp;
