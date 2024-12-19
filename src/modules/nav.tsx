import React from "react";
import { Link } from "react-router-dom";

const Navbar: React.FC = () => {
    return (
        <nav className="navbar navbar-expand-lg navbar-light bg-light shadow-sm">
            <div className="container">
                <Link className="navbar-brand d-flex align-items-center" to="/">
                    <img src="/ODT_logo 1.svg" alt="Oligo Designer Toolsuite" width="40" height="40" />
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
                <div className="collapse navbar-collapse justify-content-end" id="navbarNav">
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
                                    <Link className="dropdown-item" to="/pipelines/genomic">
                                        Genomic Region Generator
                                    </Link>
                                </li>
                                <li>
                                    <Link className="dropdown-item" to="/pipelines/scrinshot">
                                        Scrinshot Probe
                                    </Link>
                                </li>
                                <li>
                                    <Link className="dropdown-item" to="/pipelines/merfish">
                                        Merfish Probe
                                    </Link>
                                </li>
                                <li>
                                    <Link className="dropdown-item" to="/pipelines/seqfish">
                                        SeqFish+ Probe
                                    </Link>
                                </li>
                                <li>
                                    <Link className="dropdown-item" to="/pipelines/oligo-seq">
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
                        {/* Uncomment this line if you want to include Custom Pipelines */}
                        {/* <li className="nav-item me-3">
                            <Link className="nav-link" to="/custom-pipelines">
                                Custom Pipelines
                            </Link>
                        </li> */}
                        <li className="nav-item me-3">
                            <Link className="nav-link" to="/contacts">
                                Contacts
                            </Link>
                        </li>
                        <li className="nav-item me-3">
                            <Link className="nav-link" to="/faq">
                                FAQ
                            </Link>
                        </li>
                        <li className="nav-item me-3">
                            <a
                                className="nav-link"
                                href="https://oligo-designer-toolsuite.readthedocs.io/en/latest/index.html"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Documentation
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;