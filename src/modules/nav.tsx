import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./useAuth";
import { BACKEND_URL } from "../config";
const Navbar: React.FC = () => {
    const { user, logout } = useAuth();
    const [copied, setCopied] = useState(false);
    const handleLogout = () => {
        fetch(BACKEND_URL + "/logout", {
            method: "POST",
            credentials: "include",
        }).then(() => {
            logout();
        });
    };
    return (
        <nav className="navbar navbar-expand-lg navbar-light bg-light shadow-sm">
            <div className="container">
                <Link className="navbar-brand d-flex align-items-center" to="/">
                    <img
                        src="/ODT_logo 1.svg"
                        alt="Oligo Designer Toolsuite"
                        width="40"
                        height="40"
                    />
                    <span className="ms-2">Oligo Designer Toolsuite</span>
                </Link>
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarNav"
                    aria-controls="navbarNav"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div
                    className="collapse navbar-collapse justify-content-end"
                    id="navbarNav"
                >
                    <ul className="navbar-nav">
                        <li className="nav-item me-3">
                            <Link className="nav-link" to="/">
                                Home
                            </Link>
                        </li>
                        <li className="nav-item dropdown me-3">
                            <a
                                className="nav-link dropdown-toggle"
                                href=""
                                role="button"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                            >
                                Pipelines
                            </a>
                            <ul className="dropdown-menu">
                                <li>
                                    <Link
                                        className="dropdown-item"
                                        to="/pipelines/scrinshot"
                                    >
                                        Scrinshot Probe
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        className="dropdown-item"
                                        to="/pipelines/merfish"
                                    >
                                        Merfish Probe
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        className="dropdown-item"
                                        to="/pipelines/seqfish"
                                    >
                                        SeqFish+ Probe
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        className="dropdown-item"
                                        to="/pipelines/OligoSeq"
                                    >
                                        Oligo-Seq Probe
                                    </Link>
                                </li>
                            </ul>
                        </li>
                        <li className="nav-item me-3">
                            <Link className="nav-link" to="/runs">
                                Runs
                            </Link>
                        </li>

                        <li className="nav-item me-3">
                            <Link className="nav-link" to="/faq">
                                FAQ
                            </Link>
                        </li>
                        <li className="nav-item me-3">
                            <Link className="nav-link" to="/contacts">
                                Contacts
                            </Link>
                        </li>
                        {/* Auth  */}
                        {user ? (
                            <>
                                {user.role === "admin" && (
                                    <li className="nav-item me-3">
                                        <Link className="nav-link" to="/admin">
                                            Admin
                                        </Link>
                                    </li>
                                )}
                                <li className="nav-item dropdown">
                                    <a
                                        className="nav-link dropdown-toggle"
                                        href="#"
                                        role="button"
                                        data-bs-toggle="dropdown"
                                        aria-expanded="false"
                                    >
                                        {user.role === "admin" ? (
                                            <span>
                                                {user.username ||
                                                    user.helmholtz_sub ||
                                                    "Admin"}
                                            </span>
                                        ) : (
                                            <i className="bi bi-gear-fill"></i>
                                        )}
                                    </a>
                                    <ul className="dropdown-menu-start dropdown-menu">
                                        <li>
                                            <div
                                                className="dropdown-item-text px-3 py-2"
                                                style={{
                                                    cursor: "pointer",
                                                }}
                                                onClick={() => {
                                                    const textToCopy =
                                                        user.helmholtz_sub ||
                                                        user.username ||
                                                        user.id;
                                                    navigator.clipboard.writeText(
                                                        textToCopy
                                                    );
                                                    setCopied(true);
                                                    setTimeout(() => {
                                                        setCopied(false);
                                                    }, 2000);
                                                }}
                                                title="Click to copy"
                                            >
                                                <small className="text-muted d-block mb-1">
                                                    {copied ? (
                                                        <span className="text-success">
                                                            <i className="bi bi-check-circle-fill me-1"></i>
                                                            Copied!
                                                        </span>
                                                    ) : (
                                                        "User ID"
                                                    )}
                                                </small>
                                                <code className="text-break mb-0 d-block">
                                                    {user.helmholtz_sub ||
                                                        user.username ||
                                                        user.id}
                                                </code>
                                            </div>
                                        </li>
                                        <li>
                                            <hr className="dropdown-divider" />
                                        </li>
                                        <li>
                                            <button
                                                className="dropdown-item"
                                                onClick={handleLogout}
                                            >
                                                Logout
                                            </button>
                                        </li>
                                    </ul>
                                </li>
                            </>
                        ) : (
                            <li className="nav-item me-2">
                                <Link
                                    className="btn btn-outline-primary"
                                    to="/login"
                                >
                                    Login
                                </Link>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
