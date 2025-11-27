import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import UserList from './users/UserList';
import UserEdit from './users/UserEdit';

const AdminApp: React.FC = () => {
    return (
        <AdminLayout>
            <Routes>
                <Route index element={<Navigate to="/admin/users" replace />} />
                <Route path="users" element={<UserList />} />
                <Route path="users/:id/edit" element={<UserEdit />} />
            </Routes>
        </AdminLayout>
    );
};

export default AdminApp;

