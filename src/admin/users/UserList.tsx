import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import { Table, Button, Badge, Spinner, Alert, Form } from "react-bootstrap";
import { useBulkSelection } from "../shared/useBulkSelection";
import BulkActionToolbar from "../shared/BulkActionToolbar";
import { BACKEND_URL } from "../../config";
import { formatAdminDateTime } from "../shared/date";

interface User {
    id: string;
    username?: string;
    helmholtz_sub?: string;
    role: "user" | "admin";
    created_at?: string;
    banned: boolean;
    ban_id?: string;
}

interface BannedAccount {
    id: string;
    helmholtz_sub: string;
    banned_at?: string;
    banned_by?: string;
}

const UserList: React.FC = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [bannedAccounts, setBannedAccounts] = useState<BannedAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBulkOperationLoading, setIsBulkOperationLoading] = useState(false);

    // Use shared bulk selection hook
    const {
        selectedItems,
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
            const [usersResponse, bannedResponse] = await Promise.all([
                axios.get(BACKEND_URL + "/api/admin/users", {
                    withCredentials: true,
                }),
                axios.get(BACKEND_URL + "/api/admin/banned-users", {
                    withCredentials: true,
                }),
            ]);
            setUsers(usersResponse.data);
            setBannedAccounts(bannedResponse.data);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || "Failed to load users");
            } else {
                setError("Failed to load users");
            }
            console.error("Error fetching users:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBan = async (user: User) => {
        if (!user.helmholtz_sub) return;

        const confirmed = window.confirm(
            `Ban Helmholtz account ${user.helmholtz_sub}? The account data will be retained, but access will be blocked.`
        );
        if (!confirmed) return;

        try {
            await axios.post(
                BACKEND_URL + `/api/admin/users/${user.id}/ban`,
                {},
                { withCredentials: true }
            );
            await fetchUsers();
        } catch (err: unknown) {
            const message = axios.isAxiosError(err)
                ? err.response?.data?.error || err.message
                : "Unknown error";
            alert(`Failed to ban user: ${message}`);
        }
    };

    const handleUnban = async (banId: string, helmholtzSub: string) => {
        if (!window.confirm(`Unban Helmholtz account ${helmholtzSub}?`)) {
            return;
        }

        try {
            await axios.delete(
                BACKEND_URL + `/api/admin/banned-users/${banId}`,
                { withCredentials: true }
            );
            await fetchUsers();
        } catch (err: unknown) {
            const message = axios.isAxiosError(err)
                ? err.response?.data?.error || err.message
                : "Unknown error";
            alert(`Failed to unban user: ${message}`);
        }
    };

    const handleDelete = async (userId: string, userIdentifier: string) => {
        if (
            window.confirm(
                `Are you sure you want to delete user ${userIdentifier}?`
            )
        ) {
            try {
                await axios.delete(BACKEND_URL + `/api/admin/users/${userId}`, {
                    withCredentials: true,
                });
                // Refresh the list
                fetchUsers();
            } catch (err: unknown) {
                if (axios.isAxiosError(err)) {
                    alert(
                        `Failed to delete user: ${err.response?.data?.error || err.message || "Unknown error"}`
                    );
                } else {
                    alert("Failed to delete user");
                }
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
                BACKEND_URL + "/api/admin/users/bulk-delete",
                { user_ids: selectedArray },
                { withCredentials: true }
            );

            const result = response.data;
            let message =
                result.message ||
                `Successfully deleted ${result.deleted_count} user(s)`;

            if (result.skipped && result.skipped.length > 0) {
                message += `. Skipped ${result.skipped.length} (cannot delete own account)`;
            }

            alert(message);
            clearSelection();
            fetchUsers();
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                alert(
                    `Failed to delete users: ${err.response?.data?.error || err.message || "Unknown error"}`
                );
            } else {
                alert("Failed to delete users");
            }
        } finally {
            setIsBulkOperationLoading(false);
        }
    };

    const handleBulkRoleChange = async (newRole: "user" | "admin") => {
        const selectedArray = Array.from(selectedItems);
        if (selectedArray.length === 0) return;

        const roleLabel = newRole === "admin" ? "Admin" : "User";
        const confirmed = window.confirm(
            `Are you sure you want to change role of ${selectedArray.length} user(s) to ${roleLabel}?`
        );

        if (!confirmed) return;

        setIsBulkOperationLoading(true);
        try {
            const response = await axios.post(
                BACKEND_URL + "/api/admin/users/bulk-update-role",
                { user_ids: selectedArray, role: newRole },
                { withCredentials: true }
            );

            const result = response.data;
            let message =
                result.message ||
                `Successfully updated role of ${result.updated_count} user(s) to ${newRole}`;

            if (result.skipped && result.skipped.length > 0) {
                message += `. Skipped ${result.skipped.length} (cannot demote own admin account)`;
            }

            alert(message);
            clearSelection();
            fetchUsers();
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                alert(
                    `Failed to update roles: ${err.response?.data?.error || err.message || "Unknown error"}`
                );
            } else {
                alert("Failed to update roles");
            }
        } finally {
            setIsBulkOperationLoading(false);
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

    const allUserIds = users.map((user) => user.id);
    const allSelected =
        allUserIds.length > 0 &&
        allUserIds.every((id) => selectedItems.has(id));

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
                            disabled={
                                isBulkOperationLoading || selectedCount === 0
                            }
                        >
                            Delete Selected
                        </Button>
                        <Form.Select
                            size="sm"
                            style={{ width: "auto", display: "inline-block" }}
                            onChange={(e) => {
                                const role = e.target.value as "user" | "admin";
                                if (role) {
                                    handleBulkRoleChange(role);
                                    e.target.value = ""; // Reset dropdown
                                }
                            }}
                            disabled={
                                isBulkOperationLoading || selectedCount === 0
                            }
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
                            <th style={{ width: "50px" }}>
                                <Form.Check
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => handleSelectAll(allUserIds)}
                                    title="Select all"
                                />
                            </th>
                            <th>Identifier</th>
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
                                        onChange={() =>
                                            handleSelectItem(user.id)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td>
                                    {user.username ? (
                                        <>Username: {user.username}</>
                                    ) : user.helmholtz_sub ? (
                                        <>Helmholtz ID: {user.helmholtz_sub}</>
                                    ) : (
                                        "N/A"
                                    )}
                                </td>
                                <td>
                                    <Badge
                                        bg={
                                            user.role === "admin"
                                                ? "danger"
                                                : "secondary"
                                        }
                                    >
                                        {user.role || "user"}
                                    </Badge>
                                    {user.banned && (
                                        <Badge bg="dark" className="ms-2">
                                            Banned
                                        </Badge>
                                    )}
                                </td>
                                <td>
                                    {
                                        formatAdminDateTime(
                                            user.created_at,
                                            "N/A"
                                        ).split(" ")[0]
                                    }
                                </td>
                                <td>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className="me-2"
                                        onClick={() =>
                                            navigate(
                                                `/admin/users/${user.id}/edit`
                                            )
                                        }
                                    >
                                        Edit
                                    </Button>
                                    {user.helmholtz_sub &&
                                        (user.banned && user.ban_id ? (
                                            <Button
                                                variant="outline-success"
                                                size="sm"
                                                className="me-2"
                                                onClick={() =>
                                                    handleUnban(
                                                        user.ban_id!,
                                                        user.helmholtz_sub!
                                                    )
                                                }
                                            >
                                                Unban
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="warning"
                                                size="sm"
                                                className="me-2"
                                                onClick={() => handleBan(user)}
                                            >
                                                Ban
                                            </Button>
                                        ))}
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() =>
                                            handleDelete(
                                                user.id,
                                                user.username ||
                                                    user.helmholtz_sub ||
                                                    user.id
                                            )
                                        }
                                    >
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            <h3 className="mt-5 mb-3">Banned Accounts</h3>
            {bannedAccounts.length === 0 ? (
                <Alert variant="info">No banned accounts.</Alert>
            ) : (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>Helmholtz ID</th>
                            <th>Banned</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bannedAccounts.map((account) => (
                            <tr key={account.id}>
                                <td>{account.helmholtz_sub}</td>
                                <td>
                                    {formatAdminDateTime(
                                        account.banned_at,
                                        "N/A"
                                    )}
                                </td>
                                <td>
                                    <Button
                                        variant="outline-success"
                                        size="sm"
                                        onClick={() =>
                                            handleUnban(
                                                account.id,
                                                account.helmholtz_sub
                                            )
                                        }
                                    >
                                        Unban
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
