// Login page component for user authentication

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../modules/nav";
import { useAuth } from "../modules/auth";
import { Spinner } from "react-bootstrap";

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
                "http://localhost:5000/login",
                { email, password, remember_me: rememberMe },
                { withCredentials: true }
            );

            console.log(res.data);
            alert("Login successful!");

            await checkAuth();
            // Navigate to the redirect URL or home
            navigate(redirectTo);
        } catch (err: any) {
            if (err.response && err.response.status === 401) {
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
        window.location.href = `http://localhost:5000/login${redirectParam}`;
    };

    // Show loading spinner while checking auth status
    if (loading) {
        return (
            <div>
                <Navbar />
                <div
                    className="d-flex justify-content-center align-items-center"
                    style={{ minHeight: "50vh" }}
                >
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </div>
            </div>
        );
    }

    // Don't render login form if user is already authenticated (will redirect)
    if (user) {
        return null;
    }

    return (
        <div>
            <Navbar />
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <h2 className="text-center mb-4">Login</h2>
                        <div className="card shadow-sm mb-4">
                            <div className="card-body">
                                <h5 className="card-title">
                                    Login with Helmholtz AAI
                                </h5>
                                <p className="card-text">
                                    Recommended for Helmholtz users. You will be
                                    redirected to the Helmholtz AAI login page.
                                </p>
                                <button
                                    className="btn btn-primary w-100"
                                    onClick={redirectToHelmholtz}
                                >
                                    Continue with Helmholtz AAI
                                </button>
                            </div>
                        </div>

                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h5 className="card-title">
                                    Legacy Email Login
                                </h5>
                                <p className="card-text text-muted">
                                    Use this option only if you have a local
                                    account with email/password.
                                </p>
                                <form onSubmit={handleSubmit}>
                                    <div className="mb-3">
                                        <label
                                            htmlFor="email"
                                            className="form-label"
                                        >
                                            Email address
                                        </label>
                                        <input
                                            type="email"
                                            className="form-control"
                                            id="email"
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label
                                            htmlFor="password"
                                            className="form-label"
                                        >
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            className="form-control"
                                            id="password"
                                            value={password}
                                            onChange={(e) =>
                                                setPassword(e.target.value)
                                            }
                                            required
                                        />
                                    </div>
                                    <div className="mb-3 form-check">
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            id="rememberMe"
                                            checked={rememberMe}
                                            onChange={(e) =>
                                                setRememberMe(e.target.checked)
                                            }
                                        />
                                        <label
                                            className="form-check-label"
                                            htmlFor="rememberMe"
                                        >
                                            Remember me
                                        </label>
                                    </div>
                                    <button
                                        type="submit"
                                        className="btn btn-secondary w-100"
                                    >
                                        Login with Email
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
