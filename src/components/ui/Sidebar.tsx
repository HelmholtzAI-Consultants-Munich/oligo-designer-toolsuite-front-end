import { Image, Nav, Navbar } from "react-bootstrap";
import { Link, useLocation } from "react-router";
import { LayoutTextWindowReverse } from "react-bootstrap-icons";
import Divider from "./Divider";
import RecentRuns from "./RecentRuns";
import UserDropdown from "./UserDropdown";
import { Vertical } from "./Grid";

const Sidebar: React.FC = () => {
    const location = useLocation();

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
                    src="/ODT_logo.svg"
                    alt="Oligo Designer Toolsuite"
                    width="80"
                    height="80"
                />
                Oligo Designer Toolsuite
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="navigation-bar" />
            <Navbar.Collapse id="navigation-bar">
                <Vertical justify="space-between" align="stretch">
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

                    <Vertical gap="lg" align="stretch">
                        <Vertical.Item>
                            <h5>Pipelines</h5>

                            <Nav variant="heavy">
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
                        </Vertical.Item>

                        <Divider />

                        <Vertical.Item>
                            <h5>Recent Runs</h5>

                            <RecentRuns />
                        </Vertical.Item>
                    </Vertical>

                    <UserDropdown />
                </Vertical>
            </Navbar.Collapse>
        </Navbar>
    );
};

export default Sidebar;
