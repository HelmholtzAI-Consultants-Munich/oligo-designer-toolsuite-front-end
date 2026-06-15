import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import { Table, Button, Badge, Spinner, Alert, Form } from "react-bootstrap";
import { useBulkSelection } from "../shared/useBulkSelection";
import BulkActionToolbar from "../shared/BulkActionToolbar";
import { BACKEND_URL } from "../../config";
import { formatAdminDateTime } from "../shared/date";
import Page from "../../components/ui/Page";
import { confirmWithModal } from "../../utils/modalUtil";
import { showToast } from "../../utils/toastUtil";
import { getErrorMessage } from "../../utils/errorUtil";
import { Vertical } from "../../components/ui/Alignment";

interface User {
    id: string;
    username?: string;
    helmholtz_sub?: string;
    role: "user" | "admin";
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
            const response = await axios.get(BACKEND_URL + "/api/admin/users", {
                withCredentials: true,
            });
            setUsers(response.data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load users"));
            console.error("Error fetching users:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (userId: string, userIdentifier: string) => {
        confirmWithModal({
            title: "Delete User",
            content: <>Delete user {userIdentifier}?</>,
            primaryAction: {
                label: "Delete",
                variant: "danger",
                callback: async () => {
                    try {
                        await axios.delete(
                            BACKEND_URL + `/api/admin/users/${userId}`,
                            {
                                withCredentials: true,
                            }
                        );
                        showToast({
                            type: "success",
                            title: "User deleted",
                            content: `Deleted ${userIdentifier}.`,
                        });
                        fetchUsers();
                    } catch (err: unknown) {
                        showToast({
                            type: "danger",
                            title: "Delete failed",
                            content: getErrorMessage(
                                err,
                                "Failed to delete user"
                            ),
                        });
                    }
                },
            },
        });
    };

    const handleBulkDelete = async () => {
        const selectedArray = Array.from(selectedItems);
        if (selectedArray.length === 0) return;

        confirmWithModal({
            title: "Delete Users",
            content: `Delete ${selectedArray.length} user(s)? This action cannot be undone.`,
            primaryAction: {
                label: "Delete",
                variant: "danger",
                callback: async () => {
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

                        showToast({
                            type: "success",
                            title: "Users deleted",
                            content: message,
                        });
                        clearSelection();
                        fetchUsers();
                    } catch (err: unknown) {
                        showToast({
                            type: "danger",
                            title: "Delete failed",
                            content: getErrorMessage(
                                err,
                                "Failed to delete users"
                            ),
                        });
                    } finally {
                        setIsBulkOperationLoading(false);
                    }
                },
            },
        });
    };

    const handleBulkRoleChange = async (newRole: "user" | "admin") => {
        const selectedArray = Array.from(selectedItems);
        if (selectedArray.length === 0) return;

        const roleLabel = newRole === "admin" ? "Admin" : "User";
        confirmWithModal({
            title: "Change User Roles",
            content: `Change role of ${selectedArray.length} user(s) to ${roleLabel}?`,
            primaryAction: {
                label: "Change Role",
                variant: "primary",
                callback: async () => {
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

                        showToast({
                            type: "success",
                            title: "Roles updated",
                            content: message,
                        });
                        clearSelection();
                        fetchUsers();
                    } catch (err: unknown) {
                        showToast({
                            type: "danger",
                            title: "Update failed",
                            content: getErrorMessage(
                                err,
                                "Failed to update roles"
                            ),
                        });
                    } finally {
                        setIsBulkOperationLoading(false);
                    }
                },
            },
        });
    };

    if (isLoading) {
        return (
            <Page title="User Management">
                <Vertical align="center" className="p-5">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </Vertical>
            </Page>
        );
    }

    if (error) {
        return (
            <Page title="User Management">
                <Alert variant="danger">
                    <Alert.Heading>Error loading users</Alert.Heading>
                    <p>{error}</p>
                    <Button variant="primary" onClick={fetchUsers}>
                        Retry
                    </Button>
                </Alert>
            </Page>
        );
    }

    const allUserIds = users.map((user) => user.id);
    const allSelected =
        allUserIds.length > 0 &&
        allUserIds.every((id) => selectedItems.has(id));

    return (
        <Page title="User Management">
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
        </Page>
    );
};

export default UserList;
