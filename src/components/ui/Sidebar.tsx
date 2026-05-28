import { Button, Collapse, Image, Nav, Navbar } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router";
import {
    BarChartFill,
    BoxArrowUpRight,
    ChatDots,
    ChevronDown,
    ChevronUp,
    FileText,
    Gear,
    People,
    Speedometer2,
    Window,
} from "react-bootstrap-icons";
import Divider from "./Divider";
import RecentRuns from "./RecentRuns";
import UserDropdown from "./UserDropdown";
import { Horizontal, Vertical } from "./Alignment";
import { useState } from "react";
import { type Pipeline } from "../../pipelineConfig/config";
import { getEnabledPipelinesOnly } from "../../pipelineConfig/utils";
import { useAuth } from "../../hooks/useAuth";

const adminLinks = [
    { path: "/admin/dashboard", label: "Dashboard", icon: Speedometer2 },
    { path: "/admin/users", label: "User Management", icon: People },
    { path: "/admin/pipelines", label: "Pipeline Management", icon: Gear },
    { path: "/admin/feedback", label: "Feedback", icon: ChatDots },
    { path: "/admin/reports", label: "Monthly Reports", icon: BarChartFill },
    { path: "/admin/legal", label: "Legal Documents", icon: FileText },
];

const Sidebar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const pipelines: { name: string; path: string }[] = Object.entries(
        getEnabledPipelinesOnly()
    )
        .filter(([key, pipeline]) => key !== "generator" && !pipeline.disabled)
        .map(([key, pipeline]: [string, Pipeline]) => ({
            name: pipeline.displayName,
            path: `/pipelines/${key}`,
        }));

    const [expanded, setExpanded] = useState(false);
    const [adminExpanded, setAdminExpanded] = useState(false);
    const isAdmin = user?.role === "admin";

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
            className={
                isAdmin && adminExpanded ? "admin-section-expanded" : undefined
            }
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

                        {isAdmin && (
                            <>
                                <Divider />

                                <Button
                                    variant="outline-border"
                                    className="w-100 text-start"
                                    onClick={() =>
                                        setAdminExpanded(!adminExpanded)
                                    }
                                    aria-controls="admin-navigation"
                                    aria-expanded={adminExpanded}
                                >
                                    <Horizontal gap="lg" align="center">
                                        <Speedometer2 size={18} />
                                        <span>Admin</span>
                                        <Horizontal.Item className="ms-auto">
                                            {adminExpanded ? (
                                                <ChevronUp size={15} />
                                            ) : (
                                                <ChevronDown size={15} />
                                            )}
                                        </Horizontal.Item>
                                    </Horizontal>
                                </Button>

                                <Collapse in={adminExpanded}>
                                    <div id="admin-navigation">
                                        <Nav variant="heavy">
                                            {adminLinks.map((link) => {
                                                const Icon = link.icon;

                                                return (
                                                    <Nav.Link
                                                        key={link.path}
                                                        as={Link}
                                                        to={link.path}
                                                        active={location.pathname.startsWith(
                                                            link.path
                                                        )}
                                                        eventKey={link.path}
                                                    >
                                                        <Horizontal
                                                            gap="lg"
                                                            align="center"
                                                        >
                                                            <Icon size={18} />
                                                            <span>
                                                                {link.label}
                                                            </span>
                                                        </Horizontal>
                                                    </Nav.Link>
                                                );
                                            })}
                                        </Nav>
                                    </div>
                                </Collapse>
                            </>
                        )}
                    </Vertical>

                    <div className="spacer" style={{ flex: 1 }} />

                    <UserDropdown noUserCallback={handleNoUser} />
                </Vertical>
            </Navbar.Collapse>
        </Navbar>
    );
};

export default Sidebar;
