import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Table, Button, Badge, Spinner, Alert, Form } from 'react-bootstrap';
import { useBulkSelection } from '../shared/useBulkSelection';
import BulkActionToolbar from '../shared/BulkActionToolbar';

interface User {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
    created_at?: string;
}

const UserList: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBulkOperationLoading, setIsBulkOperationLoading] = useState(false);
    
    // Use shared bulk selection hook
    const {
        selectedItems,
        isSelectAll,
        handleSelectItem,
        handleSelectAll,
        clearSelection,
        isSelected,
        selectedCount,
    } = useBulkSelection();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axios.get('http://localhost:5000/api/admin/users', {
                withCredentials: true,
            });
            setUsers(response.data);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load users');
            console.error('Error fetching users:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (userId: string, userEmail: string) => {
        if (window.confirm(`Are you sure you want to delete user ${userEmail}?`)) {
            try {
                await axios.delete(`http://localhost:5000/api/admin/users/${userId}`, {
                    withCredentials: true,
                });
                // Refresh the list
                fetchUsers();
            } catch (err: any) {
                alert(`Failed to delete user: ${err.response?.data?.error || err.message}`);
            }
        }
    };

    const handleBulkDelete = async () => {
        const selectedArray = Array.from(selectedItems);
        if (selectedArray.length === 0) return;

        const confirmed = window.confirm(
            `Are you sure you want to delete ${selectedArray.length} user(s)? This action cannot be undone.`
        );
        
        if (!confirmed) return;

        setIsBulkOperationLoading(true);
        try {
            const response = await axios.post(
                'http://localhost:5000/api/admin/users/bulk-delete',
                { user_ids: selectedArray },
                { withCredentials: true }
            );

            const result = response.data;
            let message = result.message || `Successfully deleted ${result.deleted_count} user(s)`;
            
            if (result.skipped && result.skipped.length > 0) {
                message += `. Skipped ${result.skipped.length} (cannot delete own account)`;
            }

            alert(message);
            clearSelection();
            fetchUsers();
        } catch (err: any) {
            alert(`Failed to delete users: ${err.response?.data?.error || err.message}`);
        } finally {
            setIsBulkOperationLoading(false);
        }
    };

    const handleBulkRoleChange = async (newRole: 'user' | 'admin') => {
        const selectedArray = Array.from(selectedItems);
        if (selectedArray.length === 0) return;

        const roleLabel = newRole === 'admin' ? 'Admin' : 'User';
        const confirmed = window.confirm(
            `Are you sure you want to change role of ${selectedArray.length} user(s) to ${roleLabel}?`
        );
        
        if (!confirmed) return;

        setIsBulkOperationLoading(true);
        try {
            const response = await axios.post(
                'http://localhost:5000/api/admin/users/bulk-update-role',
                { user_ids: selectedArray, role: newRole },
                { withCredentials: true }
            );

            const result = response.data;
            let message = result.message || `Successfully updated role of ${result.updated_count} user(s) to ${newRole}`;
            
            if (result.skipped && result.skipped.length > 0) {
                message += `. Skipped ${result.skipped.length} (cannot demote own admin account)`;
            }

            alert(message);
            clearSelection();
            fetchUsers();
        } catch (err: any) {
            alert(`Failed to update roles: ${err.response?.data?.error || err.message}`);
        } finally {
            setIsBulkOperationLoading(false);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return 'N/A';
        }
    };

    if (isLoading) {
        return (
            <div className="d-flex justify-content-center p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="danger">
                <Alert.Heading>Error loading users</Alert.Heading>
                <p>{error}</p>
                <Button variant="primary" onClick={fetchUsers}>
                    Retry
                </Button>
            </Alert>
        );
    }

    const allUserIds = users.map(user => user.id);
    const allSelected = allUserIds.length > 0 && allUserIds.every(id => selectedItems.has(id));

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>User Management</h2>
            </div>

            {/* Bulk Action Toolbar */}
            <BulkActionToolbar
                selectedCount={selectedCount}
                itemName="users"
                onClearSelection={clearSelection}
                actions={
                    <>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={handleBulkDelete}
                            disabled={isBulkOperationLoading || selectedCount === 0}
                        >
                            Delete Selected
                        </Button>
                        <Form.Select
                            size="sm"
                            style={{ width: 'auto', display: 'inline-block' }}
                            onChange={(e) => {
                                const role = e.target.value as 'user' | 'admin';
                                if (role) {
                                    handleBulkRoleChange(role);
                                    e.target.value = ''; // Reset dropdown
                                }
                            }}
                            disabled={isBulkOperationLoading || selectedCount === 0}
                            defaultValue=""
                        >
                            <option value="">Change Role...</option>
                            <option value="admin">Promote to Admin</option>
                            <option value="user">Demote to User</option>
                        </Form.Select>
                    </>
                }
            />

            {users.length === 0 ? (
                <Alert variant="info">No users found.</Alert>
            ) : (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th style={{ width: '50px' }}>
                                <Form.Check
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => handleSelectAll(allUserIds)}
                                    title="Select all"
                                />
                            </th>
                            <th>Email</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    <Form.Check
                                        type="checkbox"
                                        checked={isSelected(user.id)}
                                        onChange={() => handleSelectItem(user.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td>{user.email}</td>
                                <td>{user.name || 'N/A'}</td>
                                <td>
                                    <Badge bg={user.role === 'admin' ? 'danger' : 'secondary'}>
                                        {user.role || 'user'}
                                    </Badge>
                                </td>
                                <td>{formatDate(user.created_at)}</td>
                                <td>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className="me-2"
                                        onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => handleDelete(user.id, user.email)}
                                    >
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </div>
    );
};

export default UserList;
