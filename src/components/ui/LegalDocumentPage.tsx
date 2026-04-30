import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Alert, Card, Spinner } from "react-bootstrap";

import { BACKEND_URL } from "../../config";
import type { LegalDocument } from "../../types";
import Page from "./Page";

interface LegalDocumentPageProps {
    endpoint: string;
    title: string;
}

const LegalDocumentPage: React.FC<LegalDocumentPageProps> = ({
    endpoint,
    title,
}) => {
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
        <Page title={title}>
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
                        <ReactMarkdown>{document.body}</ReactMarkdown>
                    </Card.Body>
                </Card>
            )}
        </Page>
    );
};

export default LegalDocumentPage;
