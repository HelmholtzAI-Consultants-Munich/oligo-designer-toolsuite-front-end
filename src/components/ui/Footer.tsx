import { Container, Nav } from "react-bootstrap";
import { Link } from "react-router";

export default function Footer() {
    return (
        <footer className="site-footer mt-3">
            <Container className="d-flex flex-column flex-md-row justify-content-around align-items-md-center gap-2">
                <p className="site-footer-copy mb-0">
                    Oligo Designer Toolsuite
                </p>
                <Nav as="ul" variant="tight">
                    <Nav.Item as="li">
                        <Nav.Link as={Link} to="/terms">
                            Terms of Service
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item as="li">
                        <Nav.Link as={Link} to="/privacy-policy">
                            Privacy Policy
                        </Nav.Link>
                    </Nav.Item>
                </Nav>
            </Container>
        </footer>
    );
}
