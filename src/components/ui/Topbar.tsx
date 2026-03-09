import { useState } from "react";
import { useAuth } from "../../modules/useAuth";
import { BACKEND_URL } from "../../config";
import {
    Button,
    Container,
    Dropdown,
    Image,
    Nav,
    Navbar,
    NavDropdown,
} from "react-bootstrap";
import { Link } from "react-router";
import { GearFill } from "react-bootstrap-icons";

const Topbar: React.FC = () => {
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
        <Navbar expand="lg">
            <Container>
                <Navbar.Brand href="/">
                    <Image
                        src="/ODT_logo 1.svg"
                        alt="Oligo Designer Toolsuite"
                        width="40"
                        height="40"
                    />
                    Oligo Designer Toolsuite
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="navigation-bar" />
                <Navbar.Collapse
                    id="navigation-bar"
                    className="justify-content-end"
                >
                    <Nav>
                        <Nav.Link as={Link} to="/">
                            Home
                        </Nav.Link>

                        <NavDropdown title="Pipelines" id="pipelines-dropdown">
                            <NavDropdown.Item
                                as={Link}
                                to="/pipelines/scrinshot"
                            >
                                Scrinshot Probe
                            </NavDropdown.Item>
                            <NavDropdown.Item as={Link} to="/pipelines/merfish">
                                Merfish Probe
                            </NavDropdown.Item>
                            <NavDropdown.Item as={Link} to="/pipelines/seqfish">
                                SeqFish+ Probe
                            </NavDropdown.Item>
                            <NavDropdown.Item
                                as={Link}
                                to="/pipelines/oligoseq"
                            >
                                Oligo-Seq Probe
                            </NavDropdown.Item>
                        </NavDropdown>

                        <Nav.Link as={Link} to="/runs">
                            Runs
                        </Nav.Link>
                        <Nav.Link as={Link} to="/faq">
                            FAQ
                        </Nav.Link>
                        <Nav.Link as={Link} to="/contact">
                            Contact
                        </Nav.Link>

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
                                            <Dropdown.Item
                                                onClick={handleLogout}
                                            >
                                                Logout
                                            </Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </Nav.Item>
                            </>
                        ) : (
                            <Nav.Item>
                                <Link to="/login">
                                    <Button variant="outline-primary">
                                        Login/Register
                                    </Button>
                                </Link>
                            </Nav.Item>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default Topbar;
