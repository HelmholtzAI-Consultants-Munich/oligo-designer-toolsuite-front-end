import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Table, Button, Badge, Spinner, Alert } from 'react-bootstrap';

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

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString();
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

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>User Management</h2>
            </div>

            {users.length === 0 ? (
                <Alert variant="info">No users found.</Alert>
            ) : (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
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
