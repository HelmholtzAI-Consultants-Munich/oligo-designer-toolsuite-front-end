import { Button, Collapse, Nav, Navbar } from "react-bootstrap";
import { Link, useLocation } from "react-router";
import {
    BarChartFill,
    ChatDots,
    ChevronDown,
    ChevronUp,
    FileText,
    Gear,
    People,
    Speedometer2,
} from "react-bootstrap-icons";
import Divider from "./Divider";
import RecentRuns from "./RecentRuns";
import { Horizontal, Vertical } from "./Alignment";
import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { pipelineOverview } from "../../pipelineConfig/overview";

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
    const { user } = useAuth();

    const [expanded, setExpanded] = useState(false);
    const [adminExpanded, setAdminExpanded] = useState(false);
    const isAdmin = user?.role === "admin";

    const handleSelect = () => {
        setExpanded(false);
    };

    return (
        <Navbar
            onSelect={handleSelect}
            expand="lg"
            variant="main"
            expanded={expanded}
        >
            <Navbar.Toggle
                aria-controls="navigation-bar"
                onClick={() => setExpanded(!expanded)}
            />
            <Navbar.Collapse id="navigation-bar" className="mt-2">
                <Vertical align="stretch" gap="md" fillWidth>
                    <h5>Pipelines</h5>

                    <Nav variant="heavy">
                        {pipelineOverview.map((pipeline) => {
                            const Icon = pipeline.icon;

                            if (!pipeline.available || !pipeline.link) {
                                return (
                                    <Nav.Link key={pipeline.title} disabled>
                                        <Horizontal gap="lg" align="center">
                                            <Icon
                                                size={18}
                                                color={pipeline.iconColor}
                                            />
                                            <span>{pipeline.title}</span>
                                        </Horizontal>
                                    </Nav.Link>
                                );
                            }

                            return (
                                <Nav.Link
                                    key={pipeline.title}
                                    as={Link}
                                    to={pipeline.link}
                                    active={location.pathname.startsWith(
                                        pipeline.link
                                    )}
                                    eventKey={pipeline.link}
                                >
                                    <Horizontal gap="lg" align="center">
                                        <Icon
                                            size={18}
                                            color={pipeline.iconColor}
                                        />
                                        <span>{pipeline.title}</span>
                                    </Horizontal>
                                </Nav.Link>
                            );
                        })}
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
                                onClick={() => setAdminExpanded(!adminExpanded)}
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
            </Navbar.Collapse>
        </Navbar>
    );
};

export default Sidebar;
