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
                                                onClick={handleLogout}
                                            >
                                                Logout
                                            </Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </Nav.Item>
                            </>
                        ) : (
                            <>
                                <Nav.Item>
                                    <Link to="/login">
                                        <Button variant="outline-primary">
                                            Login
                                        </Button>
                                    </Link>
                                </Nav.Item>
                                <Nav.Item>
                                    <Link to="/register">
                                        <Button>Register</Button>
                                    </Link>
                                </Nav.Item>
                            </>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default Topbar;
