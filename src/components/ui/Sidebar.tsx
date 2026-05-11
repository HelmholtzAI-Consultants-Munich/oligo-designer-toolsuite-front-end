import { Image, Nav, Navbar } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router";
import { BoxArrowUpRight, Window } from "react-bootstrap-icons";
import Divider from "./Divider";
import RecentRuns from "./RecentRuns";
import UserDropdown from "./UserDropdown";
import { Horizontal, Vertical } from "./Alignment";
import { pipelineDisplayNames } from "./utils";
import { useState } from "react";

const Sidebar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const pipelines: { name: string; path: string }[] = Object.entries(
        pipelineDisplayNames
    )
        .filter(([key]) => key !== "generator")
        .map(([key, name]: [string, string]) => ({
            name,
            path: `/pipelines/${key}`,
        }));

    const [expanded, setExpanded] = useState(false);

    const handleSelect = () => {
        setExpanded(false);
    };

    const handleNoUser = () => {
        navigate("/login");
        setExpanded(false);
    };

    return (
        <Navbar
            onSelect={handleSelect}
            expand="lg"
            variant="main"
            expanded={expanded}
        >
            <Navbar.Brand as={Link} to="/" onClick={() => setExpanded(false)}>
                <Horizontal gap="lg" align="center">
                    <Image src="/odt-logo.svg" alt="Oligo Designer Toolsuite" />
                    Oligo Designer <br /> Toolsuite
                </Horizontal>
            </Navbar.Brand>
            <Navbar.Toggle
                aria-controls="navigation-bar"
                onClick={() => setExpanded(!expanded)}
            />
            <Navbar.Collapse id="navigation-bar" className="mt-2">
                <Vertical
                    justify="space-between"
                    align="stretch"
                    gap="md"
                    fillHeight
                    fillWidth
                >
                    <Nav variant="separated">
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
                            Docs <BoxArrowUpRight size={14} className="ms-1" />
                        </Nav.Link>
                    </Nav>

                    <div
                        className="spacer"
                        style={{ flex: 1, maxHeight: "5rem" }}
                    />

                    <Vertical gap="sm" align="stretch">
                        <h5>Pipelines</h5>

                        <Nav variant="heavy">
                            {pipelines.map((pipeline) => (
                                <Nav.Link
                                    key={pipeline.path}
                                    as={Link}
                                    to={pipeline.path}
                                    active={location.pathname.startsWith(
                                        pipeline.path
                                    )}
                                    eventKey={pipeline.path}
                                >
                                    <Horizontal gap="lg" align="center">
                                        <Window size={18} />
                                        <span>{pipeline.name}</span>
                                    </Horizontal>
                                </Nav.Link>
                            ))}
                        </Nav>

                        <Divider />

                        <h5>Recent Runs</h5>

                        <RecentRuns />
                    </Vertical>

                    <div className="spacer" style={{ flex: 1 }} />

                    <UserDropdown noUserCallback={handleNoUser} />
                </Vertical>
            </Navbar.Collapse>
        </Navbar>
    );
};

export default Sidebar;
