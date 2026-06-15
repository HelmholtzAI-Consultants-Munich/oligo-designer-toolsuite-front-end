// Login page component for user authentication

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { BACKEND_URL, TURNSTILE_SITE_KEY } from "../config";
import { Alert, Button, Card, Form } from "react-bootstrap";
import Page from "../components/ui/Page";
import { showToast } from "../utils/toastUtil";
import { Vertical } from "../components/ui/Alignment";
import { useRuns } from "../hooks/useRuns";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

/**
 * Login component handles user login functionality.
 * Provides legacy username/password login and Helmholtz AAI OAuth login.
 */
const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(true);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const auth = useAuth();
    const user = auth.user;
    const { loading, checkAuth } = auth;
    const { updateRuns } = useRuns();
    const turnstileRef = useRef<TurnstileInstance | null>(null);

    const sitekey = TURNSTILE_SITE_KEY;

    // Get redirect URL from query params
    const redirectTo = searchParams.get("redirect") || "/";
    const [oauthError] = useState(() => searchParams.get("oauth_error"));

    useEffect(() => {
        if (!oauthError) return;

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.delete("oauth_error");
        setSearchParams(nextSearchParams, { replace: true });
    }, [oauthError, searchParams, setSearchParams]);

    // Redirect if already logged in
    // This useEffect is necessary because navigate() cannot reliably be called during render.
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
                {
                    username,
                    password,
                    remember_me: rememberMe,
                    token: turnstileRef.current?.getResponse() ?? "",
                },
                { withCredentials: true }
            );
            turnstileRef.current?.reset();

            console.log(res.data);
            showToast({
                title: "Login successful!",
                content: "You have been logged in successfully.",
                type: "success",
            });

            await checkAuth();
            updateRuns(); // Refresh runs after login
            // Navigate to the redirect URL or home
            navigate(redirectTo);
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                switch (error.response?.status) {
                    case 401: {
                        showToast({
                            title: "Invalid username or password.",
                            content:
                                "Please check your credentials and try again.",
                            type: "danger",
                        });
                        break;
                    }
                    case 403: {
                        showToast({
                            title: "Verification failed.",
                            content:
                                " We couldn't verify that you are human. Please try again.",
                            type: "danger",
                        });
                        break;
                    }
                    default:
                        console.error(error);
                        showToast({
                            title: "Login failed.",
                            content:
                                "An error occurred during login. Please try again later.",
                            type: "danger",
                        });
                }
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
            <Vertical gap="xl" align="center" justify="center" grow>
                <Card style={{ maxWidth: "500px" }}>
                    <Card.Body>
                        <Vertical gap="md" align="stretch">
                            {oauthError === "vo_access_denied" && (
                                <Alert variant="danger">
                                    Access is restricted to members of the
                                    Helmholtz-member VO.
                                </Alert>
                            )}
                            <Card.Title as="h2">
                                Login with Helmholtz AAI
                            </Card.Title>
                            <Card.Text className="text-muted">
                                Recommended for Helmholtz users. You will be
                                redirected to the Helmholtz AAI login page.
                            </Card.Text>
                            <Turnstile
                                ref={turnstileRef}
                                siteKey={sitekey}
                                options={{
                                    theme: "light",
                                    language: "en",
                                }}
                            />
                            <Button onClick={redirectToHelmholtz}>
                                Continue with Helmholtz AAI
                            </Button>
                        </Vertical>
                    </Card.Body>
                </Card>

                <Card style={{ maxWidth: "500px" }}>
                    <Card.Body>
                        <Card.Title>Admin Login</Card.Title>
                        <Card.Text className="text-muted">
                            Use this option if you have an admin account with
                            username/password.
                        </Card.Text>
                        <Form onSubmit={handleSubmit}>
                            <Vertical gap="md" align="stretch">
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
                            </Vertical>
                        </Form>
                    </Card.Body>
                </Card>
            </Vertical>
        </Page>
    );
};

export default Login;
