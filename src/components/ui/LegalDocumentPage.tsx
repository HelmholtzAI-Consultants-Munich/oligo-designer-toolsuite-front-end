import { useEffect, useState } from "react";
import { Alert, Card, Container, Spinner } from "react-bootstrap";

import { BACKEND_URL } from "../../config";
import type { LegalDocument } from "../../types";
import LegalMarkdown from "./LegalMarkdown";
import Navbar from "./Topbar";

interface LegalDocumentPageProps {
    endpoint: string;
}

const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({ endpoint }) => {
    const [document, setDocument] = useState<LegalDocument | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadDocument = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch(`${BACKEND_URL}${endpoint}`);
                if (!response.ok) {
                    throw new Error("Failed to load legal document");
                }

                const data = (await response.json()) as LegalDocument;
                if (isMounted) {
                    setDocument(data);
                }
            } catch (loadError) {
                console.error(loadError);
                if (isMounted) {
                    setError("Unable to load this document right now.");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void loadDocument();

        return () => {
            isMounted = false;
        };
    }, [endpoint]);

    return (
        <>
            <Navbar />
            <Container className="py-4">
                {error && <Alert variant="danger">{error}</Alert>}
                {isLoading && !error && (
                    <div className="d-flex justify-content-center py-5">
                        <Spinner animation="border" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </Spinner>
                    </div>
                )}
                {document && (
                    <Card>
                        <Card.Body>
                            <p className="text-muted mb-2">
                                Version {document.version}
                            </p>
                            <LegalMarkdown
                                body={document.body}
                                documentKey={document.document}
                            />
                        </Card.Body>
                    </Card>
                )}
            </Container>
        </>
    );
};

export default LegalDocumentPage;
