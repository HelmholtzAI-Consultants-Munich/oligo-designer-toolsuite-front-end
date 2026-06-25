import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import axios from "axios";
import {
    Form,
    Button,
    Card,
    Alert,
    Spinner,
    FormSelect,
} from "react-bootstrap";
import { BACKEND_URL } from "../../config";
import Page from "../../components/ui/Page";
import { showToast } from "../../utils/toastUtil";
import { getErrorMessage } from "../../utils/errorUtil";
import { Horizontal, Vertical } from "../../components/ui/Alignment";

interface User {
    id: string;
    username?: string;
    helmholtz_sub?: string;
    role: "user" | "admin";
}

const UserEdit: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        username: "",
        role: "user" as "user" | "admin",
    });

    const loadUser = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await axios.get(
                BACKEND_URL + `/api/admin/users/${id}`,
                { withCredentials: true }
            );
            const userData = response.data;
            setUser(userData);
            setFormData({
                username: userData.username || "",
                role: userData.role || "user",
            });
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load user"));
            console.error("Error fetching user:", err);
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!id) {
            setError("Invalid user ID");
            showToast({
                type: "danger",
                title: "Invalid user",
                content: "Invalid user ID",
            });
            return;
        }

        try {
            setIsSaving(true);
            await axios.put(BACKEND_URL + `/api/admin/users/${id}`, formData, {
                withCredentials: true,
                headers: {
                    "Content-Type": "application/json",
                },
            });
            showToast({
                type: "success",
                title: "User updated",
                content: "User updated successfully.",
            });
            setTimeout(() => {
                navigate("/admin/users");
            }, 1500);
        } catch (err: unknown) {
            const message = getErrorMessage(err, "Failed to update user");
            setError(message);
            showToast({
                type: "danger",
                title: "Update failed",
                content: message,
            });
            console.error("Error updating user:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    if (isLoading) {
        return (
            <Page
                title="Edit User"
                backTo={{ label: "Users", href: "/admin/users" }}
            >
                <Vertical align="center" className="p-5">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </Vertical>
            </Page>
        );
    }

    if (!id || (error && !user)) {
        return (
            <Page
                title="Edit User"
                backTo={{ label: "Users", href: "/admin/users" }}
            >
                <Alert variant="danger">
                    <Alert.Heading>Error loading user</Alert.Heading>
                    <p>{error}</p>
                    <Button
                        variant="primary"
                        onClick={() => navigate("/admin/users")}
                    >
                        Back to Users
                    </Button>
                </Alert>
            </Page>
        );
    }

    return (
        <Page
            title="Edit User"
            backTo={{ label: "Users", href: "/admin/users" }}
        >
            <Card>
                <Card.Body>
                    {error && (
                        <Alert
                            variant="danger"
                            dismissible
                            onClose={() => setError(null)}
                        >
                            {error}
                        </Alert>
                    )}

                    <Form onSubmit={handleSubmit}>
                        {user?.helmholtz_sub && (
                            <Alert variant="info" className="mb-3">
                                This is a Helmholtz user. Username cannot be
                                changed. Helmholtz ID: {user.helmholtz_sub}
                            </Alert>
                        )}
                        {user?.username && (
                            <Form.Group className="mb-3">
                                <Form.Label>Username</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    disabled={!!user.helmholtz_sub}
                                />
                                <Form.Text className="text-muted">
                                    Only editable for CLI-registered admin
                                    users.
                                </Form.Text>
                            </Form.Group>
                        )}
                        {!user?.username && !user?.helmholtz_sub && (
                            <Alert variant="warning" className="mb-3">
                                User has no identifier set.
                            </Alert>
                        )}

                        <Form.Group className="mb-3">
                            <Form.Label>Role</Form.Label>
                            <FormSelect
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                required
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </FormSelect>
                        </Form.Group>

                        <Horizontal gap="sm">
                            <Button
                                variant="primary"
                                type="submit"
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                            <Button
                                variant="secondary"
                                type="button"
                                onClick={() => navigate("/admin/users")}
                            >
                                Cancel
                            </Button>
                        </Horizontal>
                    </Form>
                </Card.Body>
            </Card>
        </Page>
    );
};

export default UserEdit;
