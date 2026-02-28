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
                        <Nav.Link href="/">Home</Nav.Link>

                        <NavDropdown title="Pipelines" id="pipelines-dropdown">
                            <NavDropdown.Item href="/pipelines/scrinshot">
                                Scrinshot Probe
                            </NavDropdown.Item>
                            <NavDropdown.Item href="/pipelines/merfish">
                                Merfish Probe
                            </NavDropdown.Item>
                            <NavDropdown.Item href="/pipelines/seqfish">
                                SeqFish+ Probe
                            </NavDropdown.Item>
                            <NavDropdown.Item href="/pipelines/oligoseq">
                                Oligo-Seq Probe
                            </NavDropdown.Item>
                        </NavDropdown>

                        <Nav.Link href="/runs">Runs</Nav.Link>
                        <Nav.Link href="/faq">FAQ</Nav.Link>
                        <Nav.Link href="/contact">Contact</Nav.Link>

                        {/* Auth  */}
                        {user ? (
                            <>
                                {user.role === "admin" && (
                                    <Nav.Link href="/admin">Admin</Nav.Link>
                                )}
                                <Nav.Item>
                                    <Dropdown>
                                        <Dropdown.Toggle>
                                            <i className="bi bi-gear-fill" />
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
                                    <Button
                                        variant="outline-primary"
                                        href="/login"
                                    >
                                        Login
                                    </Button>
                                </Nav.Item>
                                <Nav.Item>
                                    <Button variant="primary" href="/register">
                                        Register
                                    </Button>
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
