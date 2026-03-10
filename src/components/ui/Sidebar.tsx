import { useState } from "react";
import { useAuth } from "../../modules/useAuth";
import { BACKEND_URL } from "../../config";
import { Button, Dropdown, Image, Nav, Navbar } from "react-bootstrap";
import { Link, useLocation } from "react-router";
import { GearFill, LayoutTextWindowReverse } from "react-bootstrap-icons";
import Divider from "./Divider";

const Sidebar: React.FC = () => {
    const { user, logout } = useAuth();
    const [copied, setCopied] = useState(false);
    const location = useLocation();
    const handleLogout = () => {
        fetch(BACKEND_URL + "/logout", {
            method: "POST",
            credentials: "include",
        }).then(() => {
            logout();
        });
    };

    const pipelines = [
        { name: "Scrinshot", path: "/pipelines/scrinshot" },
        { name: "Merfish", path: "/pipelines/merfish" },
        { name: "SeqFish+", path: "/pipelines/seqfish" },
        { name: "Oligo-Seq", path: "/pipelines/oligoseq" },
    ];

    return (
        <Navbar expand="lg" variant="main">
            <Navbar.Brand as={Link} to="/">
                <Image
                    src="/ODT_logo 1.svg"
                    alt="Oligo Designer Toolsuite"
                    width="80"
                    height="80"
                />
                Oligo Designer Toolsuite
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="navigation-bar" />
            <Navbar.Collapse id="navigation-bar">
                <Nav variant="separated">
                    <Nav.Link as={Link} to="/">
                        Home
                    </Nav.Link>
                    <Nav.Link as={Link} to="/faq">
                        FAQ
                    </Nav.Link>
                    <Nav.Link as={Link} to="/contact">
                        Contact
                    </Nav.Link>
                </Nav>

                <h5>Pipelines</h5>

                <Nav variant="pipelines">
                    {pipelines.map((pipeline) => (
                        <Nav.Link
                            key={pipeline.path}
                            as={Link}
                            to={pipeline.path}
                            active={location.pathname.startsWith(pipeline.path)}
                        >
                            <LayoutTextWindowReverse size={20} />
                            {pipeline.name}
                        </Nav.Link>
                    ))}
                </Nav>

                <Divider />

                <h5>Recent Runs</h5>

                <Link to="/runs">Runs</Link>

                {/* Auth  */}
                {user ? (
                    <>
                        {user.role === "admin" && (
                            <Nav.Link as={Link} to="/admin">
                                Admin
                            </Nav.Link>
                        )}
                        <Nav.Item>
                            <Dropdown>
                                <Dropdown.Toggle>
                                    <GearFill />
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item
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
                                    </Dropdown.Item>
                                    <Dropdown.Divider />
                                    <Dropdown.Item onClick={handleLogout}>
                                        Logout
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>
                        </Nav.Item>
                    </>
                ) : (
                    <Nav.Item>
                        <Link to="/login">
                            <Button variant="primary">Login/Register</Button>
                        </Link>
                    </Nav.Item>
                )}
            </Navbar.Collapse>
        </Navbar>
    );
};

export default Sidebar;
