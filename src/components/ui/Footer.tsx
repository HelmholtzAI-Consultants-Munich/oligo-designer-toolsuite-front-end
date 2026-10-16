import { Container, Nav } from "react-bootstrap";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import { BACKEND_URL, ODT_CLOUD_VERSION } from "../../config";

export default function Footer() {
    const [odtVersion, setOdtVersion] = useState<string | null>(null);
    const [odtCommit, setOdtCommit] = useState<string | null>(null);

    useEffect(() => {
        const url = `${BACKEND_URL}/api/version/ODT`;
        fetch(url)
            .then((res) => res.json())
            .then((data) => {
                setOdtVersion(data.odt_version);
                setOdtCommit(data.odt_commit);
            })
            .catch(() => {
                setOdtVersion(null);
                setOdtCommit(null);
            });
    }, []);
    return (
        <footer className="site-footer mt-3">
            <Container className="d-flex flex-column flex-md-row justify-content-around align-items-md-center gap-2">
                <p className="site-footer-copy mb-0">
                    Oligo Designer Toolsuite
                        <small className="d-block text-muted">
                            ODT-Cloud {ODT_CLOUD_VERSION}
                            {odtVersion && (
                                <>
                                     {" · "}ODT {odtVersion}
                                    {odtCommit && (
                                        <>
                                            {" ("}
                                            <a
                                                href={`https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite/commit/${odtCommit}`}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {odtCommit.slice(0, 7)}
                                            </a>
                                            {")"}
                                        </>
                                    )}
                                </>
                            )}
                        </small>
                </p>
                <Nav as="ul" variant="tight">
                    <Nav.Item as="li">
                        <Nav.Link as={Link} target="_blank" to="/terms">
                            Terms of Service
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item as="li">
                        <Nav.Link
                            as={Link}
                            target="_blank"
                            to="/privacy-policy"
                        >
                            Privacy Policy
                        </Nav.Link>
                    </Nav.Item>
                </Nav>
            </Container>
        </footer>
    );
}
