// Login page component for user authentication

import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../modules/useAuth";
import { BACKEND_URL } from "../config";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import Page from "../components/ui/Page";
import { showToast } from "../modules/toastUtil";

/**
 * Login component handles user login functionality.
 * Provides legacy username/password login and Helmholtz AAI OAuth login.
 */
const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(true);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, loading, checkAuth } = useAuth();

    // Get redirect URL from query params
    const redirectTo = searchParams.get("redirect") || "/";

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && user) {
            // User is already authenticated, redirect them away from login page
            navigate(redirectTo);
        }
    }, [user, loading, navigate, redirectTo]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const res = await axios.post(
                BACKEND_URL + "/login",
                { username, password, remember_me: rememberMe },
                { withCredentials: true }
            );

            console.log(res.data);
            showToast({
                type: "success",
                title: "Login successful!",
            });

            await checkAuth();
            // Navigate to the redirect URL or home
            navigate(redirectTo);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                showToast({
                    type: "error",
                    title: "Invalid username or password.",
                });
            } else {
                console.error(err);
                showToast({
                    type: "error",
                    title: "Login failed.",
                });
            }
        }
    };

    const redirectToHelmholtz = () => {
        // Include redirect parameter in OAuth flow
        const redirectParam =
            redirectTo !== "/"
                ? `?redirect=${encodeURIComponent(redirectTo)}`
                : "";
        window.location.href = BACKEND_URL + `/login${redirectParam}`;
    };

    // Show loading spinner while checking auth status
    if (loading) return <div>Loading...</div>;

    // Don't render login form if user is already authenticated (will redirect)
    if (user) {
        return null;
    }

    return (
        <Page title="Login" hideHeader>
            <Row className="justify-content-center">
                <Col md={6}>
                    <Card>
                        <Card.Body>
                            <Card.Title>Login with Helmholtz AAI</Card.Title>
                            <Card.Text className="text-muted">
                                Recommended for Helmholtz users. You will be
                                redirected to the Helmholtz AAI login page.
                            </Card.Text>
                            <Button onClick={redirectToHelmholtz}>
                                Continue with Helmholtz AAI
                            </Button>
                        </Card.Body>
                    </Card>

                    <Card>
                        <Card.Body>
                            <Card.Title>Admin Login</Card.Title>
                            <Card.Text className="text-muted">
                                Use this option if you have an admin account
                                with username/password.
                            </Card.Text>
                            <Form onSubmit={handleSubmit}>
                                <Form.Group controlId="loginUsername">
                                    <Form.Label>Username</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={username}
                                        onChange={(e) =>
                                            setUsername(e.target.value)
                                        }
                                        required
                                    />
                                </Form.Group>
                                <Form.Group controlId="loginPassword">
                                    <Form.Label>Password</Form.Label>
                                    <Form.Control
                                        type="password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                    />
                                </Form.Group>
                                <Form.Check
                                    type="checkbox"
                                    label="Remember me"
                                    id="loginRememberMe"
                                    checked={rememberMe}
                                    onChange={(e) =>
                                        setRememberMe(e.target.checked)
                                    }
                                />
                                <Button variant="outline-primary" type="submit">
                                    Login with Username
                                </Button>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Page>
    );
};

export default Login;
