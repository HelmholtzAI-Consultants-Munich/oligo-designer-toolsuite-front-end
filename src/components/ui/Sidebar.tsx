import { Image, Nav, Navbar } from "react-bootstrap";
import { Link, useLocation } from "react-router";
import { App, Beaker, BoxArrowUp, BoxArrowUpRight, LayoutTextWindowReverse, Window } from "react-bootstrap-icons";
import Divider from "./Divider";
import RecentRuns from "./RecentRuns";
import UserDropdown from "./UserDropdown";
import { Horizontal, Vertical } from "./Grid";

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
            <Navbar.Collapse id="navigation-bar" className="mt-2">
                <Vertical justify="space-between" align="stretch" fillHeight fillWidth>
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
                        <Nav.Link href="https://oligo-designer-toolsuite.readthedocs.io/en/latest/index.html" target="_blank" active={false}>
                            Docs <BoxArrowUpRight size={14} className="ms-1" />
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
                                        <Horizontal gap="lg" align="center">
                                            <Beaker size={18} />
                                            <span>{pipeline.name}</span>
                                        </Horizontal>
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
