import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Image, Nav, Navbar } from "react-bootstrap";
import { Horizontal } from "./Alignment";
import UserDropdown from "./UserDropdown";

export default function TopNavigation() {
    const location = useLocation();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);

    const closeNavigation = () => setExpanded(false);

    return (
        <Navbar
            expand="lg"
            expanded={expanded}
            className="border-bottom px-3 py-2"
            onSelect={closeNavigation}
        >
            <Navbar.Brand as={Link} to="/" onClick={closeNavigation}>
                <Horizontal gap="sm" align="center">
                    <Image
                        src="/odt-logo.svg"
                        alt="Oligo Designer Toolsuite"
                        width="48"
                        height="48"
                    />
                    Oligo Designer Toolsuite
                </Horizontal>
            </Navbar.Brand>
            <Navbar.Toggle
                aria-controls="top-navigation"
                onClick={() => setExpanded(!expanded)}
            />
            <Navbar.Collapse id="top-navigation">
                <Nav className="ms-lg-auto gap-lg-4 fw-semibold">
                    <Nav.Link
                        as={Link}
                        to="/"
                        active={location.pathname === "/"}
                        eventKey="/"
                    >
                        Home
                    </Nav.Link>
                    <Nav.Link
                        as={Link}
                        to="/faq"
                        active={location.pathname === "/faq"}
                        eventKey="/faq"
                    >
                        FAQ
                    </Nav.Link>
                    <Nav.Link
                        as={Link}
                        to="/contact"
                        active={location.pathname === "/contact"}
                        eventKey="/contact"
                    >
                        Contact
                    </Nav.Link>
                    <Nav.Link
                        href="https://oligo-designer-toolsuite.readthedocs.io/en/latest/index.html"
                        target="_blank"
                        active={false}
                    >
                        Docs
                    </Nav.Link>
                </Nav>

                <div className="vr d-none d-lg-block mx-3" aria-hidden="true" />

                <Nav className="align-items-lg-center gap-2 fw-semibold">
                    <UserDropdown
                        fullWidth={false}
                        noUserCallback={() => {
                            navigate("/login");
                            closeNavigation();
                        }}
                    />
                </Nav>
            </Navbar.Collapse>
        </Navbar>
    );
}
