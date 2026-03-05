// Login page component for user authentication

import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router";
import Navbar from "../components/ui/Topbar";
import { useAuth } from "../modules/useAuth";
import { BACKEND_URL } from "../config";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";

/**
 * Login component handles user login functionality.
 * Provides legacy email/password login and Helmholtz AAI OAuth login.
 */
const Login = () => {
    const [email, setEmail] = useState("");
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
                { email, password, remember_me: rememberMe },
                { withCredentials: true }
            );

            console.log(res.data);
            alert("Login successful!");

            await checkAuth();
            // Navigate to the redirect URL or home
            navigate(redirectTo);
        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                alert("Invalid email or password.");
            } else {
                console.error(err);
                alert("Login failed.");
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
        <>
            <Navbar />
            <Container>
                <Row className="justify-content-center">
                    <Col md={6}>
                        <h2>Login</h2>
                        <Card>
                            <Card.Body>
                                <Card.Title>
                                    Login with Helmholtz AAI
                                </Card.Title>
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
                                <Card.Title>Legacy Email Login</Card.Title>
                                <Card.Text className="text-muted">
                                    Use this option only if you have a local
                                    account with email/password.
                                </Card.Text>
                                <Form onSubmit={handleSubmit}>
                                    <Form.Group controlId="loginEmail">
                                        <Form.Label>Email address</Form.Label>
                                        <Form.Control
                                            type="email"
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
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
                                    <Button variant="secondary" type="submit">
                                        Login with Email
                                    </Button>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </>
    );
};

export default Login;
