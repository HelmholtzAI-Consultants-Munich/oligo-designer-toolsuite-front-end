import { useEffect, useState } from "react";
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

import Page from "../../components/ui/Page";
import { Horizontal, Vertical } from "../../components/ui/Alignment";
import { confirmWithModal } from "../../utils/modalUtil";
import { showToast } from "../../utils/toastUtil";
import { getErrorMessage } from "../../utils/errorUtil";
import { formatAdminDateTime } from "../shared/date";
import {
    type LegalDocumentAdminView,
    fetchLegalDocumentsOverview,
    publishLegalDocument,
} from "./legalApi";

const LegalDocuments: React.FC = () => {
    const [documents, setDocuments] = useState<LegalDocumentAdminView[]>([]);
    const [activeDocument, setActiveDocument] = useState("terms");
    const [selectedHistoryVersionId, setSelectedHistoryVersionId] = useState<
        string | null
    >(null);
    const [body, setBody] = useState("");
    const [isViewingHistoryVersion, setIsViewingHistoryVersion] =
        useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const detail = documents.find((d) => d.document === activeDocument) ?? null;
    const selectedVersion =
        detail?.history.find(
            (version) => version.id === selectedHistoryVersionId
        ) ??
        detail?.published ??
        null;

    const loadOverview = async () => {
        const data = await fetchLegalDocumentsOverview();
        setDocuments(data);
    };

    useEffect(() => {
        const init = async () => {
            try {
                setIsLoading(true);
                setError(null);
                await loadOverview();
            } catch (err: unknown) {
                setError(
                    getErrorMessage(err, "Failed to load legal documents")
                );
            } finally {
                setIsLoading(false);
            }
        };

        void init();
    }, []);

    // Sync editor state whenever the active document changes
    useEffect(() => {
        if (!detail) return;
        setSelectedHistoryVersionId(detail.published.id);
        setIsViewingHistoryVersion(false);
        setBody(detail.published.body);
        setError(null);
    }, [activeDocument, detail]);

    const handlePublish = async () => {
        confirmWithModal({
            title: "Publish Document",
            content:
                "Publish these changes? The current public document will be replaced.",
            primaryAction: {
                label: "Publish",
                variant: "success",
                callback: async () => {
                    try {
                        setIsPublishing(true);
                        setError(null);
                        const data = await publishLegalDocument(
                            activeDocument,
                            body
                        );
                        setDocuments((prev) =>
                            prev.map((d) =>
                                d.document === activeDocument ? data : d
                            )
                        );
                        setSelectedHistoryVersionId(data.published.id);
                        setIsViewingHistoryVersion(false);
                        setBody(data.published.body);
                        showToast({
                            type: "success",
                            title: "Document published",
                            content: "Document published successfully.",
                        });
                    } catch (err: unknown) {
                        const message = getErrorMessage(
                            err,
                            "Failed to publish document"
                        );
                        setError(message);
                        showToast({
                            type: "danger",
                            title: "Publish failed",
                            content: message,
                        });
                    } finally {
                        setIsPublishing(false);
                    }
                },
            },
        });
    };

    const handleResetToCurrent = () => {
        if (!detail) return;
        setIsViewingHistoryVersion(false);
        setSelectedHistoryVersionId(detail.published.id);
        setBody(detail.published.body);
        setError(null);
    };

    const handleSelectHistoryVersion = (versionId: string) => {
        if (!detail) return;
        const version = detail.history.find((item) => item.id === versionId);
        if (!version) return;

        if (version.id === detail.published.id) {
            handleResetToCurrent();
            return;
        }

        setSelectedHistoryVersionId(versionId);
        setIsViewingHistoryVersion(true);
        setBody(version.body);
        setError(null);
    };

    if (isLoading && !detail) {
        return (
            <Page title="Legal Documents">
                <Vertical align="center" className="p-5">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </Vertical>
            </Page>
        );
    }

    return (
        <Page title="Legal Documents">
            {error && (
                <Alert
                    variant="danger"
                    onClose={() => setError(null)}
                    dismissible
                >
                    {error}
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
                                <Horizontal
                                    justify="space-between"
                                    align="start"
                                >
                                    <div>
                                        <Card.Title>
                                            {document.title}
                                        </Card.Title>
                                        <div className="text-muted small">
                                            Published:{" "}
                                            {document.published.version}
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
                                </Horizontal>
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
                                <Horizontal
                                    justify="space-between"
                                    align="center"
                                    className="mb-3"
                                >
                                    <div>
                                        <Card.Title className="mb-1">
                                            Edit {detail.title}
                                        </Card.Title>
                                        <div className="text-muted small">
                                            Editing version:{" "}
                                            {detail.history.find(
                                                (v) =>
                                                    v.id ===
                                                    selectedHistoryVersionId
                                            )?.version || "N/A"}
                                        </div>
                                    </div>
                                    {isViewingHistoryVersion ? (
                                        <Badge bg="secondary">
                                            Viewing History
                                        </Badge>
                                    ) : (
                                        <Badge bg="success">Live Version</Badge>
                                    )}
                                </Horizontal>

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
                                            placeholder="# Terms of Service"
                                        />
                                        <Form.Text className="text-muted">
                                            {isViewingHistoryVersion
                                                ? "You are viewing a historical version. You can edit and publish it to restore it, or click Reset Form to return to the current version."
                                                : "Supports simple Markdown-style text such as headings with `#`, subheadings with `##`, paragraphs, and `-` bullet lists."}
                                        </Form.Text>
                                    </Form.Group>

                                    <Horizontal gap="sm">
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
                                            disabled={isPublishing}
                                        >
                                            {isPublishing
                                                ? "Publishing..."
                                                : "Publish Changes"}
                                        </Button>
                                    </Horizontal>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col lg={4}>
                        <Card className="mb-4">
                            <Card.Body>
                                <Card.Title>Selected Version</Card.Title>
                                <div className="mb-3">
                                    <div className="text-muted small">
                                        Version
                                    </div>
                                    <div>
                                        {selectedVersion?.version ?? "N/A"}
                                    </div>
                                    <div className="text-muted small">
                                        {formatAdminDateTime(
                                            selectedVersion?.published_at
                                        )}
                                    </div>
                                </div>
                            </Card.Body>
                        </Card>

                        <Card>
                            <Card.Body>
                                <Card.Title>Published History</Card.Title>
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
                                                style={{ cursor: "pointer" }}
                                                className={
                                                    selectedHistoryVersionId ===
                                                    version.id
                                                        ? "table-active"
                                                        : undefined
                                                }
                                            >
                                                <td className="font-monospace">
                                                    {version.version}
                                                </td>
                                                <td>
                                                    <Badge
                                                        bg={
                                                            version.id ===
                                                            detail.published.id
                                                                ? "success"
                                                                : "secondary"
                                                        }
                                                    >
                                                        {version.id ===
                                                        detail.published.id
                                                            ? "published"
                                                            : "archived"}
                                                    </Badge>
                                                </td>
                                                <td>
                                                    {formatAdminDateTime(
                                                        version.published_at
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            )}
        </Page>
    );
};

export default LegalDocuments;
