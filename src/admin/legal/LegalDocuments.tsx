import { useEffect, useState } from "react";
import axios from "axios";
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Form,
    Row,
    Spinner,
    Table,
} from "react-bootstrap";

import { formatAdminDateTime } from "../shared/date";
import {
    type LegalDocumentAdminView,
    fetchLegalDocumentDetail,
    fetchLegalDocumentsOverview,
    publishLegalDocument,
} from "./legalApi";

const LegalDocuments: React.FC = () => {
    const [documents, setDocuments] = useState<LegalDocumentAdminView[]>([]);
    const [activeDocument, setActiveDocument] = useState("terms");
    const [detail, setDetail] = useState<LegalDocumentAdminView | null>(null);
    const [selectedHistoryVersionId, setSelectedHistoryVersionId] = useState<
        string | null
    >(null);
    const [body, setBody] = useState("");
    const [isViewingHistoryVersion, setIsViewingHistoryVersion] =
        useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const applyDetailState = (data: LegalDocumentAdminView) => {
        setDetail(data);
        setSelectedHistoryVersionId(data.published?.id || null);
        setIsViewingHistoryVersion(false);
        setBody(data.published?.body || "");
    };

    useEffect(() => {
        const loadOverview = async () => {
            try {
                const data = await fetchLegalDocumentsOverview();
                setDocuments(data);
            } catch (err: unknown) {
                setError(
                    getErrorMessage(err, "Failed to load legal documents")
                );
            }
        };

        void loadOverview();
    }, []);

    useEffect(() => {
        const loadDetail = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await fetchLegalDocumentDetail(activeDocument);
                applyDetailState(data);
            } catch (err: unknown) {
                setError(getErrorMessage(err, "Failed to load legal document"));
            } finally {
                setIsLoading(false);
            }
        };

        void loadDetail();
    }, [activeDocument]);

    const getErrorMessage = (err: unknown, fallback: string) => {
        if (axios.isAxiosError(err)) {
            return err.response?.data?.error || fallback;
        }
        return fallback;
    };

    const loadOverview = async () => {
        const overview = await fetchLegalDocumentsOverview();
        setDocuments(overview);
    };

    const loadDetail = async (documentKey: string) => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await fetchLegalDocumentDetail(documentKey);
            applyDetailState(data);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load legal document"));
        } finally {
            setIsLoading(false);
        }
    };

    const refreshActiveDocument = async () => {
        try {
            setError(null);
            await Promise.all([loadOverview(), loadDetail(activeDocument)]);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to refresh legal documents"));
        }
    };

    const handlePublish = async () => {
        if (
            !window.confirm(
                "Publish these changes? The current public document will be replaced."
            )
        ) {
            return;
        }

        try {
            setIsPublishing(true);
            setError(null);
            setSuccess(null);
            const data = await publishLegalDocument(activeDocument, body);
            applyDetailState(data);
            await loadOverview();
            setSuccess("Document published successfully.");
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to publish document"));
        } finally {
            setIsPublishing(false);
        }
    };

    const handleResetToCurrent = () => {
        setIsViewingHistoryVersion(false);
        setSelectedHistoryVersionId(detail?.published?.id || null);
        setBody(detail?.published?.body || "");
        setSuccess(null);
        setError(null);
    };

    const handleSelectHistoryVersion = (versionId: string) => {
        const version = detail?.history.find((item) => item.id === versionId);
        if (!version) {
            return;
        }

        setSelectedHistoryVersionId(versionId);
        setIsViewingHistoryVersion(true);
        setBody(version.body);
        setSuccess(null);
        setError(null);
    };

    if (isLoading && !detail) {
        return (
            <div className="d-flex justify-content-center p-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );
    }

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Legal Documents</h2>
                <Button
                    variant="outline-primary"
                    onClick={() => void refreshActiveDocument()}
                >
                    Refresh
                </Button>
            </div>

            {error && (
                <Alert
                    variant="danger"
                    onClose={() => setError(null)}
                    dismissible
                >
                    {error}
                </Alert>
            )}
            {success && (
                <Alert
                    variant="success"
                    onClose={() => setSuccess(null)}
                    dismissible
                >
                    {success}
                </Alert>
            )}

            <Row className="mb-4">
                {documents.map((document) => (
                    <Col md={6} key={document.document} className="mb-3">
                        <Card
                            border={
                                activeDocument === document.document
                                    ? "primary"
                                    : undefined
                            }
                        >
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-start">
                                    <div>
                                        <Card.Title>
                                            {document.label}
                                        </Card.Title>
                                        <div className="text-muted small">
                                            Published:{" "}
                                            {document.published?.version ||
                                                "N/A"}
                                        </div>
                                    </div>
                                    <Button
                                        variant={
                                            activeDocument === document.document
                                                ? "primary"
                                                : "outline-primary"
                                        }
                                        size="sm"
                                        onClick={() =>
                                            setActiveDocument(document.document)
                                        }
                                    >
                                        Open
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            {detail && (
                <Row>
                    <Col lg={8} className="mb-4">
                        <Card>
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <Card.Title className="mb-1">
                                            Edit {detail.label}
                                        </Card.Title>
                                        <div className="text-muted small">
                                            Published version:{" "}
                                            {detail.published?.version || "N/A"}
                                        </div>
                                    </div>
                                    {isViewingHistoryVersion ? (
                                        <Badge bg="secondary">
                                            Viewing History
                                        </Badge>
                                    ) : (
                                        <Badge bg="success">Live Version</Badge>
                                    )}
                                </div>

                                <Form>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Markdown Body</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={20}
                                            value={body}
                                            onChange={(e) =>
                                                setBody(e.target.value)
                                            }
                                            readOnly={isViewingHistoryVersion}
                                            placeholder="# Terms of Service"
                                        />
                                        <Form.Text className="text-muted">
                                            {isViewingHistoryVersion
                                                ? "You are viewing a historical published version. Click Reset Form to return to the current editable text."
                                                : "Supports simple Markdown-style text such as headings with `#`, subheadings with `##`, paragraphs, and `-` bullet lists."}
                                        </Form.Text>
                                    </Form.Group>

                                    <div className="d-flex gap-2">
                                        <Button
                                            variant="secondary"
                                            type="button"
                                            onClick={handleResetToCurrent}
                                        >
                                            Reset Form
                                        </Button>
                                        <Button
                                            variant="success"
                                            type="button"
                                            onClick={handlePublish}
                                            disabled={
                                                isPublishing ||
                                                isViewingHistoryVersion
                                            }
                                        >
                                            {isPublishing
                                                ? "Publishing..."
                                                : "Publish Changes"}
                                        </Button>
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col lg={4}>
                        <Card className="mb-4">
                            <Card.Body>
                                <Card.Title>Current State</Card.Title>
                                <div className="mb-3">
                                    <div className="text-muted small">
                                        Published
                                    </div>
                                    <div>
                                        {detail.published?.version || "N/A"}
                                    </div>
                                    <div className="text-muted small">
                                        {formatAdminDateTime(
                                            detail.published?.published_at,
                                            "Not published"
                                        )}
                                    </div>
                                </div>
                            </Card.Body>
                        </Card>

                        <Card>
                            <Card.Body>
                                <Card.Title>Published History</Card.Title>
                                {detail.history.length === 0 ? (
                                    <Alert variant="info" className="mb-0">
                                        No published versions yet.
                                    </Alert>
                                ) : (
                                    <Table responsive size="sm">
                                        <thead>
                                            <tr>
                                                <th>Version</th>
                                                <th>Status</th>
                                                <th>Published</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.history.map((version) => (
                                                <tr
                                                    key={version.id}
                                                    onClick={() =>
                                                        handleSelectHistoryVersion(
                                                            version.id
                                                        )
                                                    }
                                                    style={{
                                                        cursor: "pointer",
                                                        backgroundColor:
                                                            selectedHistoryVersionId ===
                                                            version.id
                                                                ? "#e7f1ff"
                                                                : undefined,
                                                    }}
                                                >
                                                    <td className="font-monospace">
                                                        {version.version}
                                                    </td>
                                                    <td>
                                                        <Badge
                                                            bg={
                                                                version.status ===
                                                                "published"
                                                                    ? "success"
                                                                    : "secondary"
                                                            }
                                                        >
                                                            {version.status}
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        {formatAdminDateTime(
                                                            version.published_at,
                                                            "Not published"
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}
        </div>
    );
};

export default LegalDocuments;
