import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

interface User {
    id: string;
    email: string;
    name: string;
    role: "user" | "admin";
}

const UserEdit: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        email: "",
        name: "",
        role: "user" as "user" | "admin",
    });

    useEffect(() => {
        if (!id) return;
        const loadUser = async () => {
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
                    email: userData.email || "",
                    name: userData.name || "",
                    role: userData.role || "user",
                });
            } catch (err: unknown) {
                if (axios.isAxiosError(err)) {
                    setError(
                        err.response?.data?.error || "Failed to load user"
                    );
                } else {
                    setError("Failed to load user");
                }
                console.error("Error fetching user:", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadUser();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!id) {
            setError("Invalid user ID");
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
            setSuccess(true);
            setTimeout(() => {
                navigate("/admin/users");
            }, 1500);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || "Failed to update user");
            } else {
                setError("Failed to update user");
            }
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
            <div className="d-flex justify-content-center p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );
    }

    if (error && !user) {
        return (
            <div className="container-fluid p-4">
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
            </div>
        );
    }

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Edit User</h2>
                <Button
                    variant="secondary"
                    onClick={() => navigate("/admin/users")}
                >
                    Back to Users
                </Button>
            </div>

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

                    {success && (
                        <Alert variant="success">
                            User updated successfully! Redirecting...
                        </Alert>
                    )}

                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Email</Form.Label>
                            <Form.Control
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Name</Form.Label>
                            <Form.Control
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </Form.Group>

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

                        <div className="d-flex gap-2">
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
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </div>
    );
};

export default UserEdit;
