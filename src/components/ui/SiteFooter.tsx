import { Container, Nav } from "react-bootstrap";
import { Link } from "react-router";

const SiteFooter: React.FC = () => {
    return (
        <footer className="site-footer">
            <Container className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                <p className="site-footer-copy mb-0">
                    Oligo Designer Toolsuite
                </p>
                <Nav as="ul" className="site-footer-links">
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
};

export default SiteFooter;
