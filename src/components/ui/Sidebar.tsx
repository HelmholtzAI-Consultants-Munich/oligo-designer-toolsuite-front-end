import { Image, Nav, Navbar } from "react-bootstrap";
import { Link, useLocation } from "react-router";
import { BoxArrowUpRight, Window } from "react-bootstrap-icons";
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
                <Horizontal gap="lg" align="center">
                    <Image
                        src="/ODT_logo.svg"
                        alt="Oligo Designer Toolsuite"
                    />
                    Oligo Designer <br /> Toolsuite
                </Horizontal>
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="navigation-bar" />
            <Navbar.Collapse id="navigation-bar" className="mt-2">
                <Vertical
                    justify="space-between"
                    align="stretch"
                    gap="lg"
                    fillHeight
                    fillWidth
                >
                    <Nav variant="separated">
                        <Nav.Link
                            as={Link}
                            to="/"
                            active={location.pathname === "/"}
                        >
                            Home
                        </Nav.Link>
                        <Nav.Link
                            as={Link}
                            to="/faq"
                            active={location.pathname === "/faq"}
                        >
                            FAQ
                        </Nav.Link>
                        <Nav.Link
                            as={Link}
                            to="/contact"
                            active={location.pathname === "/contact"}
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

                    <UserDropdown />
                </Vertical>
            </Navbar.Collapse>
        </Navbar>
    );
};

export default Sidebar;
